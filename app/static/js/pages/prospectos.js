import { get, post, put } from "../api.js";
import { buildProspectoFormHtml, readProspectoForm } from "../forms/prospecto.js";
import {
  badgeForEstado,
  clearFieldErrors,
  confirmDialog,
  emptyState,
  escapeHtml,
  formatDate,
  initials,
  openSheet,
  renderPagination,
  setLoading,
  showFormError,
  toast,
} from "../ui.js";

const form = document.getElementById("filtros-prospectos");
const resultado = document.getElementById("prospectos-resultado");
const paginacion = document.getElementById("prospectos-paginacion");
let catalog = null;
let vehiculos = [];
let currentFilters = {};

async function ensureCatalogs() {
  if (catalog) return;
  const [catalogResponse, vehiculosResponse] = await Promise.all([
    get("/api/v1/catalogos"),
    get("/api/v1/vehiculos?per_page=200&sort=marca"),
  ]);
  catalog = catalogResponse.data;
  vehiculos = vehiculosResponse.data;
}

function openProspectoForm(prospecto = null) {
  const sheet = openSheet({
    title: prospecto ? "Editar prospecto" : "Nuevo prospecto",
    subtitle: prospecto ? prospecto.nombre : "Registra una nueva oportunidad de venta.",
    body: buildProspectoFormHtml(prospecto || {}, { catalog, vehiculos }),
  });
  const prospectoForm = sheet.body.querySelector("#prospecto-form");
  const errorBox = sheet.body.querySelector("#prospecto-form-error");
  const submit = sheet.body.querySelector("[data-submit]");
  sheet.body.querySelector("[data-cancel]").addEventListener("click", sheet.close);

  prospectoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors(prospectoForm);
    showFormError(errorBox, "");
    const payload = readProspectoForm(prospectoForm);
    if (!payload.nombre) {
      showFormError(errorBox, "El nombre es obligatorio.", { nombre: "Campo requerido" });
      return;
    }
    if (!payload.telefono && !payload.email) {
      showFormError(errorBox, "Registra al menos un teléfono o correo.", {
        telefono: "Teléfono o correo requerido",
      });
      return;
    }

    setLoading(submit, true, "Guardando…");
    try {
      if (prospecto) await put(`/api/v1/prospectos/${prospecto.id}`, payload);
      else await post("/api/v1/prospectos", payload);
      sheet.close();
      toast(prospecto ? "Prospecto actualizado." : "Prospecto creado.");
      await load(1);
    } catch (error) {
      showFormError(errorBox, error.message, error.fields);
      setLoading(submit, false);
    }
  });
}

async function convertir(prospecto) {
  const confirmed = await confirmDialog({
    title: "Convertir a cliente",
    message: `Se creará o reutilizará un cliente con los datos de ${prospecto.nombre} y el prospecto se marcará como ganado.`,
    confirmText: "Convertir",
  });
  if (!confirmed) return;
  try {
    const response = await post(`/api/v1/prospectos/${prospecto.id}/convertir-cliente`);
    toast("Prospecto convertido en cliente.");
    window.location.href = `/clientes/${response.data.id}`;
  } catch (error) {
    toast(error.message, "error");
  }
}

