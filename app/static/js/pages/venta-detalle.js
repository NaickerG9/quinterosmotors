import { get, post } from "../api.js";
import {
  badgeForEstado,
  confirmDialog,
  escapeHtml,
  formatDateTime,
  formatNumber,
  formatUsd,
  formatVes,
  toast,
} from "../ui.js";

const root = document.getElementById("venta-detalle");
const ventaId = root?.dataset.ventaId;
const container = document.getElementById("venta-contenido");
let venta = null;

function row(label, value) {
  return `
    <div class="flex items-start justify-between gap-4 border-b border-apple-line py-3 last:border-0 dark:border-apple-line-dark">
      <span class="text-sm text-apple-muted dark:text-apple-muted-dark">${label}</span>
      <span class="text-right text-sm font-medium">${value}</span>
    </div>
  `;
}

function render() {
  const completada = venta.estado === "completada";
  const cancelada = venta.estado === "cancelada";
  const fecha = venta.fecha_venta || venta.created_at;

  container.innerHTML = `
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          ${badgeForEstado(venta.estado, "venta")}
          <span class="badge bg-black/5 text-apple-ink dark:bg-white/10 dark:text-apple-ink-dark">${escapeHtml(venta.forma_pago_label || "")}</span>
        </div>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Venta #${venta.id}</h1>
        <p class="mt-2 text-sm text-apple-muted dark:text-apple-muted-dark">${escapeHtml(venta.cliente?.nombre || "Cliente")} · ${formatDateTime(fecha)}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <a href="/vehiculos/${venta.vehiculo?.id ?? ""}" class="btn btn-secondary">Ver vehículo</a>
        ${venta.puede_completar ? `<button type="button" class="btn btn-primary" data-completar>Completar venta</button>` : ""}
        ${venta.puede_cancelar && !cancelada ? `<button type="button" class="btn btn-danger" data-cancelar>${completada ? "Anular venta" : "Cancelar apartado"}</button>` : ""}
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      <section class="card p-5 lg:col-span-2">
        <h2 class="text-base font-semibold tracking-tight">Resumen</h2>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <div class="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/5">
            <p class="text-xs uppercase tracking-wide text-apple-muted dark:text-apple-muted-dark">Precio final</p>
            <p class="mt-2 text-2xl font-semibold tracking-tight">${formatVes(venta.precio_final_ves_centavos)}</p>
            <p class="mt-1 text-sm text-apple-muted dark:text-apple-muted-dark">≈ ${formatUsd(venta.precio_usd_centavos)}</p>
          </div>
          <div class="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/5">
            <p class="text-xs uppercase tracking-wide text-apple-muted dark:text-apple-muted-dark">Tasa congelada</p>
            <p class="mt-2 text-2xl font-semibold tracking-tight">Bs. ${formatNumber(venta.tasa_ves_por_usd)}</p>
            <p class="mt-1 text-sm text-apple-muted dark:text-apple-muted-dark">por 1 USD al momento de la venta</p>
          </div>
        </div>

        <div class="mt-5">
          ${row("Precio de lista", formatVes(venta.precio_lista_ves_centavos))}
          ${row("Diferencia", formatVes(venta.precio_final_ves_centavos - venta.precio_lista_ves_centavos))}
          ${row("Vendedor", escapeHtml(venta.vendedor?.nombre || "—"))}
          ${row("Fecha de venta", formatDateTime(venta.fecha_venta))}
          ${venta.completada_at ? row("Completada", formatDateTime(venta.completada_at)) : ""}
          ${venta.cancelada_at ? row("Cancelada", formatDateTime(venta.cancelada_at)) : ""}
        </div>

        ${
          venta.notas
            ? `<div class="mt-5 rounded-xl bg-black/[0.03] p-4 text-sm dark:bg-white/5">
                <p class="text-xs uppercase tracking-wide text-apple-muted dark:text-apple-muted-dark">Notas</p>
                <p class="mt-2 whitespace-pre-line">${escapeHtml(venta.notas)}</p>
              </div>`
            : ""
        }
      </section>

      <div class="space-y-6">
        <section class="card p-5">
          <h2 class="text-base font-semibold tracking-tight">Cliente</h2>
          <p class="mt-3 font-medium">${escapeHtml(venta.cliente?.nombre || "—")}</p>
          <p class="mt-1 text-sm text-apple-muted dark:text-apple-muted-dark">${escapeHtml(venta.cliente?.documento || "Sin documento")}</p>
          <p class="mt-1 text-sm text-apple-muted dark:text-apple-muted-dark">${escapeHtml(venta.cliente?.telefono || "Sin teléfono")}</p>
          ${
            venta.cliente?.id
              ? `<a href="/clientes/${venta.cliente.id}" class="btn btn-secondary btn-sm mt-4 w-full">Ver cliente</a>`
              : ""
          }
        </section>

        <section class="card p-5">
          <h2 class="text-base font-semibold tracking-tight">Vehículo</h2>
          ${
            venta.vehiculo
              ? `<p class="mt-3 font-medium">${escapeHtml(venta.vehiculo.titulo)}</p>
                 <p class="mt-1 text-sm text-apple-muted dark:text-apple-muted-dark">${venta.vehiculo.anio} · ${escapeHtml(venta.vehiculo.placa || "Sin placa")}</p>
                 <p class="mt-1 text-sm text-apple-muted dark:text-apple-muted-dark">VIN: ${escapeHtml(venta.vehiculo.vin || "—")}</p>
                 <a href="/vehiculos/${venta.vehiculo.id}" class="btn btn-secondary btn-sm mt-4 w-full">Ver vehículo</a>`
              : `<p class="mt-3 text-sm text-apple-muted dark:text-apple-muted-dark">Sin vehículo asociado.</p>`
          }
        </section>
      </div>
    </div>
  `;

  container.querySelector("[data-completar]")?.addEventListener("click", completar);
  container.querySelector("[data-cancelar]")?.addEventListener("click", cancelar);
}

async function completar() {
  const confirmed = await confirmDialog({
    title: "Completar venta",
    message: "El vehículo quedará marcado como vendido y la venta se contabilizará en los ingresos.",
    confirmText: "Completar",
  });
  if (!confirmed) return;
  try {
    await post(`/api/v1/ventas/${venta.id}/completar`);
    toast("Venta completada.");
    await load();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function cancelar() {
  const confirmed = await confirmDialog({
    title: "Cancelar venta",
    message: "La venta se marcará como cancelada y el vehículo volverá a estar disponible si no tiene otra venta activa.",
    confirmText: "Cancelar venta",
    danger: true,
  });
  if (!confirmed) return;
  try {
    await post(`/api/v1/ventas/${venta.id}/cancelar`);
    toast("Venta cancelada.");
    await load();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function load() {
  try {
    const response = await get(`/api/v1/ventas/${ventaId}`);
    venta = response.data;
    render();
  } catch (error) {
    container.innerHTML = `<div class="card p-6 text-sm text-red-600 dark:text-red-400">${escapeHtml(error.message)}</div>`;
  }
}

load();
