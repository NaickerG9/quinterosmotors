import { get, post } from "../api.js";
import { isAdmin } from "../auth.js";
import { buildVehiculoFormHtml, bindVehiculoForm } from "../forms/vehiculo.js";
import { toast } from "../ui.js";

const root = document.getElementById("vehiculo-form-root");

async function init() {
  try {
    const catalogResponse = await get("/api/v1/catalogos");
    const catalog = catalogResponse.data;
    root.innerHTML = buildVehiculoFormHtml({}, catalog, isAdmin());
    const form = document.getElementById("vehiculo-form");
    bindVehiculoForm(form, {
      catalog,
      isAdmin: isAdmin(),
      onSubmit: async (payload) => {
        const response = await post("/api/v1/vehiculos", payload);
        toast("Vehículo creado correctamente.");
        window.location.href = `/vehiculos/${response.data.id}`;
      },
    });
  } catch (error) {
    root.innerHTML = `<div class="card p-6 text-sm text-red-600 dark:text-red-400">${error.message || "No se pudo cargar el formulario."}</div>`;
  }
}

init();
