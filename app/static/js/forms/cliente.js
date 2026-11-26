import { escapeHtml } from "../ui.js";

export function buildClienteFormHtml(cliente = {}) {
  return `
    <form id="cliente-form" class="space-y-4" novalidate>
      <div id="cliente-form-error" class="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300" role="alert"></div>
      <div>
        <label class="label" for="cl-nombre">Nombre completo *</label>
        <input id="cl-nombre" name="nombre" class="input" required value="${escapeHtml(cliente.nombre || "")}" placeholder="María Pérez">
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="cl-documento">Documento</label>
          <input id="cl-documento" name="documento" class="input" value="${escapeHtml(cliente.documento || "")}" placeholder="V-12345678">
        </div>
        <div>
          <label class="label" for="cl-telefono">Teléfono</label>
          <input id="cl-telefono" name="telefono" class="input" value="${escapeHtml(cliente.telefono || "")}" placeholder="+58 412-555-0101">
        </div>
      </div>
      <div>
        <label class="label" for="cl-email">Correo electrónico</label>
        <input id="cl-email" name="email" type="email" class="input" value="${escapeHtml(cliente.email || "")}" placeholder="cliente@correo.com">
      </div>
      <div>
        <label class="label" for="cl-direccion">Dirección</label>
        <input id="cl-direccion" name="direccion" class="input" value="${escapeHtml(cliente.direccion || "")}" placeholder="Ciudad, sector…">
      </div>
      <div>
        <label class="label" for="cl-notas">Notas</label>
        <textarea id="cl-notas" name="notas" rows="3" class="input" placeholder="Preferencias, seguimiento…">${escapeHtml(cliente.notas || "")}</textarea>
      </div>
      ${
        cliente.id
          ? `<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="activo" class="size-4 rounded border-apple-line text-apple-blue" ${cliente.activo ? "checked" : ""}> Cliente activo</label>`
          : ""
      }
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-primary" data-submit>Guardar cliente</button>
      </div>
    </form>
  `;
}

export function readClienteForm(form, { includeActivo = false } = {}) {
  const data = new FormData(form);
  const payload = {
    nombre: String(data.get("nombre") || "").trim(),
    documento: String(data.get("documento") || "").trim() || null,
    telefono: String(data.get("telefono") || "").trim() || null,
    email: String(data.get("email") || "").trim() || null,
    direccion: String(data.get("direccion") || "").trim() || null,
    notas: String(data.get("notas") || "").trim() || null,
  };
  if (includeActivo) payload.activo = Boolean(form.querySelector('[name="activo"]')?.checked);
  return payload;
}
