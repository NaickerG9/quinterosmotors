import { get } from "../api.js";
import {
  badgeForEstado,
  emptyState,
  escapeHtml,
  formatNumber,
  formatUsd,
  formatVes,
  parseMoneyInput,
  renderPagination,
  toast,
  vehicleThumb,
} from "../ui.js";

const form = document.getElementById("filtros-vehiculos");
const resultado = document.getElementById("vehiculos-resultado");
const paginacion = document.getElementById("vehiculos-paginacion");
let currentPage = 1;

function queryParams(page) {
  const data = new FormData(form);
  const params = new URLSearchParams();
  const q = String(data.get("q") || "").trim();
  const estado = String(data.get("estado") || "");
  const marca = String(data.get("marca") || "").trim();
  const sort = String(data.get("sort") || "reciente");
  if (q) params.set("q", q);
  if (estado) params.set("estado", estado);
  if (marca) params.set("marca", marca);
  if (sort) params.set("sort", sort);

  for (const [field, key] of [
    ["precio_min", "precio_min"],
    ["precio_max", "precio_max"],
  ]) {
    const raw = String(data.get(field) || "").trim();
    if (!raw) continue;
    const cents = parseMoneyInput(raw);
    if (cents === null || cents < 0) {
      toast(`Precio inválido en ${field === "precio_min" ? "mínimo" : "máximo"}`, "error");
      return null;
    }
    params.set(key, String(cents));
  }
  params.set("page", String(page));
  params.set("per_page", "15");
  return params;
}

function renderRows(items) {
  if (!items.length) {
    return `<div class="card">${emptyState(
      "No hay vehículos que coincidan",
      "Prueba con otros filtros o registra un vehículo nuevo.",
      `<a href="/vehiculos/nuevo" class="btn btn-primary btn-sm">Nuevo vehículo</a>`,
    )}</div>`;
  }

  return `
    <div class="card hidden overflow-hidden md:block">
      <div class="overflow-x-auto">
        <table class="table-apple">
          <thead>
            <tr>
              <th>Vehículo</th>
              <th>Identificación</th>
              <th>Precio</th>
              <th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((vehiculo) => `
              <tr>
                <td>
                  <div class="flex items-center gap-3">
                    ${vehicleThumb(vehiculo, "size-12")}
                    <div class="min-w-0">
                      <p class="truncate font-medium">${escapeHtml(vehiculo.titulo)}</p>
                      <p class="text-xs text-apple-muted dark:text-apple-muted-dark">${vehiculo.anio} · ${formatNumber(vehiculo.kilometraje)} km · ${escapeHtml(vehiculo.color || "Sin color")}</p>
                    </div>
                  </div>
                </td>
                <td class="text-xs text-apple-muted dark:text-apple-muted-dark">
                  <p>VIN: ${escapeHtml(vehiculo.vin || "—")}</p>
                  <p>Placa: ${escapeHtml(vehiculo.placa || "—")}</p>
                </td>
                <td>
                  <p class="font-medium">${formatVes(vehiculo.precio_ves_centavos)}</p>
                  <p class="text-xs text-apple-muted dark:text-apple-muted-dark">≈ ${formatUsd(vehiculo.precio_usd_centavos)}</p>
                </td>
                <td>${badgeForEstado(vehiculo.estado, "vehiculo")}</td>
                <td class="text-right">
                  <a href="/vehiculos/${vehiculo.id}" class="btn btn-secondary btn-sm">Ver</a>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid gap-3 md:hidden">
      ${items.map((vehiculo) => `
        <a href="/vehiculos/${vehiculo.id}" class="card block p-4">
          <div class="flex items-start gap-3">
            ${vehicleThumb(vehiculo, "size-16")}
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <p class="truncate font-medium">${escapeHtml(vehiculo.titulo)}</p>
                ${badgeForEstado(vehiculo.estado, "vehiculo")}
              </div>
              <p class="mt-1 text-xs text-apple-muted dark:text-apple-muted-dark">${vehiculo.anio} · ${formatNumber(vehiculo.kilometraje)} km</p>
              <p class="mt-2 text-sm font-semibold">${formatVes(vehiculo.precio_ves_centavos)}</p>
              <p class="text-xs text-apple-muted dark:text-apple-muted-dark">≈ ${formatUsd(vehiculo.precio_usd_centavos)}</p>
            </div>
          </div>
        </a>
      `).join("")}
    </div>
  `;
}

async function load(page = 1) {
  const params = queryParams(page);
  if (!params) return;
  currentPage = page;
  try {
    const response = await get(`/api/v1/vehiculos?${params.toString()}`);
    resultado.innerHTML = renderRows(response.data);
    renderPagination(paginacion, response.meta, (next) => load(next));
  } catch (error) {
    resultado.innerHTML = `<div class="card">${emptyState("No se pudo cargar el inventario", error.message)}</div>`;
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

load(1);
