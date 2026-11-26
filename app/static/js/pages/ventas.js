import { get } from "../api.js";
import {
  badgeForEstado,
  emptyState,
  escapeHtml,
  formatDate,
  formatUsd,
  formatVes,
  renderPagination,
  vehicleThumb,
} from "../ui.js";

const form = document.getElementById("filtros-ventas");
const resultado = document.getElementById("ventas-resultado");
const paginacion = document.getElementById("ventas-paginacion");

function paramsFor(page) {
  const data = new FormData(form);
  const params = new URLSearchParams({ page: String(page), per_page: "15" });
  const q = String(data.get("q") || "").trim();
  const estado = String(data.get("estado") || "");
  const desde = String(data.get("desde") || "");
  const hasta = String(data.get("hasta") || "");
  if (q) params.set("q", q);
  if (estado) params.set("estado", estado);
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  return params;
}

function renderRows(items) {
  if (!items.length) {
    return `<div class="card">${emptyState(
      "No hay ventas registradas",
      "Registra una venta o apartado para comenzar.",
      `<a href="/ventas/nueva" class="btn btn-primary btn-sm">Nueva venta</a>`,
    )}</div>`;
  }

  return `
    <div class="card hidden overflow-hidden md:block">
      <div class="overflow-x-auto">
        <table class="table-apple">
          <thead>
            <tr>
              <th>Vehículo</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Precio</th>
              <th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (venta) => `
              <tr>
                <td>
                  <div class="flex items-center gap-3">
                    ${vehicleThumb(venta.vehiculo, "size-12")}
                    <div class="min-w-0">
                      <p class="truncate font-medium">${escapeHtml(venta.vehiculo?.titulo || "Vehículo")}</p>
                      <p class="text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(venta.forma_pago_label || "")}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <p class="font-medium">${escapeHtml(venta.cliente?.nombre || "Cliente")}</p>
                  <p class="text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(venta.vendedor?.nombre || "Sin vendedor")}</p>
                </td>
                <td class="text-xs text-apple-muted dark:text-apple-muted-dark">${formatDate(venta.fecha_venta || venta.created_at)}</td>
                <td>
                  <p class="font-medium">${formatVes(venta.precio_final_ves_centavos)}</p>
                  <p class="text-xs text-apple-muted dark:text-apple-muted-dark">≈ ${formatUsd(venta.precio_usd_centavos)}</p>
                </td>
                <td>${badgeForEstado(venta.estado, "venta")}</td>
                <td class="text-right">
                  <a href="/ventas/${venta.id}" class="btn btn-secondary btn-sm">Ver</a>
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
          (venta) => `
        <a href="/ventas/${venta.id}" class="card block p-4">
          <div class="flex items-start gap-3">
            ${vehicleThumb(venta.vehiculo, "size-16")}
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <p class="truncate font-medium">${escapeHtml(venta.vehiculo?.titulo || "Vehículo")}</p>
                ${badgeForEstado(venta.estado, "venta")}
              </div>
              <p class="mt-1 text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(venta.cliente?.nombre || "Cliente")} · ${formatDate(venta.fecha_venta || venta.created_at)}</p>
              <p class="mt-2 text-sm font-semibold">${formatVes(venta.precio_final_ves_centavos)}</p>
              <p class="text-xs text-apple-muted dark:text-apple-muted-dark">≈ ${formatUsd(venta.precio_usd_centavos)}</p>
            </div>
          </div>
        </a>
      `,
        )
        .join("")}
    </div>
  `;
}

async function load(page = 1) {
  try {
    const response = await get(`/api/v1/ventas?${paramsFor(page).toString()}`);
    resultado.innerHTML = renderRows(response.data);
    renderPagination(paginacion, response.meta, (next) => load(next));
  } catch (error) {
    resultado.innerHTML = `<div class="card p-6 text-sm text-red-600 dark:text-red-400">${escapeHtml(error.message)}</div>`;
    paginacion.innerHTML = "";
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  load(1);
});

form?.addEventListener("reset", () => {
  window.setTimeout(() => load(1), 0);
});

load();
