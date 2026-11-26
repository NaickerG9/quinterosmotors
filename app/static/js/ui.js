const vesFormatter = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatVes(cents) {
  if (cents === null || cents === undefined || Number.isNaN(Number(cents))) return "—";
  return `Bs. ${vesFormatter.format(Number(cents) / 100)}`;
}

export function formatUsd(cents) {
  if (cents === null || cents === undefined || Number.isNaN(Number(cents))) return "—";
  return usdFormatter.format(Number(cents) / 100);
}

export function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-VE").format(value);
}

export function moneyInputValue(cents) {
  if (cents === null || cents === undefined) return "";
  return (Number(cents) / 100).toFixed(2);
}

export function parseMoneyInput(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Math.round(value * 100);
  let text = String(value).trim();
  if (!text) return null;
  text = text.replace(/[^\d.,-]/g, "");
  const negative = text.startsWith("-");
  text = text.replace(/^-/, "");
  if (!text) return null;

  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if ((text.match(/\./g) || []).length > 1) {
    text = text.replace(/\./g, "");
  } else if (text.includes(".")) {
    const [integer, decimals] = text.split(".");
    if (decimals.length === 3 && /^\d+$/.test(integer)) text = integer + decimals;
  }

  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return Math.round((negative ? -number : number) * 100);
}