function renderRows(items) {
  if (!items.length) {
    return `<div class="card">${emptyState(
      "No hay prospectos",
      "Registra el primer contacto para comenzar a dar seguimiento.",
      `<button type="button" class="btn btn-primary btn-sm" data-new>Nuevo prospecto</button>`,
    )}</div>`;
  }

  return `
    <div class="card hidden overflow-hidden md:block">
      <div class="overflow-x-auto">
        <table class="table-apple">
          <thead>
            <tr>
              <th>Prospecto</th>
              <th>Contacto</th>
              <th>Interés</th>
              <th>Estado</th>
              <th>Registrado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (prospecto) => `
              <tr>
                <td>
                  <div class="flex items-center gap-3">
                    <span class="flex size-10 items-center justify-center rounded-full bg-apple-blue/10 text-xs font-semibold text-apple-blue dark:bg-apple-blue-dark/15 dark:text-apple-blue-dark">${escapeHtml(initials(prospecto.nombre))}</span>
                    <div class="min-w-0">
                      <p class="font-medium">${escapeHtml(prospecto.nombre)}</p>
                      <p class="text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(prospecto.origen_label || "")}</p>
                    </div>
                  </div>
                </td>
                <td class="text-xs text-apple-muted dark:text-apple-muted-dark">
                  <p>${escapeHtml(prospecto.telefono || "Sin teléfono")}</p>
                  <p>${escapeHtml(prospecto.email || "Sin correo")}</p>
                </td>
                <td class="text-xs">${escapeHtml(prospecto.vehiculo?.titulo || "Sin vehículo")}</td>
                <td>${badgeForEstado(prospecto.estado, "prospecto")}</td>
                <td class="text-xs text-apple-muted dark:text-apple-muted-dark">${formatDate(prospecto.created_at)}</td>
                <td class="text-right">
                  <div class="flex justify-end gap-2">
                    <button type="button" class="btn btn-secondary btn-sm" data-edit="${prospecto.id}">Editar</button>
                    ${!prospecto.cliente_id ? `<button type="button" class="btn btn-primary btn-sm" data-convert="${prospecto.id}">Convertir</button>` : `<a href="/clientes/${prospecto.cliente_id}" class="btn btn-secondary btn-sm">Cliente</a>`}
                  </div>
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid gap-3 md:hidden">
      ${items
        .map(
          (prospecto) => `
        <div class="card p-4">
          <div class="flex items-start gap-3">
            <span class="flex size-10 items-center justify-center rounded-full bg-apple-blue/10 text-xs font-semibold text-apple-blue dark:bg-apple-blue-dark/15 dark:text-apple-blue-dark">${escapeHtml(initials(prospecto.nombre))}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <p class="truncate font-medium">${escapeHtml(prospecto.nombre)}</p>
                ${badgeForEstado(prospecto.estado, "prospecto")}
              </div>
              <p class="mt-1 text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(prospecto.telefono || prospecto.email || "Sin contacto")}</p>
              <p class="mt-1 text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(prospecto.vehiculo?.titulo || "Sin vehículo")}</p>
            </div>
          </div>
          <div class="mt-3 flex justify-end gap-2">
            <button type="button" class="btn btn-secondary btn-sm" data-edit="${prospecto.id}">Editar</button>
            ${!prospecto.cliente_id ? `<button type="button" class="btn btn-primary btn-sm" data-convert="${prospecto.id}">Convertir</button>` : `<a href="/clientes/${prospecto.cliente_id}" class="btn btn-secondary btn-sm">Cliente</a>`}
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function bindRows(items) {
  resultado.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const prospecto = items.find((item) => item.id === Number(button.dataset.edit));
      if (prospecto) openProspectoForm(prospecto);
    });
  });
  resultado.querySelectorAll("[data-convert]").forEach((button) => {
    button.addEventListener("click", () => {
      const prospecto = items.find((item) => item.id === Number(button.dataset.convert));
      if (prospecto) convertir(prospecto);
    });
  });
  resultado.querySelector("[data-new]")?.addEventListener("click", () => openProspectoForm());
}

async function load(page = 1) {
  try {
    const params = new URLSearchParams({ page: String(page), per_page: "15" });
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const response = await get(`/api/v1/prospectos?${params.toString()}`);
    resultado.innerHTML = renderRows(response.data);
    bindRows(response.data);
    renderPagination(paginacion, response.meta, (next) => load(next));
  } catch (error) {
    resultado.innerHTML = `<div class="card p-6 text-sm text-red-600 dark:text-red-400">${escapeHtml(error.message)}</div>`;
  }
}

async function init() {
  try {
    await ensureCatalogs();
    document.getElementById("nuevo-prospecto")?.addEventListener("click", () => openProspectoForm());
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      currentFilters = {
        q: String(data.get("q") || "").trim(),
        estado: String(data.get("estado") || ""),
        origen: String(data.get("origen") || ""),
      };
      load(1);
    });
    form?.addEventListener("reset", () => {
      window.setTimeout(() => {
        currentFilters = {};
        load(1);
      }, 0);
    });
    load();
  } catch (error) {
    resultado.innerHTML = `<div class="card p-6 text-sm text-red-600 dark:text-red-400">${escapeHtml(error.message)}</div>`;
  }
}

init();
