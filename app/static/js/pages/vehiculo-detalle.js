import { api, del, get, patch, post, put } from "../api.js";
import { isAdmin } from "../auth.js";
import { buildVehiculoFormHtml, bindVehiculoForm } from "../forms/vehiculo.js";
import { compressImage } from "../images.js";
import {
  badgeForEstado,
  confirmDialog,
  escapeHtml,
  formatNumber,
  formatUsd,
  formatVes,
  openSheet,
  setLoading,
  toast,
  valueOrDash,
} from "../ui.js";

const root = document.getElementById("vehiculo-detalle");
const vehiculoId = root?.dataset.vehiculoId;
let vehiculo = null;
let catalog = null;

function labelFor(items, value) {
  return items?.find((item) => item.value === value)?.label || value || "—";
}

function infoItem(label, value) {
  return `
    <div class="rounded-xl bg-black/[0.03] p-3 dark:bg-white/5">
      <p class="text-[11px] font-medium uppercase tracking-wide text-apple-muted dark:text-apple-muted-dark">${label}</p>
      <p class="mt-1 text-sm font-medium">${valueOrDash(value)}</p>
    </div>
  `;
}

function renderHeader() {
  const container = document.getElementById("vehiculo-header");
  const archived = vehiculo.archivado
    ? `<span class="badge bg-black/5 text-apple-muted dark:bg-white/10 dark:text-apple-muted-dark">Archivado</span>`
    : "";
  container.innerHTML = `
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          ${badgeForEstado(vehiculo.estado, "vehiculo")}
          ${archived}
          ${vehiculo.destacado ? `<span class="badge bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Destacado</span>` : ""}
        </div>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">${escapeHtml(vehiculo.titulo)}</h1>
        <p class="mt-2 text-sm text-apple-muted dark:text-apple-muted-dark">${vehiculo.anio} · ${formatNumber(vehiculo.kilometraje)} km · ${escapeHtml(vehiculo.color || "Sin color")} · ${escapeHtml(vehiculo.placa || "Sin placa")}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn btn-secondary" data-edit>Editar</button>
        ${isAdmin() && !vehiculo.archivado ? `<button type="button" class="btn btn-danger" data-archive>Archivar</button>` : ""}
        <button type="button" class="btn btn-danger" data-delete>Eliminar</button>
      </div>
    </div>
  `;
  container.querySelector("[data-edit]")?.addEventListener("click", openEditSheet);
  container.querySelector("[data-archive]")?.addEventListener("click", archivar);
  container.querySelector("[data-delete]")?.addEventListener("click", eliminarVehiculo);
}

function renderBanner() {
  const container = document.getElementById("vehiculo-banner");
  const venta = vehiculo.venta_activa;
  if (!venta) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `
    <div class="flex flex-col gap-2 rounded-2xl border border-apple-line bg-white/60 px-4 py-3 text-sm backdrop-blur-xl dark:border-apple-line-dark dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-2">
        ${badgeForEstado(venta.estado, "venta")}
        <span>Este vehículo tiene una venta ${venta.estado === "apartado" ? "apartada" : "registrada"} con ${escapeHtml(venta.cliente?.nombre || "un cliente")}.</span>
      </div>
      <a href="/ventas/${venta.id}" class="btn btn-secondary btn-sm">Ver venta</a>
    </div>
  `;
}

function renderGaleria() {
  const container = document.getElementById("vehiculo-galeria");
  const images = vehiculo.imagenes || [];
  if (!images.length) {
    container.innerHTML = `
      <div class="flex aspect-[16/10] flex-col items-center justify-center gap-3 bg-gradient-to-br from-black/[0.03] to-black/[0.08] text-apple-muted dark:from-white/5 dark:to-white/10 dark:text-apple-muted-dark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" class="size-14"><path d="M5 16.5 6.4 11a2 2 0 0 1 1.9-1.5h7.4A2 2 0 0 1 17.6 11L19 16.5"/><path d="M4 16.5h16v2.2a.8.8 0 0 1-.8.8h-1.4a.8.8 0 0 1-.8-.8v-.7H7v.7a.8.8 0 0 1-.8.8H5.8a.8.8 0 0 1-.8-.8v-2.2Z"/></svg>
        <p class="text-sm">Sin fotos todavía</p>
      </div>
    `;
    return;
  }
  const principal = vehiculo.imagen_principal || images[0];
  container.innerHTML = `
    <div class="relative aspect-[16/10] bg-black/5 dark:bg-white/5">
      <img data-main-image src="${escapeHtml(principal.url)}" alt="${escapeHtml(vehiculo.titulo)}" class="size-full object-cover">
    </div>
    ${
      images.length > 1
        ? `<div class="flex gap-2 overflow-x-auto p-3">
            ${images.map((imagen) => `
              <button type="button" data-thumb data-src="${escapeHtml(imagen.url)}" class="shrink-0 overflow-hidden rounded-xl ring-2 ${imagen.id === principal.id ? "ring-apple-blue" : "ring-transparent"}">
                <img src="${escapeHtml(imagen.url)}" alt="" class="size-16 object-cover">
              </button>
            `).join("")}
          </div>`
        : ""
    }
  `;
  container.querySelectorAll("[data-thumb]").forEach((button) => {
    button.addEventListener("click", () => {
      const image = container.querySelector("[data-main-image]");
      if (image) image.src = button.dataset.src;
      container.querySelectorAll("[data-thumb]").forEach((item) => {
        item.classList.toggle("ring-apple-blue", item === button);
        item.classList.toggle("ring-transparent", item !== button);
      });
    });
  });
}

function renderInfo() {
  const container = document.getElementById("vehiculo-info");
  container.innerHTML = `
    <h2 class="text-base font-semibold tracking-tight">Especificaciones</h2>
    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      ${infoItem("Marca", vehiculo.marca)}
      ${infoItem("Modelo", vehiculo.modelo)}
      ${infoItem("Versión", vehiculo.version)}
      ${infoItem("Año", vehiculo.anio)}
      ${infoItem("Color", vehiculo.color)}
      ${infoItem("Kilometraje", `${formatNumber(vehiculo.kilometraje)} km`)}
      ${infoItem("Transmisión", labelFor(catalog.transmisiones, vehiculo.transmision))}
      ${infoItem("Combustible", labelFor(catalog.combustibles, vehiculo.combustible))}
      ${infoItem("Carrocería", labelFor(catalog.carrocerias, vehiculo.carroceria))}
      ${infoItem("VIN", vehiculo.vin)}
      ${infoItem("Placa", vehiculo.placa)}
      ${infoItem("Estado", vehiculo.estado_label || vehiculo.estado)}
    </div>
  `;
}

function renderDescripcion() {
  const container = document.getElementById("vehiculo-descripcion");
  container.innerHTML = `
    <h2 class="text-base font-semibold tracking-tight">Descripción</h2>
    <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-apple-muted dark:text-apple-muted-dark">${escapeHtml(vehiculo.descripcion || "Sin descripción registrada.")}</p>
  `;
}

function renderPrecio() {
  const container = document.getElementById("vehiculo-precio");
  const tasa = catalog.tasa;
  container.innerHTML = `
    <p class="text-xs font-medium uppercase tracking-wide text-apple-muted dark:text-apple-muted-dark">Precio de lista</p>
    <p class="mt-2 text-3xl font-semibold tracking-tight">${formatVes(vehiculo.precio_ves_centavos)}</p>
    <p class="mt-1 text-sm text-apple-muted dark:text-apple-muted-dark">≈ ${formatUsd(vehiculo.precio_usd_centavos)}</p>
    <div class="mt-4 border-t border-apple-line pt-4 text-xs text-apple-muted dark:border-apple-line-dark dark:text-apple-muted-dark">
      ${
        tasa?.configurada
          ? `Tasa aplicada: Bs. ${escapeHtml(tasa.ves_por_usd)} por 1 USD.<br>Actualizada: ${escapeHtml(tasa.created_at?.slice(0, 10) || "—")}`
          : "No hay tasa configurada. La referencia USD no está disponible."
      }
    </div>
  `;
}

function renderImagenes() {
  const container = document.getElementById("vehiculo-imagenes");
  const images = vehiculo.imagenes || [];
  const max = catalog?.max_imagenes_por_vehiculo || 6;
  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold tracking-tight">Fotos</h2>
      <span class="text-xs text-apple-muted dark:text-apple-muted-dark">${images.length}/${max}</span>
    </div>
    <div class="mt-3 space-y-2">
      ${
        images.length
          ? images.map((imagen) => `
              <div class="flex items-center gap-2 rounded-xl border border-apple-line p-2 dark:border-apple-line-dark">
                <img src="${escapeHtml(imagen.url)}" alt="" class="size-12 rounded-lg object-cover">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs">${imagen.es_principal ? "Imagen principal" : "Foto del vehículo"}</p>
                  <div class="mt-1 flex gap-2">
                    ${!imagen.es_principal ? `<button type="button" class="text-[11px] font-medium text-apple-blue dark:text-apple-blue-dark" data-principal="${imagen.id}">Hacer principal</button>` : ""}
                    <button type="button" class="text-[11px] font-medium text-red-600 dark:text-red-400" data-delete="${imagen.id}">Eliminar</button>
                  </div>
                </div>
              </div>
            `).join("")
          : `<p class="rounded-xl bg-black/[0.03] px-3 py-4 text-xs text-apple-muted dark:bg-white/5 dark:text-apple-muted-dark">Aún no hay fotos. Sube la primera imagen del vehículo.</p>`
      }
    </div>
    <div class="mt-4 space-y-2">
      <input id="imagenes-input" type="file" accept="image/jpeg,image/png,image/webp" multiple class="block w-full text-xs text-apple-muted file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-xs file:font-medium file:text-apple-ink hover:file:bg-black/10 dark:text-apple-muted-dark dark:file:bg-white/10 dark:file:text-apple-ink-dark">
      <button type="button" id="subir-imagenes" class="btn btn-secondary btn-sm w-full" ${images.length >= max ? "disabled" : ""}>Subir imágenes</button>
      <p class="hint">JPG, PNG o WebP. Máximo 5 MB por imagen y ${max} fotos por vehículo.</p>
    </div>
  `;
  container.querySelectorAll("[data-principal]").forEach((button) => {
    button.addEventListener("click", () => marcarPrincipal(Number(button.dataset.principal)));
  });
  container.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => eliminarImagen(Number(button.dataset.delete)));
  });
  container.querySelector("#subir-imagenes")?.addEventListener("click", subirImagenes);
}

