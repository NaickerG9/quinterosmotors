import { escapeHtml, formatUsd, parseMoneyInput } from "../ui.js";

function localDateTimeValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function buildVentaFormHtml({ vehiculos = [], clientes = [], catalog = {}, tasa = null }) {
  const rate = tasa?.configurada ? Number(tasa.ves_por_usd) : null;
  const fechaPorDefecto = localDateTimeValue();
  return `
    <form id="venta-form" class="space-y-6" novalidate>
      <div id="venta-form-error" class="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300" role="alert"></div>

      ${
        rate
          ? `<div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-apple-line bg-white/60 px-4 py-3 text-sm backdrop-blur-xl dark:border-apple-line-dark dark:bg-white/5">
              <span class="text-apple-muted dark:text-apple-muted-dark">Tasa aplicada</span>
              <span class="font-medium">Bs. ${escapeHtml(tasa.ves_por_usd)} por 1 USD</span>
            </div>`
          : `<div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              No hay tasa configurada. Un administrador debe registrarla antes de vender.
            </div>`
      }

      <section class="card p-5">
        <h2 class="text-base font-semibold tracking-tight">Vehículo y cliente</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="vehiculo_id">Vehículo *</label>
            <select id="vehiculo_id" name="vehiculo_id" class="input" required>
              <option value="">Selecciona un vehículo…</option>
              ${vehiculos
                .map(
                  (vehiculo) => `
                <option value="${vehiculo.id}" data-precio="${vehiculo.precio_ves_centavos}">
                  ${escapeHtml(vehiculo.titulo)} · ${vehiculo.anio} · ${escapeHtml(vehiculo.placa || "sin placa")}
                </option>
              `,
                )
                .join("")}
            </select>
            ${
              vehiculos.length
                ? `<p class="hint">${vehiculos.length} ${vehiculos.length === 1 ? "vehículo disponible" : "vehículos disponibles"}.</p>`
                : `<p class="hint text-amber-700 dark:text-amber-300">No hay vehículos disponibles. Registra o libera uno primero.</p>`
            }
          </div>
          <div>
            <label class="label" for="cliente_id">Cliente *</label>
            <select id="cliente_id" name="cliente_id" class="input" required>
              <option value="">Selecciona un cliente…</option>
              ${clientes
                .map(
                  (cliente) => `
                <option value="${cliente.id}">
                  ${escapeHtml(cliente.nombre)}${cliente.documento ? ` · ${escapeHtml(cliente.documento)}` : ""}
                </option>
              `,
                )
                .join("")}
            </select>
            ${
              clientes.length
                ? `<p class="hint"><a href="/clientes" class="text-apple-blue dark:text-apple-blue-dark">Gestionar clientes</a></p>`
                : `<p class="hint text-amber-700 dark:text-amber-300">No hay clientes activos. Crea uno primero.</p>`
            }
          </div>
        </div>
      </section>

      <section class="card p-5">
        <h2 class="text-base font-semibold tracking-tight">Condiciones de la venta</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label class="label" for="fecha_venta">Fecha de la venta</label>
            <input id="fecha_venta" name="fecha_venta" type="datetime-local" class="input" value="${fechaPorDefecto}">
            <p class="hint">Vacía = fecha y hora actuales.</p>
          </div>
          <div>
            <label class="label" for="estado">Estado *</label>
            <select id="estado" name="estado" class="input">
              <option value="completada">Completada</option>
              <option value="apartado">Apartado</option>
            </select>
          </div>
          <div>
            <label class="label" for="forma_pago">Forma de pago *</label>
            <select id="forma_pago" name="forma_pago" class="input">
              ${(catalog.formas_pago || [])
                .map(
                  (item) =>
                    `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`,
                )
                .join("")}
            </select>
          </div>
          <div>
            <label class="label" for="precio_final_ves">Precio final en VES *</label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-apple-muted dark:text-apple-muted-dark">Bs.</span>
              <input id="precio_final_ves" name="precio_final_ves" inputmode="decimal" class="input pl-11" required placeholder="0,00">
            </div>
            <p class="hint">Puedes ajustar el precio respecto al de lista.</p>
          </div>
        </div>

        <div class="mt-4 grid gap-3 rounded-xl bg-black/[0.03] p-4 text-sm dark:bg-white/5 sm:grid-cols-2">
          <div>
            <p class="text-xs text-apple-muted dark:text-apple-muted-dark">Precio de lista</p>
            <p class="mt-1 font-medium" data-precio-lista>—</p>
          </div>
          <div class="sm:text-right">
            <p class="text-xs text-apple-muted dark:text-apple-muted-dark">Referencia en USD</p>
            <p class="mt-1 font-semibold" data-usd-preview>—</p>
          </div>
        </div>

        <div class="mt-4">
          <label class="label" for="notas">Notas</label>
          <textarea id="notas" name="notas" rows="3" class="input" placeholder="Condiciones, acuerdos, observaciones…"></textarea>
        </div>
      </section>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <a href="/ventas" class="btn btn-secondary">Cancelar</a>
        <button type="submit" class="btn btn-primary" data-submit ${rate ? "" : "disabled"}>Registrar venta</button>
      </div>
    </form>
  `;
}

