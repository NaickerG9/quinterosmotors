import { get, post, put } from "../api.js";
import { buildClienteFormHtml, readClienteForm } from "../forms/cliente.js";
import {
  clearFieldErrors,
  emptyState,
  escapeHtml,
  formatNumber,
  initials,
  openSheet,
  renderPagination,
  setLoading,
  showFormError,
  toast,
} from "../ui.js";

const form = document.getElementById("filtros-clientes");
const resultado = document.getElementById("clientes-resultado");
const paginacion = document.getElementById("clientes-paginacion");
let query = "";

function openClientForm(cliente = null) {
  const sheet = openSheet({
    title: cliente ? "Editar cliente" : "Nuevo cliente",
    subtitle: cliente ? cliente.nombre : "Registra los datos de contacto.",
    body: buildClienteFormHtml(cliente || {}),
  });
  const clienteForm = sheet.body.querySelector("#cliente-form");
  const errorBox = sheet.body.querySelector("#cliente-form-error");
  const submit = sheet.body.querySelector("[data-submit]");
  sheet.body.querySelector("[data-cancel]").addEventListener("click", sheet.close);

  clienteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors(clienteForm);
    showFormError(errorBox, "");
    const payload = readClienteForm(clienteForm, { includeActivo: Boolean(cliente) });
    if (!payload.nombre) {
      showFormError(errorBox, "El nombre es obligatorio.", { nombre: "Campo requerido" });
      return;
    }

    setLoading(submit, true, "Guardando…");
    try {
      if (cliente) await put(`/api/v1/clientes/${cliente.id}`, payload);
      else await post("/api/v1/clientes", payload);
      sheet.close();
      toast(cliente ? "Cliente actualizado." : "Cliente creado.");
      await load(1);
    } catch (error) {
      showFormError(errorBox, error.message, error.fields);
      setLoading(submit, false);
    }
  });
}

function renderRows(items) {
  if (!items.length) {
    return `<div class="card">${emptyState("No hay clientes", "Registra el primer cliente para asociarlo a una venta.")}</div>`;
  }
  return `
    <div class="card hidden overflow-hidden md:block">
      <div class="overflow-x-auto">
        <table class="table-apple">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contacto</th>
              <th>Compras</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((cliente) => `
              <tr>
                <td>
                  <div class="flex items-center gap-3">
                    <span class="flex size-10 items-center justify-center rounded-full bg-apple-blue/10 text-xs font-semibold text-apple-blue dark:bg-apple-blue-dark/15 dark:text-apple-blue-dark">${escapeHtml(initials(cliente.nombre))}</span>
                    <div>
                      <p class="font-medium">${escapeHtml(cliente.nombre)}</p>
                      <p class="text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(cliente.documento || "Sin documento")}</p>
                    </div>
                  </div>
                </td>
                <td class="text-xs text-apple-muted dark:text-apple-muted-dark">
                  <p>${escapeHtml(cliente.telefono || "Sin teléfono")}</p>
                  <p>${escapeHtml(cliente.email || "Sin correo")}</p>
                </td>
                <td><span class="badge bg-black/5 text-apple-ink dark:bg-white/10 dark:text-apple-ink-dark">${formatNumber(cliente.total_compras)}</span></td>
                <td class="text-right">
                  <div class="flex justify-end gap-2">
                    <button type="button" class="btn btn-secondary btn-sm" data-edit="${cliente.id}">Editar</button>
                    <a href="/clientes/${cliente.id}" class="btn btn-primary btn-sm">Ver</a>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <div class="grid gap-3 md:hidden">
      ${items.map((cliente) => `
        <div class="card p-4">
          <div class="flex items-start gap-3">
            <span class="flex size-10 items-center justify-center rounded-full bg-apple-blue/10 text-xs font-semibold text-apple-blue dark:bg-apple-blue-dark/15 dark:text-apple-blue-dark">${escapeHtml(initials(cliente.nombre))}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">${escapeHtml(cliente.nombre)}</p>
              <p class="text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(cliente.documento || "Sin documento")} · ${formatNumber(cliente.total_compras)} compras</p>
              <p class="mt-1 text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(cliente.telefono || cliente.email || "Sin contacto")}</p>
            </div>
          </div>
          <div class="mt-3 flex justify-end gap-2">
            <button type="button" class="btn btn-secondary btn-sm" data-edit="${cliente.id}">Editar</button>
            <a href="/clientes/${cliente.id}" class="btn btn-primary btn-sm">Ver</a>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function bindRows() {
  resultado.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.edit);
      try {
        const response = await get(`/api/v1/clientes/${id}`);
        openClientForm(response.data);
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

async function load(page = 1) {
  const params = new URLSearchParams({ page: String(page), per_page: "15" });
  if (query) params.set("q", query);
  try {
    const response = await get(`/api/v1/clientes?${params.toString()}`);
    resultado.innerHTML = renderRows(response.data);
    bindRows();
    renderPagination(paginacion, response.meta, (next) => load(next));
  } catch (error) {
    resultado.innerHTML = `<div class="card p-6 text-sm text-red-600 dark:text-red-400">${escapeHtml(error.message)}</div>`;
  }
}

document.getElementById("nuevo-cliente")?.addEventListener("click", () => openClientForm());
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  query = String(new FormData(form).get("q") || "").trim();
  load(1);
});
form?.addEventListener("reset", () => {
  window.setTimeout(() => {
    query = "";
    load(1);
  }, 0);
});

load();