function renderAdmin() {
  const container = document.getElementById("vehiculo-admin");
  if (!isAdmin()) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }
  container.classList.remove("hidden");
  container.innerHTML = `
    <h2 class="text-base font-semibold tracking-tight">Datos internos</h2>
    <div class="mt-4 space-y-3 text-sm">
      <div class="flex items-center justify-between gap-3">
        <span class="text-apple-muted dark:text-apple-muted-dark">Costo</span>
        <span class="text-right font-medium">${formatVes(vehiculo.costo_ves_centavos)}<br><span class="text-xs font-normal text-apple-muted dark:text-apple-muted-dark">≈ ${formatUsd(vehiculo.costo_usd_centavos)}</span></span>
      </div>
      <div class="flex items-center justify-between gap-3 border-t border-apple-line pt-3 dark:border-apple-line-dark">
        <span class="text-apple-muted dark:text-apple-muted-dark">Margen potencial</span>
        <span class="font-medium">${formatVes(vehiculo.margen_ves_centavos)}</span>
      </div>
    </div>
  `;
}

function render() {
  renderHeader();
  renderBanner();
  renderGaleria();
  renderInfo();
  renderDescripcion();
  renderPrecio();
  renderImagenes();
  renderAdmin();
}

async function load() {
  try {
    const [vehicleResponse, catalogResponse] = await Promise.all([
      get(`/api/v1/vehiculos/${vehiculoId}`),
      get("/api/v1/catalogos"),
    ]);
    vehiculo = vehicleResponse.data;
    catalog = catalogResponse.data;
    render();
  } catch (error) {
    document.getElementById("vehiculo-header").innerHTML = `
      <div class="card p-6 text-sm text-red-600 dark:text-red-400">${escapeHtml(error.message || "No se pudo cargar el vehículo.")}</div>
    `;
  }
}

