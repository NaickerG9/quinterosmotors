import { get, put } from "../api.js";
import {
  emptyState,
  escapeHtml,
  formatDateTime,
  formatNumber,
  parseRateInput,
  setLoading,
  toast,
} from "../ui.js";

const tasaActual = document.getElementById("config-tasa-actual");
const historial = document.getElementById("config-tasa-historial");
const form = document.getElementById("tasa-form");
const input = document.getElementById("tasa-input");
const errorBox = document.getElementById("tasa-error");
const submit = form?.querySelector("button[type=submit]");

function renderActual(tasa) {
  if (!tasa?.configurada) {
    tasaActual.innerHTML = `
      <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
        <p class="font-medium">Sin tasa configurada</p>
        <p class="mt-1 text-xs">Registra la tasa VES/USD para habilitar las ventas.</p>
      </div>
    `;
    return;
  }
  tasaActual.innerHTML = `
    <p class="text-3xl font-semibold tracking-tight">Bs. ${formatNumber(tasa.ves_por_usd)}</p>
    <p class="mt-1 text-xs text-apple-muted dark:text-apple-muted-dark">por 1 USD · ${escapeHtml(tasa.fuente || "manual")}</p>
    <p class="mt-3 text-xs text-apple-muted dark:text-apple-muted-dark">Actualizada: ${formatDateTime(tasa.created_at)}</p>
    ${tasa.usuario ? `<p class="text-xs text-apple-muted dark:text-apple-muted-dark">Por: ${escapeHtml(tasa.usuario)}</p>` : ""}
    ${
      tasa.es_vencida
        ? `<p class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">${escapeHtml(tasa.advertencia || "La tasa está vencida.")}</p>`
        : ""
    }
  `;
  if (input && !input.value) input.value = Number(tasa.ves_por_usd).toFixed(2).replace(".", ",");
}

function renderHistorial(items) {
  if (!items.length) {
    historial.innerHTML = emptyState("Sin historial", "Cuando actualices la tasa verás aquí cada cambio.");
    return;
  }
  historial.innerHTML = `
    <div class="divide-y divide-apple-line dark:divide-apple-line-dark">
      ${items
        .map(
          (tasa, index) => `
        <div class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div class="flex items-center gap-3">
            <span class="flex size-8 items-center justify-center rounded-full ${index === 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-black/5 text-apple-muted dark:bg-white/10 dark:text-apple-muted-dark"} text-[11px] font-semibold">${index === 0 ? "•" : index + 1}</span>
            <div>
              <p class="text-sm font-medium">Bs. ${formatNumber(tasa.ves_por_usd)} <span class="text-xs font-normal text-apple-muted dark:text-apple-muted-dark">/ USD</span></p>
              <p class="text-xs text-apple-muted dark:text-apple-muted-dark">${formatDateTime(tasa.created_at)}${tasa.usuario ? ` · ${escapeHtml(tasa.usuario)}` : ""}</p>
            </div>
          </div>
          ${index === 0 ? `<span class="badge bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Vigente</span>` : ""}
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function showError(message) {
  if (!errorBox) return;
  errorBox.textContent = message || "";
  errorBox.classList.toggle("hidden", !message);
}

async function loadActual() {
  try {
    const response = await get("/api/v1/tasa");
    renderActual(response.data);
  } catch (error) {
    tasaActual.innerHTML = `<p class="text-sm text-red-600 dark:text-red-400">${escapeHtml(error.message)}</p>`;
  }
}

async function loadHistorial() {
  try {
    const response = await get("/api/v1/tasa/historial?per_page=10");
    renderHistorial(response.data);
  } catch (error) {
    historial.innerHTML = `<p class="text-sm text-red-600 dark:text-red-400">${escapeHtml(error.message)}</p>`;
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  const rate = parseRateInput(input?.value);
  if (!rate || rate <= 0) {
    showError("Ingresa una tasa válida mayor que cero.");
    input?.focus();
    return;
  }
  setLoading(submit, true, "Actualizando…");
  try {
    await put("/api/v1/tasa", { ves_por_usd: Number(rate) });
    toast("Tasa actualizada.");
    if (input) input.value = "";
    await Promise.all([loadActual(), loadHistorial()]);
  } catch (error) {
    showError(error.message || "No se pudo actualizar la tasa.");
  } finally {
    setLoading(submit, false);
  }
});

loadActual();
loadHistorial();
