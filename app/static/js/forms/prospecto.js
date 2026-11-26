import { escapeHtml } from "../ui.js";

function options(items, selected) {
  return (items || [])
    .map(
      (item) =>
        `<option value="${escapeHtml(item.value)}" ${item.value === selected ? "selected" : ""}>${escapeHtml(item.label)}</option>`,
    )
    .join("");
}

function vehiculoOptions(vehiculos, selected) {
  return (vehiculos || [])
    .map(
      (vehiculo) =>
        `<option value="${vehiculo.id}" ${Number(selected) === vehiculo.id ? "selected" : ""}>${escapeHtml(vehiculo.titulo)} · ${vehiculo.anio}</option>`,
    )
    .join("");
}

export function buildProspectoFormHtml(prospecto = {}, { catalog = {}, vehiculos = [] } = {}) {
  return `
    <form id="prospecto-form" class="space-y-4" novalidate>
      <div id="prospecto-form-error" class="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300" role="alert"></div>
      <div>
        <label class="label" for="pr-nombre">Nombre completo *</label>
        <input id="pr-nombre" name="nombre" class="input" required value="${escapeHtml(prospecto.nombre || "")}" placeholder="José Martínez">
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="pr-telefono">Teléfono</label>
          <input id="pr-telefono" name="telefono" class="input" value="${escapeHtml(prospecto.telefono || "")}" placeholder="+58 412-555-0101">
        </div>
        <div>
          <label class="label" for="pr-email">Correo electrónico</label>
          <input id="pr-email" name="email" type="email" class="input" value="${escapeHtml(prospecto.email || "")}" placeholder="prospecto@correo.com">
        </div>
      </div>
      <p class="hint -mt-2">Registra al menos un teléfono o correo.</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="pr-origen">Origen</label>
          <select id="pr-origen" name="origen" class="input">
            ${options(catalog.origenes_prospecto, prospecto.origen || "presencial")}
          </select>
        </div>
        <div>
          <label class="label" for="pr-estado">Estado</label>
          <select id="pr-estado" name="estado" class="input">
            ${options(catalog.estados_prospecto, prospecto.estado || "nuevo")}
          </select>
        </div>
      </div>
      <div>
        <label class="label" for="pr-vehiculo">Vehículo de interés</label>
        <select id="pr-vehiculo" name="vehiculo_id" class="input">
          <option value="">Sin vehículo específico</option>
          ${vehiculoOptions(vehiculos, prospecto.vehiculo?.id)}
        </select>
      </div>
      <div>
        <label class="label" for="pr-mensaje">Mensaje / interés</label>
        <textarea id="pr-mensaje" name="mensaje" rows="3" class="input" placeholder="Qué busca, consultas, presupuesto…">${escapeHtml(prospecto.mensaje || "")}</textarea>
      </div>
      <div>
        <label class="label" for="pr-notas">Notas internas</label>
        <textarea id="pr-notas" name="notas" rows="3" class="input" placeholder="Seguimiento, próximos pasos…">${escapeHtml(prospecto.notas || "")}</textarea>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-primary" data-submit>Guardar prospecto</button>
      </div>
    </form>
  `;
}

export function readProspectoForm(form) {
  const data = new FormData(form);
  const vehiculoId = String(data.get("vehiculo_id") || "").trim();
  return {
    nombre: String(data.get("nombre") || "").trim(),
    telefono: String(data.get("telefono") || "").trim() || null,
    email: String(data.get("email") || "").trim() || null,
    origen: String(data.get("origen") || "presencial"),
    estado: String(data.get("estado") || "nuevo"),
    vehiculo_id: vehiculoId ? Number(vehiculoId) : null,
    mensaje: String(data.get("mensaje") || "").trim() || null,
    notas: String(data.get("notas") || "").trim() || null,
  };
}