export function parseRateInput(value) {
  const cents = parseMoneyInput(value);
  if (cents === null) return null;
  return cents / 100;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`);
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "—";
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : "—";
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[character];
  });
}

export function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

export function debounce(callback, wait = 300) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), wait);
  };
}

export function toast(message, type = "success") {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const styles = {
    success:
      "border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-100",
    error:
      "border-red-200 bg-red-50/95 text-red-900 dark:border-red-500/20 dark:bg-red-500/15 dark:text-red-100",
    info:
      "border-blue-200 bg-blue-50/95 text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-100",
  };
  const element = document.createElement("div");
  element.className = `pointer-events-auto animate-slide-up rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-xl ${styles[type] || styles.info}`;
  element.setAttribute("role", "status");
  element.textContent = message;
  element.addEventListener("click", () => element.remove());
  root.appendChild(element);
  window.setTimeout(() => element.remove(), 4500);
}

export function openSheet({ title, subtitle = "", body = "", footer = "", onClose = null }) {
  const root = document.getElementById("modal-root");
  if (!root) return { close: () => {}, body: null, footer: null };
  const previousActive = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop animate-fade-in";
  backdrop.dataset.sheetBackdrop = "true";

  const sheet = document.createElement("div");
  sheet.className = "sheet animate-sheet-in";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", title);
  sheet.innerHTML = `
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold tracking-tight">${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="mt-1 text-sm text-apple-muted dark:text-apple-muted-dark">${escapeHtml(subtitle)}</p>` : ""}
      </div>
      <button type="button" class="icon-btn -mr-2 -mt-2" data-sheet-close aria-label="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-5"><path d="m6 6 12 12M18 6 6 18"/></svg>
      </button>
    </div>
    <div class="mt-5" data-sheet-body></div>
    ${footer ? `<div class="mt-6 flex flex-wrap justify-end gap-2" data-sheet-footer>${footer}</div>` : ""}
  `;
  const bodyElement = sheet.querySelector("[data-sheet-body]");
  if (body instanceof HTMLElement) bodyElement.appendChild(body);
  else bodyElement.innerHTML = body;
  const footerElement = sheet.querySelector("[data-sheet-footer]");

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeydown);
    backdrop.remove();
    sheet.remove();
    document.body.style.overflow = previousOverflow;
    if (previousActive instanceof HTMLElement) previousActive.focus();
    if (typeof onClose === "function") onClose();
  }

  function onKeydown(event) {
    if (event.key === "Escape") close();
  }

  sheet.querySelector("[data-sheet-close]").addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", onKeydown);
  root.appendChild(backdrop);
  root.appendChild(sheet);

  window.setTimeout(() => {
    const first = sheet.querySelector(
      "input:not([type=hidden]), select, textarea, button:not([data-sheet-close])",
    );
    if (first) first.focus();
  }, 30);

  return { close, body: bodyElement, footer: footerElement, sheet };
}

export function confirmDialog({
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = false,
}) {
  return new Promise((resolve) => {
    let confirmed = false;
    const dialog = openSheet({
      title,
      body: `<p class="text-sm leading-relaxed text-apple-muted dark:text-apple-muted-dark">${escapeHtml(message)}</p>`,
      footer: `
        <button type="button" class="btn btn-secondary" data-cancel>${escapeHtml(cancelText)}</button>
        <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm>${escapeHtml(confirmText)}</button>
      `,
      onClose: () => resolve(confirmed),
    });
    dialog.footer.querySelector("[data-cancel]").addEventListener("click", () => {
      dialog.close();
    });
    dialog.footer.querySelector("[data-confirm]").addEventListener("click", () => {
      confirmed = true;
      dialog.close();
    });
  });
}

const BADGES = {
  vehiculo: {
    disponible:
      "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    reservado:
      "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    vendido:
      "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    archivado:
      "bg-black/5 text-apple-muted dark:bg-white/10 dark:text-apple-muted-dark",
  },
  venta: {
    apartado:
      "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    completada:
      "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    cancelada:
      "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  prospecto: {
    nuevo: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    contactado:
      "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    negociacion:
      "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    ganado:
      "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    perdido: "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
};

export function badgeForEstado(estado, tipo = "vehiculo") {
  const label = String(estado || "")
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
  const classes =
    BADGES[tipo]?.[estado] ||
    "bg-black/5 text-apple-muted dark:bg-white/10 dark:text-apple-muted-dark";
  return `<span class="badge ${classes}">${escapeHtml(label)}</span>`;
}

export function emptyState(title, text, action = "") {
  return `
    <div class="empty">
      <span class="flex size-12 items-center justify-center rounded-2xl bg-black/5 text-apple-muted dark:bg-white/10 dark:text-apple-muted-dark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-6"><path d="M4 7.5h16M4 12h16M4 16.5h10"/></svg>
      </span>
      <div>
        <p class="text-sm font-medium text-apple-ink dark:text-apple-ink-dark">${escapeHtml(title)}</p>
        <p class="mt-1 max-w-sm text-xs text-apple-muted dark:text-apple-muted-dark">${escapeHtml(text)}</p>
      </div>
      ${action}
    </div>
  `;
}

export function renderPagination(container, meta, onPage) {
  if (!container) return;
  if (!meta || meta.pages <= 1) {
    container.innerHTML = meta
      ? `<p class="text-center text-xs text-apple-muted dark:text-apple-muted-dark">${formatNumber(meta.total)} registros</p>`
      : "";
    return;
  }
  container.innerHTML = `
    <div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p class="text-xs text-apple-muted dark:text-apple-muted-dark">
        Página ${meta.page} de ${meta.pages} · ${formatNumber(meta.total)} registros
      </p>
      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-secondary btn-sm" data-prev ${meta.has_prev ? "" : "disabled"}>Anterior</button>
        <button type="button" class="btn btn-secondary btn-sm" data-next ${meta.has_next ? "" : "disabled"}>Siguiente</button>
      </div>
    </div>
  `;
  container.querySelector("[data-prev]")?.addEventListener("click", () => {
    if (meta.has_prev) onPage(meta.page - 1);
  });
  container.querySelector("[data-next]")?.addEventListener("click", () => {
    if (meta.has_next) onPage(meta.page + 1);
  });
}

export function setLoading(button, loading, loadingText = "Procesando…") {
  if (!button) return;
  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="inline-flex items-center gap-2"><span class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>${escapeHtml(loadingText)}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

export function showFormError(container, message, fields = {}) {
  if (container) {
    if (message) {
      container.textContent = message;
      container.classList.remove("hidden");
    } else {
      container.textContent = "";
      container.classList.add("hidden");
    }
  }
  Object.entries(fields || {}).forEach(([field, text]) => {
    const input = document.querySelector(`[name="${CSS.escape(field)}"]`);
    if (!input) return;
    input.classList.add("input-error");
    const error = document.createElement("p");
    error.className = "field-error";
    error.textContent = text;
    input.insertAdjacentElement("afterend", error);
  });
}

export function clearFieldErrors(form) {
  form?.querySelectorAll(".field-error").forEach((node) => node.remove());
  form?.querySelectorAll(".input-error").forEach((node) => node.classList.remove("input-error"));
}

export function vehicleThumb(vehiculo, classes = "size-14") {
  const url = vehiculo?.imagen_principal?.url;
  if (url) {
    return `<img src="${escapeHtml(url)}" alt="" loading="lazy" class="${classes} shrink-0 rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10">`;
  }
  return `<span class="${classes} flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-black/5 to-black/10 text-apple-muted ring-1 ring-black/5 dark:from-white/10 dark:to-white/5 dark:text-apple-muted-dark dark:ring-white/10">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-6"><path d="M5 16.5 6.4 11a2 2 0 0 1 1.9-1.5h7.4A2 2 0 0 1 17.6 11L19 16.5"/><path d="M4 16.5h16v2.2a.8.8 0 0 1-.8.8h-1.4a.8.8 0 0 1-.8-.8v-.7H7v.7a.8.8 0 0 1-.8.8H5.8a.8.8 0 0 1-.8-.8v-2.2Z"/></svg>
  </span>`;
}

export function valueOrDash(value) {
  return value === null || value === undefined || value === "" ? "—" : escapeHtml(value);
}
