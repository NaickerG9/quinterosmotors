import {
  clearFieldErrors,
  escapeHtml,
  formatUsd,
  parseMoneyInput,
  setLoading,
  showFormError,
} from "../ui.js";

function options(items, selected) {
  return (items || [])
    .map(
      (item) =>
        `<option value="${escapeHtml(item.value)}" ${item.value === selected ? "selected" : ""}>${escapeHtml(item.label)}</option>`,
    )
    .join("");
}

function inputValue(value) {
  return escapeHtml(value ?? "");
}

export function buildVehiculoFormHtml(vehiculo = {}, catalog = {}, isAdmin = false) {
  const tasa = catalog.tasa;
  const rate = tasa?.configurada ? Number(tasa.ves_por_usd) : null;
  return `
    <form id="vehiculo-form" class="space-y-6" novalidate>
      <div id="vehiculo-form-error" class="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300" role="alert"></div>

      <section class="card p-5">
        <h2 class="text-base font-semibold tracking-tight">Información general</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label class="label" for="marca">Marca *</label>
            <input id="marca" name="marca" class="input" required value="${inputValue(vehiculo.marca)}" placeholder="Toyota">
          </div>
          <div>
            <label class="label" for="modelo">Modelo *</label>
            <input id="modelo" name="modelo" class="input" required value="${inputValue(vehiculo.modelo)}" placeholder="Corolla">
          </div>
          <div>
            <label class="label" for="version">Versión</label>
            <input id="version" name="version" class="input" value="${inputValue(vehiculo.version)}" placeholder="XEI 2.0">
          </div>
          <div>
            <label class="label" for="anio">Año *</label>
            <input id="anio" name="anio" type="number" min="1950" max="2100" class="input" required value="${inputValue(vehiculo.anio)}" placeholder="2021">
          </div>
          <div>
            <label class="label" for="color">Color</label>
            <input id="color" name="color" class="input" value="${inputValue(vehiculo.color)}" placeholder="Blanco">
          </div>
          <div>
            <label class="label" for="kilometraje">Kilometraje</label>
            <input id="kilometraje" name="kilometraje" type="number" min="0" class="input" value="${inputValue(vehiculo.kilometraje ?? 0)}" placeholder="0">
          </div>
          <div>
            <label class="label" for="vin">VIN</label>
            <input id="vin" name="vin" class="input" value="${inputValue(vehiculo.vin)}" placeholder="8AJBA3CD0M0000001">
          </div>
          <div>
            <label class="label" for="placa">Placa</label>
            <input id="placa" name="placa" class="input" value="${inputValue(vehiculo.placa)}" placeholder="AA001AA">
          </div>
        </div>
      </section>

      <section class="card p-5">
        <h2 class="text-base font-semibold tracking-tight">Especificaciones</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label class="label" for="estado">Estado *</label>
            <select id="estado" name="estado" class="input" required>
              ${options(catalog.estados_vehiculo, vehiculo.estado || "disponible")}
            </select>
            <p class="hint">Una venta cambia el estado a vendido automáticamente.</p>
          </div>
          <div>
            <label class="label" for="transmision">Transmisión</label>
            <select id="transmision" name="transmision" class="input">
              <option value="">Selecciona…</option>
              ${options(catalog.transmisiones, vehiculo.transmision)}
            </select>
          </div>
          <div>
            <label class="label" for="combustible">Combustible</label>
            <select id="combustible" name="combustible" class="input">
              <option value="">Selecciona…</option>
              ${options(catalog.combustibles, vehiculo.combustible)}
            </select>
          </div>
          <div>
            <label class="label" for="carroceria">Carrocería</label>
            <select id="carroceria" name="carroceria" class="input">
              <option value="">Selecciona…</option>
              ${options(catalog.carrocerias, vehiculo.carroceria)}
            </select>
          </div>
        </div>
      </section>

      <section class="card p-5">
        <h2 class="text-base font-semibold tracking-tight">Precio</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="precio_ves">Precio en VES *</label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-apple-muted dark:text-apple-muted-dark">Bs.</span>
              <input id="precio_ves" name="precio_ves" inputmode="decimal" class="input pl-11" required value="${vehiculo.precio_ves_centavos ? (vehiculo.precio_ves_centavos / 100).toFixed(2) : ""}" placeholder="350000,00">
            </div>
          </div>
          ${
            isAdmin
              ? `<div>
                  <label class="label" for="costo_ves">Costo en VES</label>
                  <div class="relative">
                    <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-apple-muted dark:text-apple-muted-dark">Bs.</span>
                    <input id="costo_ves" name="costo_ves" inputmode="decimal" class="input pl-11" value="${vehiculo.costo_ves_centavos ? (vehiculo.costo_ves_centavos / 100).toFixed(2) : ""}" placeholder="300000,00">
                  </div>
                  <p class="hint">Solo visible para administradores.</p>
                </div>`
              : ""
          }
        </div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-4 py-3 text-sm dark:bg-white/5">
          <span class="text-apple-muted dark:text-apple-muted-dark">Referencia en USD</span>
          <span class="font-semibold" data-usd-preview>—</span>
        </div>
        ${
          rate
            ? `<p class="hint mt-2">Tasa aplicada: Bs. ${escapeHtml(tasa.ves_por_usd)} por 1 USD.</p>`
            : `<p class="hint mt-2 text-amber-700 dark:text-amber-300">No hay tasa configurada; la referencia USD no estará disponible.</p>`
        }
      </section>

      <section class="card p-5">
        <h2 class="text-base font-semibold tracking-tight">Descripción</h2>
        <div class="mt-4">
          <label class="label" for="descripcion">Detalles del vehículo</label>
          <textarea id="descripcion" name="descripcion" rows="4" class="input" placeholder="Único dueño, mantenimiento al día…">${inputValue(vehiculo.descripcion)}</textarea>
        </div>
        <label class="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="destacado" class="size-4 rounded border-apple-line text-apple-blue focus:ring-apple-blue" ${vehiculo.destacado ? "checked" : ""}>
          Destacar en el inventario
        </label>
      </section>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <a href="/vehiculos" class="btn btn-secondary">Cancelar</a>
        <button type="submit" class="btn btn-primary" data-submit>Guardar vehículo</button>
      </div>
    </form>
  `;
}

