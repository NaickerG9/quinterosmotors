import { get, post } from "../api.js";
import { buildVentaFormHtml, bindVentaForm } from "../forms/venta.js";
import { escapeHtml, toast } from "../ui.js";

const root = document.getElementById("venta-form-root");

async function init() {
  try {
    const [vehiculosResponse, clientesResponse, catalogResponse] = await Promise.all([
      get("/api/v1/vehiculos?estado=disponible&sort=reciente&per_page=200"),
      get("/api/v1/clientes?per_page=200"),
      get("/api/v1/catalogos"),
    ]);
    const catalog = catalogResponse.data;
    root.innerHTML = buildVentaFormHtml({
      vehiculos: vehiculosResponse.data,
      clientes: clientesResponse.data,
      catalog,
      tasa: catalog.tasa,
    });
    const form = document.getElementById("venta-form");
    bindVentaForm(form, {
      tasa: catalog.tasa,
      onSubmit: async (payload) => {
        const response = await post("/api/v1/ventas", payload);
        toast("Venta registrada correctamente.");
        window.location.href = `/ventas/${response.data.id}`;
      },
    });
  } catch (error) {
    root.innerHTML = `<div class="card p-6 text-sm text-red-600 dark:text-red-400">${escapeHtml(error.message || "No se pudo cargar el formulario.")}</div>`;
  }
}

init();
