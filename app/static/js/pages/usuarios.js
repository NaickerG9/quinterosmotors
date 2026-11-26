import { del, get, post, put } from "../api.js";
import {
  clearFieldErrors,
  confirmDialog,
  emptyState,
  escapeHtml,
  initials,
  openSheet,
  renderPagination,
  setLoading,
  showFormError,
  toast,
} from "../ui.js";

const form = document.getElementById("filtros-usuarios");
const resultado = document.getElementById("usuarios-resultado");
const paginacion = document.getElementById("usuarios-paginacion");
const rolActual = document.body.dataset.userRole || "";
const nombreActual = document.body.dataset.userName || "";
let query = "";
let rolFiltro = "";

function rolLabel(rol) {
  return rol === "admin" ? "Administrador" : "Vendedor";
}

function rolBadge(rol) {
  const classes =
    rol === "admin"
      ? "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
      : "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  return `<span class="badge ${classes}">${escapeHtml(rolLabel(rol))}</span>`;
}

function estadoBadge(activo) {
  const classes = activo
    ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    : "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  return `<span class="badge ${classes}">${activo ? "Activo" : "Inactivo"}</span>`;
}

function buildFormHtml(usuario) {
  const editando = Boolean(usuario);
  return `
    <form id="usuario-form" class="space-y-4" novalidate>
      <div>
        <label class="label" for="u-nombre">Nombre completo</label>
        <input id="u-nombre" name="nombre" type="text" class="input" value="${escapeHtml(usuario?.nombre || "")}" placeholder="Ej. Ana Administradora" required>
      </div>
      <div>
        <label class="label" for="u-email">Correo electrónico</label>
        <input id="u-email" name="email" type="email" class="input" value="${escapeHtml(usuario?.email || "")}" placeholder="nombre@quinteros.local" required>
      </div>
      <div>
        <label class="label" for="u-rol">Rol</label>
        <select id="u-rol-form" name="rol" class="input">
          <option value="vendedor" ${usuario?.rol === "vendedor" ? "selected" : ""}>Vendedor</option>
          <option value="admin" ${usuario?.rol === "admin" ? "selected" : ""}>Administrador</option>
        </select>
        <p class="hint">El administrador puede gestionar tasa, costos y usuarios.</p>
      </div>
      ${
        editando
          ? ""
          : `<div>
        <label class="label" for="u-password">Contraseña temporal</label>
        <input id="u-password" name="password" type="text" class="input" value="Temp123!" required>
        <p class="hint">Mínimo 8 caracteres. Compártela con el usuario y pídele cambiarla.</p>
      </div>`
      }
      ${
        editando
          ? `<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-apple-line p-3 text-sm dark:border-apple-line-dark">
        <input name="activo" type="checkbox" class="size-4 accent-[#0a84ff]" ${usuario.activo ? "checked" : ""}>
        <span>Cuenta activa</span>
      </label>`
          : ""
      }
      <div id="usuario-form-error" class="hidden field-error"></div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-primary" data-submit>${editando ? "Guardar cambios" : "Crear usuario"}</button>
      </div>
    </form>
  `;
}

function openUsuarioForm(usuario = null) {
  const sheet = openSheet({
    title: usuario ? "Editar usuario" : "Nuevo usuario",
    subtitle: usuario
      ? `${usuario.nombre} · ${rolLabel(usuario.rol)}`
      : "Crea una cuenta de acceso con su rol.",
    body: buildFormHtml(usuario),
  });
  const usuarioForm = sheet.body.querySelector("#usuario-form");
  const errorBox = sheet.body.querySelector("#usuario-form-error");
  const submit = sheet.body.querySelector("[data-submit]");
  sheet.body.querySelector("[data-cancel]").addEventListener("click", sheet.close);

  usuarioForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors(usuarioForm);
    showFormError(errorBox, "");
    const data = new FormData(usuarioForm);
    const payload = {
      nombre: String(data.get("nombre") || "").trim(),
      email: String(data.get("email") || "").trim(),
      rol: String(data.get("rol") || "vendedor"),
    };
    if (!usuario) payload.password = String(data.get("password") || "");
    else payload.activo = data.get("activo") === "on";

    if (!payload.nombre || !payload.email) {
      showFormError(errorBox, "Nombre y correo son obligatorios.");
      return;
    }

    setLoading(submit, true, "Guardando…");
    try {
      if (usuario) await put(`/api/v1/usuarios/${usuario.id}`, payload);
      else await post("/api/v1/usuarios", payload);
      sheet.close();
      toast(usuario ? "Usuario actualizado." : "Usuario creado.");
      await load(1);
    } catch (error) {
      showFormError(errorBox, error.message, error.fields);
      setLoading(submit, false);
    }
  });
}