function openEditSheet() {
  const sheet = openSheet({
    title: "Editar vehículo",
    subtitle: vehiculo.titulo,
    body: buildVehiculoFormHtml(vehiculo, catalog, isAdmin()),
  });
  const form = sheet.body.querySelector("#vehiculo-form");
  const cancel = form.querySelector("a.btn-secondary");
  cancel?.addEventListener("click", (event) => {
    event.preventDefault();
    sheet.close();
  });
  bindVehiculoForm(form, {
    catalog,
    isAdmin: isAdmin(),
    onSubmit: async (payload) => {
      await put(`/api/v1/vehiculos/${vehiculo.id}`, payload);
      toast("Vehículo actualizado.");
      sheet.close();
      await load();
    },
  });
}

async function archivar() {
  const confirmed = await confirmDialog({
    title: "Archivar vehículo",
    message: "El vehículo dejará de aparecer en el inventario activo. Las ventas históricas se conservan.",
    confirmText: "Archivar",
    danger: true,
  });
  if (!confirmed) return;
  try {
    await post(`/api/v1/vehiculos/${vehiculo.id}/archivar`);
    toast("Vehículo archivado.");
    await load();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function eliminarVehiculo() {
  const confirmed = await confirmDialog({
    title: "Eliminar vehículo",
    message: "El registro y sus fotos se eliminarán. No se puede deshacer. Los vehículos con ventas registradas no se pueden eliminar; puedes archivarlos.",
    confirmText: "Eliminar",
    danger: true,
  });
  if (!confirmed) return;
  try {
    await del(`/api/v1/vehiculos/${vehiculo.id}`);
    toast("Vehículo eliminado.");
    window.location.assign("/vehiculos");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function marcarPrincipal(imagenId) {
  try {
    await patch(`/api/v1/vehiculos/${vehiculo.id}/imagenes/${imagenId}/principal`);
    toast("Imagen principal actualizada.");
    await load();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function eliminarImagen(imagenId) {
  const confirmed = await confirmDialog({
    title: "Eliminar imagen",
    message: "Esta acción elimina el archivo del servidor y no se puede deshacer.",
    confirmText: "Eliminar",
    danger: true,
  });
  if (!confirmed) return;
  try {
    await del(`/api/v1/vehiculos/${vehiculo.id}/imagenes/${imagenId}`);
    toast("Imagen eliminada.");
    await load();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function subirImagenes() {
  const input = document.getElementById("imagenes-input");
  const button = document.getElementById("subir-imagenes");
  const files = Array.from(input?.files || []);
  const max = catalog?.max_imagenes_por_vehiculo || 6;
  if (!files.length) {
    toast("Selecciona al menos una imagen.", "error");
    return;
  }
  if ((vehiculo.imagenes?.length || 0) + files.length > max) {
    toast(`Máximo ${max} imágenes por vehículo.`, "error");
    return;
  }
  setLoading(button, true, "Subiendo…");
  try {
    const formData = new FormData();
    for (const file of files) {
      const compressed = await compressImage(file);
      formData.append("archivos", compressed, compressed.name || file.name);
    }
    await api(`/api/v1/vehiculos/${vehiculo.id}/imagenes`, {
      method: "POST",
      formData,
    });
    toast(`${files.length} ${files.length === 1 ? "imagen subida" : "imágenes subidas"}.`);
    if (input) input.value = "";
    await load();
  } catch (error) {
    toast(error.message, "error");
    setLoading(button, false);
  }
}

load();