export function bindVentaForm(form, { tasa, onSubmit }) {
  const rate = tasa?.configurada ? Number(tasa.ves_por_usd) : null;
  const vehiculoSelect = form.querySelector("#vehiculo_id");
  const precioInput = form.querySelector("#precio_final_ves");
  const lista = form.querySelector("[data-precio-lista]");
  const preview = form.querySelector("[data-usd-preview]");
  const errorBox = form.querySelector("#venta-form-error");
  const submit = form.querySelector("[data-submit]");

  const updatePreview = () => {
    const cents = parseMoneyInput(precioInput?.value);
    if (preview) {
      preview.textContent = rate && cents ? `≈ ${formatUsd(Math.round(cents / rate))}` : "—";
    }
  };

  const syncVehiculo = () => {
    const option = vehiculoSelect?.selectedOptions?.[0];
    const raw = option?.dataset?.precio;
    if (raw) {
      const cents = Number(raw);
      if (lista) lista.textContent = new Intl.NumberFormat("es-VE").format(cents / 100) + " Bs.";
      if (precioInput && !precioInput.value) {
        precioInput.value = (cents / 100).toFixed(2);
        updatePreview();
      }
    } else {
      if (lista) lista.textContent = "—";
    }
  };

  vehiculoSelect?.addEventListener("change", () => {
    const option = vehiculoSelect.selectedOptions?.[0];
    const raw = option?.dataset?.precio;
    if (raw && precioInput) precioInput.value = (Number(raw) / 100).toFixed(2);
    syncVehiculo();
    updatePreview();
  });
  precioInput?.addEventListener("input", updatePreview);
  syncVehiculo();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox?.classList.add("hidden");
    const data = new FormData(form);
    const vehiculoId = Number(data.get("vehiculo_id"));
    const clienteId = Number(data.get("cliente_id"));
    const precio = parseMoneyInput(data.get("precio_final_ves"));

    if (!vehiculoId || !clienteId) {
      showError("Selecciona un vehículo y un cliente.");
      return;
    }
    if (precio === null || precio <= 0) {
      showError("Ingresa un precio final válido en VES.");
      return;
    }

    const payload = {
      vehiculo_id: vehiculoId,
      cliente_id: clienteId,
      estado: String(data.get("estado") || "completada"),
      forma_pago: String(data.get("forma_pago") || "contado"),
      precio_final_ves_centavos: precio,
      notas: String(data.get("notas") || "").trim() || null,
    };
    const fechaLocal = String(data.get("fecha_venta") || "");
    if (fechaLocal) {
      const fecha = new Date(fechaLocal);
      if (!Number.isNaN(fecha.getTime())) payload.fecha_venta = fecha.toISOString();
    }

    submit.disabled = true;
    const original = submit.innerHTML;
    submit.innerHTML = "Registrando…";
    try {
      await onSubmit(payload);
    } catch (error) {
      showError(error.message || "No se pudo registrar la venta.");
      submit.disabled = false;
      submit.innerHTML = original;
    }
  });

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