function renderRows(items) {
  if (!items.length) {
    return `<div class="card">${emptyState("No hay usuarios", "Ajusta los filtros o crea el primer usuario.")}</div>`;
  }
  const fila = (usuario) => {
    const esActual = usuario.nombre === nombreActual;
    return `
      <tr>
        <td>
          <div class="flex items-center gap-3">
            <span class="flex size-10 items-center justify-center rounded-full bg-apple-blue/10 text-xs font-semibold text-apple-blue dark:bg-apple-blue-dark/15 dark:text-apple-blue-dark">${escapeHtml(initials(usuario.nombre))}</span>
            <div>
              <p class="font-medium">${escapeHtml(usuario.nombre)} ${esActual ? '<span class="text-xs text-apple-muted dark:text-apple-muted-dark">(tú)</span>' : ""}</p>
              <p class="text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(usuario.email)}</p>
            </div>
          </div>
        </td>
        <td>${rolBadge(usuario.rol)}</td>
        <td>${estadoBadge(usuario.activo)}</td>
        <td class="text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml((usuario.created_at || "").slice(0, 10) || "—")}</td>
        <td class="text-right">
          <div class="flex justify-end gap-2">
            <button type="button" class="btn btn-secondary btn-sm" data-edit="${usuario.id}">Editar</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete="${usuario.id}" ${esActual ? "disabled" : ""}>Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  };
  return `
    <div class="card hidden overflow-hidden md:block">
      <div class="overflow-x-auto">
        <table class="table-apple">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Alta</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>${items.map(fila).join("")}</tbody>
        </table>
      </div>
    </div>
    <div class="grid gap-3 md:hidden">
      ${items.map((usuario) => {
        const esActual = usuario.nombre === nombreActual;
        return `
          <div class="card p-4">
            <div class="flex items-start gap-3">
              <span class="flex size-10 items-center justify-center rounded-full bg-apple-blue/10 text-xs font-semibold text-apple-blue dark:bg-apple-blue-dark/15 dark:text-apple-blue-dark">${escapeHtml(initials(usuario.nombre))}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">${escapeHtml(usuario.nombre)} ${esActual ? "(tú)" : ""}</p>
                <p class="truncate text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(usuario.email)}</p>
                <div class="mt-2 flex gap-2">${rolBadge(usuario.rol)}${estadoBadge(usuario.activo)}</div>
              </div>
            </div>
            <div class="mt-3 flex justify-end gap-2">
              <button type="button" class="btn btn-secondary btn-sm" data-edit="${usuario.id}">Editar</button>
              <button type="button" class="btn btn-danger btn-sm" data-delete="${usuario.id}" ${esActual ? "disabled" : ""}>Eliminar</button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function bindRows(items) {
  resultado.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.edit);
      try {
        const response = await get(`/api/v1/usuarios/${id}`);
        openUsuarioForm(response.data);
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
  resultado.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.delete);
      const usuario = items.find((item) => item.id === id);
      const confirmado = await confirmDialog({
        title: "Eliminar usuario",
        message: `¿Eliminar a ${usuario?.nombre || "este usuario"}? Esta acción no se puede deshacer.`,
        confirmText: "Eliminar",
        danger: true,
      });
      if (!confirmado) return;
      try {
        await del(`/api/v1/usuarios/${id}`);
        toast("Usuario eliminado.");
        await load(1);
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

async function load(page = 1) {
  const params = new URLSearchParams({ page: String(page), per_page: "15" });
  if (query) params.set("q", query);
  if (rolFiltro) params.set("rol", rolFiltro);
  try {
    const response = await get(`/api/v1/usuarios?${params.toString()}`);
    resultado.innerHTML = renderRows(response.data);
    bindRows(response.data);
    renderPagination(paginacion, response.meta, (next) => load(next));
  } catch (error) {
    resultado.innerHTML = `<div class="card p-6 text-sm text-red-600 dark:text-red-400">${escapeHtml(error.message)}</div>`;
  }
}

document.getElementById("nuevo-usuario")?.addEventListener("click", () => openUsuarioForm());
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  query = String(data.get("q") || "").trim();
  rolFiltro = String(data.get("rol") || "");
  load(1);
});
form?.addEventListener("reset", () => {
  window.setTimeout(() => {
    query = "";
    rolFiltro = "";
    load(1);
  }, 0);
});

if (rolActual === "admin") load();
else resultado.innerHTML = `<div class="card">${emptyState("Sin permiso", "Solo un administrador puede gestionar usuarios.")}</div>`;