export function bindVehiculoForm(form, { catalog = {}, isAdmin = false, onSubmit }) {
  const errorBox = form.querySelector("#vehiculo-form-error");
  const submit = form.querySelector("[data-submit]");
  const priceInput = form.querySelector("#precio_ves");
  const preview = form.querySelector("[data-usd-preview]");
  const rate = catalog.tasa?.configurada ? Number(catalog.tasa.ves_por_usd) : null;

  const updatePreview = () => {
    if (!preview) return;
    const cents = parseMoneyInput(priceInput?.value);
    preview.textContent = rate && cents ? `≈ ${formatUsd(Math.round(cents / rate))}` : "—";
  };

  priceInput?.addEventListener("input", updatePreview);
  updatePreview();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    showFormError(errorBox, "");
    const data = new FormData(form);
    const precio = parseMoneyInput(data.get("precio_ves"));
    if (precio === null || precio <= 0) {
      showFormError(errorBox, "Ingresa un precio válido en VES.", {
        precio_ves: "Precio inválido",
      });
      priceInput?.focus();
      return;
    }

    const payload = {
      marca: String(data.get("marca") || "").trim(),
      modelo: String(data.get("modelo") || "").trim(),
      version: String(data.get("version") || "").trim() || null,
      anio: Number(data.get("anio")),
      color: String(data.get("color") || "").trim() || null,
      kilometraje: Number(data.get("kilometraje") || 0),
      vin: String(data.get("vin") || "").trim() || null,
      placa: String(data.get("placa") || "").trim() || null,
      transmision: String(data.get("transmision") || "") || null,
      combustible: String(data.get("combustible") || "") || null,
      carroceria: String(data.get("carroceria") || "") || null,
      estado: String(data.get("estado") || "disponible"),
      precio_ves_centavos: precio,
      descripcion: String(data.get("descripcion") || "").trim() || null,
      destacado: form.querySelector('[name="destacado"]')?.checked || false,
    };

    if (isAdmin) {
      const costoRaw = String(data.get("costo_ves") || "").trim();
      if (costoRaw) {
        const costo = parseMoneyInput(costoRaw);
        if (costo === null || costo < 0) {
          showFormError(errorBox, "El costo no es válido.", {
            costo_ves: "Costo inválido",
          });
          return;
        }
        payload.costo_ves_centavos = costo;
      } else {
        payload.costo_ves_centavos = null;
      }
    }

    setLoading(submit, true, "Guardando…");
    try {
      await onSubmit(payload);
    } catch (error) {
      showFormError(errorBox, error.message || "No se pudo guardar el vehículo.", error.fields);
      setLoading(submit, false);
    }
  });
}
