import { get } from "../api.js";
import { isAdmin } from "../auth.js";
import {
  badgeForEstado,
  emptyState,
  escapeHtml,
  formatDateTime,
  formatNumber,
  formatUsd,
  formatVes,
  vehicleThumb,
} from "../ui.js";

const root = {
  kpis: document.getElementById("dashboard-kpis"),
  actions: document.getElementById("dashboard-actions"),
  vehiculos: document.getElementById("dashboard-vehiculos"),
  tasa: document.getElementById("dashboard-tasa"),
  top: document.getElementById("dashboard-top-modelos"),
  prospectos: document.getElementById("dashboard-prospectos"),
  ventas: document.getElementById("dashboard-ultimas-ventas"),
  recientes: document.getElementById("dashboard-ultimos-prospectos"),
};

function kpi(label, value, sub, icon) {
  return `
    <div class="card p-5">
      <div class="flex items-start justify-between gap-3">
        <p class="text-xs font-medium uppercase tracking-wide text-apple-muted dark:text-apple-muted-dark">${label}</p>
        <span class="flex size-9 items-center justify-center rounded-xl bg-apple-blue/10 text-apple-blue dark:bg-apple-blue-dark/15 dark:text-apple-blue-dark">
          ${icon}
        </span>
      </div>
      <p class="stat-value mt-3">${value}</p>
      <p class="mt-1 text-xs text-apple-muted dark:text-apple-muted-dark">${sub}</p>
    </div>
  `;
}

const icons = {
  car: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-5"><path d="M5 16.5 6.4 11a2 2 0 0 1 1.9-1.5h7.4A2 2 0 0 1 17.6 11L19 16.5"/><path d="M4 16.5h16v2.2a.8.8 0 0 1-.8.8h-1.4a.8.8 0 0 1-.8-.8v-.7H7v.7a.8.8 0 0 1-.8.8H5.8a.8.8 0 0 1-.8-.8v-2.2Z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-5"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`,
  receipt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-5"><path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2v-17Z"/><path d="M9 8h6M9 12h6"/></svg>`,
  money: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-5"><rect x="3.5" y="6.5" width="17" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M7 9.5h.01M17 14.5h.01"/></svg>`,
};

function renderKpis(data) {
  const v = data.vehiculos;
  const s = data.ventas;
  root.kpis.innerHTML = [
    kpi("En stock", formatNumber(v.stock ?? 0), "Disponibles + reservados", icons.car),
    kpi("Disponibles", formatNumber(v.por_estado.disponible || 0), "Listos para vender", icons.clock),
    kpi("Ventas del mes", formatNumber(s.cantidad), "Ventas completadas", icons.receipt),
    kpi("Ingresos del mes", formatVes(s.ingresos_ves_centavos), formatUsd(s.ingresos_usd_centavos), icons.money),
  ].join("");
}

function renderActions() {
  root.actions.innerHTML = `
    <a href="/ventas/nueva" class="btn btn-primary">Nueva venta</a>
    <a href="/vehiculos/nuevo" class="btn btn-secondary">Nuevo vehículo</a>
  `;
}

