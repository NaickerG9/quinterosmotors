import { del, get, put } from "../api.js";
import { buildClienteFormHtml, readClienteForm } from "../forms/cliente.js";
import {
  badgeForEstado,
  clearFieldErrors,
  confirmDialog,
  emptyState,
  escapeHtml,
  formatDate,
  formatDateTime,
  formatNumber,
  formatUsd,
  formatVes,
  initials,
  openSheet,
  setLoading,
  showFormError,
  toast,
} from "../ui.js";

const root = document.getElementById("cliente-detalle");
const clienteId = root?.dataset.clienteId;
const container = document.getElementById("cliente-contenido");
let cliente = null;

function render() {
  const ventas = cliente.ventas || [];
  const completadas = ventas.filter((venta) => venta.estado === "completada");
  const totalVes = completadas.reduce(
    (total, venta) => total + (venta.precio_final_ves_centavos || 0),
    0,
  );
  const totalUsd = completadas.reduce(
    (total, venta) => total + (venta.precio_usd_centavos || 0),
    0,
  );

  container.innerHTML = `
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="flex items-center gap-4">
        <span class="flex size-14 items-center justify-center rounded-full bg-apple-blue/10 text-lg font-semibold text-apple-blue dark:bg-apple-blue-dark/15 dark:text-apple-blue-dark">${escapeHtml(initials(cliente.nombre))}</span>
        <div>
          <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">${escapeHtml(cliente.nombre)}</h1>
          <p class="mt-1 text-sm text-apple-muted dark:text-apple-muted-dark">${escapeHtml(cliente.documento || "Sin documento")} · ${escapeHtml(cliente.telefono || "Sin teléfono")}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-secondary" data-edit>Editar</button>
        <button type="button" class="btn btn-danger" data-delete>Eliminar</button>
      </div>
    </div>

    ${
      !cliente.activo
        ? `<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">Este cliente está inactivo.</div>`
        : ""
    }

    <div class="mt-6 grid gap-4 sm:grid-cols-3">
      <div class="card p-5">
        <p class="text-xs uppercase tracking-wide text-apple-muted dark:text-apple-muted-dark">Compras completadas</p>
        <p class="stat-value mt-2">${formatNumber(completadas.length)}</p>
      </div>
      <div class="card p-5">
        <p class="text-xs uppercase tracking-wide text-apple-muted dark:text-apple-muted-dark">Total comprado</p>
        <p class="mt-2 text-2xl font-semibold">${formatVes(totalVes)}</p>
        <p class="text-xs text-apple-muted dark:text-apple-muted-dark">≈ ${formatUsd(totalUsd)}</p>
      </div>
      <div class="card p-5">
        <p class="text-xs uppercase tracking-wide text-apple-muted dark:text-apple-muted-dark">Cliente desde</p>
        <p class="mt-2 text-lg font-semibold">${formatDate(cliente.created_at)}</p>
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      <section class="card p-5 lg:col-span-1">
        <h2 class="text-base font-semibold tracking-tight">Contacto</h2>
        <dl class="mt-4 space-y-3 text-sm">
          <div><dt class="text-xs text-apple-muted dark:text-apple-muted-dark">Correo</dt><dd class="mt-0.5">${escapeHtml(cliente.email || "—")}</dd></div>
          <div><dt class="text-xs text-apple-muted dark:text-apple-muted-dark">Teléfono</dt><dd class="mt-0.5">${escapeHtml(cliente.telefono || "—")}</dd></div>
          <div><dt class="text-xs text-apple-muted dark:text-apple-muted-dark">Dirección</dt><dd class="mt-0.5">${escapeHtml(cliente.direccion || "—")}</dd></div>
          <div><dt class="text-xs text-apple-muted dark:text-apple-muted-dark">Notas</dt><dd class="mt-0.5 whitespace-pre-line">${escapeHtml(cliente.notas || "—")}</dd></div>
        </dl>
      </section>

      <section class="card p-5 lg:col-span-2">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold tracking-tight">Historial de compras</h2>
          <a href="/ventas/nueva" class="btn btn-secondary btn-sm">Nueva venta</a>
        </div>
        <div class="mt-4">
          ${
            ventas.length
              ? `<div class="divide-y divide-apple-line dark:divide-apple-line-dark">
                  ${ventas.map((venta) => `
                    <a href="/ventas/${venta.id}" class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium">${escapeHtml(venta.vehiculo?.titulo || "Vehículo")}</p>
                        <p class="text-xs text-apple-muted dark:text-apple-muted-dark">${formatDateTime(venta.created_at)} · ${escapeHtml(venta.forma_pago_label || "")}</p>
                      </div>
                      <div class="text-right">
                        <p class="text-xs font-semibold">${formatVes(venta.precio_final_ves_centavos)}</p>
                        <p class="text-[11px] text-apple-muted dark:text-apple-muted-dark">≈ ${formatUsd(venta.precio_usd_centavos)}</p>
                      </div>
                      ${badgeForEstado(venta.estado, "venta")}
                    </a>
                  `).join("")}
                </div>`
              : emptyState("Sin compras registradas", "Este cliente todavía no tiene ventas.")
          }
        </div>
      </section>
    </div>
  `;

  container.querySelector("[data-edit]")?.addEventListener("click", openEdit);
  container.querySelector("[data-delete]")?.addEventListener("click", eliminar);
}

function openEdit() {
  const sheet = openSheet({
    title: "Editar cliente",
    subtitle: cliente.nombre,
    body: buildClienteFormHtml(cliente),
  });
  const form = sheet.body.querySelector("#cliente-form");
  const errorBox = sheet.body.querySelector("#cliente-form-error");
  const submit = sheet.body.querySelector("[data-submit]");
  sheet.body.querySelector("[data-cancel]").addEventListener("click", sheet.close);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    showFormError(errorBox, "");
    const payload = readClienteForm(form, { includeActivo: true });
    if (!payload.nombre) {
      showFormError(errorBox, "El nombre es obligatorio.", { nombre: "Campo requerido" });
      return;
    }
    setLoading(submit, true, "Guardando…");
    try {
      await put(`/api/v1/clientes/${cliente.id}`, payload);
      toast("Cliente actualizado.");
      sheet.close();
      await load();
    } catch (error) {
      showFormError(errorBox, error.message, error.fields);
      setLoading(submit, false);
    }
  });
}

async function eliminar() {
  const confirmed = await confirmDialog({
    title: "Eliminar cliente",
    message: "Solo se puede eliminar un cliente sin ventas registradas. Esta acción no se puede deshacer.",
    confirmText: "Eliminar",
    danger: true,
  });
  if (!confirmed) return;
  try {
    await del(`/api/v1/clientes/${cliente.id}`);
    toast("Cliente eliminado.");
    window.location.href = "/clientes";
  } catch (error) {
    toast(error.message, "error");
  }
}

async function load() {
  try {
    const response = await get(`/api/v1/clientes/${clienteId}`);
    cliente = response.data;
    render();
  } catch (error) {
    container.innerHTML = `<div class="card p-6 text-sm text-red-600 dark:text-red-400">${escapeHtml(error.message)}</div>`;
  }
}

load();