function renderTasa(tasa) {
  if (!tasa?.configurada) {
    root.tasa.innerHTML = `
      <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
        <p class="font-medium">Tasa no configurada</p>
        <p class="mt-1 text-xs">Las ventas están bloqueadas hasta registrar una tasa VES/USD.</p>
        ${isAdmin() ? `<a href="/configuracion" class="btn btn-secondary btn-sm mt-3">Configurar tasa</a>` : ""}
      </div>
    `;
    return;
  }
  root.tasa.innerHTML = `
    <div>
      <p class="text-2xl font-semibold tracking-tight">Bs. ${formatNumber(tasa.ves_por_usd)}</p>
      <p class="mt-1 text-xs text-apple-muted dark:text-apple-muted-dark">por 1 USD · ${escapeHtml(tasa.fuente || "manual")}</p>
    </div>
    <div class="mt-4 space-y-1 text-xs text-apple-muted dark:text-apple-muted-dark">
      <p>Actualizada: ${formatDateTime(tasa.created_at)}</p>
      ${tasa.usuario ? `<p>Por: ${escapeHtml(tasa.usuario)}</p>` : ""}
    </div>
    ${tasa.es_vencida ? `<p class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">${escapeHtml(tasa.advertencia || "La tasa está vencida.")}</p>` : ""}
  `;
}

function bar(label, value, total, colorClass) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return `
    <div>
      <div class="flex items-center justify-between text-sm">
        <span class="font-medium">${label}</span>
        <span class="text-apple-muted dark:text-apple-muted-dark">${formatNumber(value)} · ${percent}%</span>
      </div>
      <div class="mt-2 h-2.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div class="h-full rounded-full ${colorClass}" style="width:${percent}%"></div>
      </div>
    </div>
  `;
}

function renderVehiculos(data) {
  const v = data.vehiculos;
  const total = v.total || 0;
  const margen = v.margen_inventario_ves_centavos === null
    ? "N/A"
    : formatVes(v.margen_inventario_ves_centavos);
  const notaSinCosto = v.sin_costo
    ? `<p class="mt-3 text-[11px] text-apple-muted dark:text-apple-muted-dark">${formatNumber(v.sin_costo)} sin costo registrado: no se incluyen en el margen.</p>`
    : "";
  const adminExtra = isAdmin() && v.costo_inventario_ves_centavos !== undefined
    ? `<div class="mt-4 grid grid-cols-2 gap-3 border-t border-apple-line pt-4 text-xs dark:border-apple-line-dark">
        <div><p class="text-apple-muted dark:text-apple-muted-dark">Costo inventario</p><p class="mt-1 font-medium">${formatVes(v.costo_inventario_ves_centavos)}</p></div>
        <div><p class="text-apple-muted dark:text-apple-muted-dark">Margen potencial</p><p class="mt-1 font-medium">${margen}</p></div>
      </div>${notaSinCosto}`
    : "";
  root.vehiculos.innerHTML = `
    <div class="grid gap-5 sm:grid-cols-3">
      <div><p class="text-xs text-apple-muted dark:text-apple-muted-dark">Disponibles</p><p class="mt-1 text-2xl font-semibold">${formatNumber(v.por_estado.disponible || 0)}</p></div>
      <div><p class="text-xs text-apple-muted dark:text-apple-muted-dark">Reservados</p><p class="mt-1 text-2xl font-semibold">${formatNumber(v.por_estado.reservado || 0)}</p></div>
      <div><p class="text-xs text-apple-muted dark:text-apple-muted-dark">Vendidos</p><p class="mt-1 text-2xl font-semibold">${formatNumber(v.por_estado.vendido || 0)}</p></div>
    </div>
    <div class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-4 py-3 text-xs dark:bg-white/5">
      <span class="text-apple-muted dark:text-apple-muted-dark">Total en stock</span>
      <span class="font-semibold">${formatNumber(v.stock ?? 0)} <span class="font-normal text-apple-muted dark:text-apple-muted-dark">de ${formatNumber(total)} registros activos</span></span>
    </div>
    <div class="mt-5 space-y-4">
      ${bar("Disponibles", v.por_estado.disponible || 0, total, "bg-emerald-500")}
      ${bar("Reservados", v.por_estado.reservado || 0, total, "bg-amber-500")}
      ${bar("Vendidos", v.por_estado.vendido || 0, total, "bg-blue-500")}
    </div>
    <div class="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-4 py-3 text-xs dark:bg-white/5">
      <span class="text-apple-muted dark:text-apple-muted-dark">Valor del inventario disponible</span>
      <span class="font-semibold">${formatVes(v.valor_inventario_ves_centavos)} <span class="font-normal text-apple-muted dark:text-apple-muted-dark">≈ ${formatUsd(v.valor_inventario_usd_centavos)}</span></span>
    </div>
    ${adminExtra}
  `;
}

function renderTopModelos(data) {
  const items = data.top_modelos || [];
  if (!items.length) {
    root.top.innerHTML = emptyState("Sin ventas en el período", "Cuando cierres ventas verás aquí los modelos más vendidos.");
    return;
  }
  root.top.innerHTML = `
    <ol class="divide-y divide-apple-line dark:divide-apple-line-dark">
      ${items.map((item, index) => `
        <li class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span class="flex size-7 items-center justify-center rounded-full bg-black/5 text-xs font-semibold dark:bg-white/10">${index + 1}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">${escapeHtml(item.marca)} ${escapeHtml(item.modelo)}</p>
            <p class="text-xs text-apple-muted dark:text-apple-muted-dark">${formatNumber(item.ventas)} ${item.ventas === 1 ? "venta" : "ventas"}</p>
          </div>
          <p class="text-xs font-medium">${formatVes(item.ingresos_ves_centavos)}</p>
        </li>
      `).join("")}
    </ol>
  `;
}

function renderProspectos(data) {
  const p = data.prospectos;
  const orden = ["nuevo", "contactado", "negociacion", "ganado", "perdido"];
  const labels = {
    nuevo: "Nuevo",
    contactado: "Contactado",
    negociacion: "En negociación",
    ganado: "Ganado",
    perdido: "Perdido",
  };
  const total = p.total || 0;
  root.prospectos.innerHTML = `
    <div class="flex items-end justify-between">
      <p class="text-2xl font-semibold">${formatNumber(total)}</p>
      <p class="text-xs text-apple-muted dark:text-apple-muted-dark">prospectos en el período</p>
    </div>
    <div class="mt-5 space-y-4">
      ${orden.map((estado) => bar(labels[estado], p.por_estado[estado] || 0, total, estado === "ganado" ? "bg-emerald-500" : estado === "perdido" ? "bg-red-400" : "bg-apple-blue")).join("")}
    </div>
  `;
}

function renderVentas(data) {
  const items = data.ultimas_ventas || [];
  if (!items.length) {
    root.ventas.innerHTML = emptyState("Aún no hay ventas", "Registra la primera venta para verla aquí.");
    return;
  }
  root.ventas.innerHTML = `
    <div class="divide-y divide-apple-line dark:divide-apple-line-dark">
      ${items.map((venta) => `
        <a href="/ventas/${venta.id}" class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          ${vehicleThumb(venta.vehiculo, "size-11")}
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">${escapeHtml(venta.vehiculo?.titulo || "Vehículo")}</p>
            <p class="truncate text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(venta.cliente?.nombre || "Cliente")} · ${formatDateTime(venta.created_at)}</p>
          </div>
          <div class="text-right">
            <p class="text-xs font-semibold">${formatVes(venta.precio_final_ves_centavos)}</p>
            <p class="text-[11px] text-apple-muted dark:text-apple-muted-dark">≈ ${formatUsd(venta.precio_usd_centavos)}</p>
          </div>
          <div class="hidden sm:block">${badgeForEstado(venta.estado, "venta")}</div>
        </a>
      `).join("")}
    </div>
  `;
}

function renderRecientes(data) {
  const items = data.ultimos_prospectos || [];
  if (!items.length) {
    root.recientes.innerHTML = emptyState("Sin prospectos", "Registra el primer contacto para comenzar el embudo.");
    return;
  }
  root.recientes.innerHTML = `
    <div class="divide-y divide-apple-line dark:divide-apple-line-dark">
      ${items.map((prospecto) => `
        <div class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/5 text-xs font-semibold dark:bg-white/10">${escapeHtml((prospecto.nombre || "?")[0])}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">${escapeHtml(prospecto.nombre)}</p>
            <p class="truncate text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(prospecto.telefono || prospecto.email || "Sin contacto")} · ${formatDateTime(prospecto.created_at)}</p>
          </div>
          ${badgeForEstado(prospecto.estado, "prospecto")}
        </div>
      `).join("")}
    </div>
  `;
}

async function init() {
  renderActions();
  try {
    const response = await get("/api/v1/dashboard/resumen");
    const data = response.data;
    renderKpis(data);
    renderTasa(data.tasa);
    renderVehiculos(data);
    renderTopModelos(data);
    renderProspectos(data);
    renderVentas(data);
    renderRecientes(data);
  } catch (error) {
    if (root.kpis) {
      root.kpis.innerHTML = `<div class="card p-5 sm:col-span-2 xl:col-span-4">${emptyState("No se pudo cargar el dashboard", error.message)}</div>`;
    }
  }
}

init();
