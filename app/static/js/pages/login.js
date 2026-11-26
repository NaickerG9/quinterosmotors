import { api, ApiError } from "../api.js";
import { setLoading } from "../ui.js";

const form = document.getElementById("login-form");
const errorBox = document.getElementById("login-error");
const submit = document.getElementById("login-submit");

function showError(message) {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  if (!errorBox) return;
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

document.getElementById("toggle-password")?.addEventListener("click", () => {
  const input = document.getElementById("password");
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  const data = new FormData(form);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");
  if (!email || !password) {
    showError("Ingresa tu correo y contraseña.");
    return;
  }

  setLoading(submit, true, "Entrando…");
  try {
    await api("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
    const next = new URLSearchParams(window.location.search).get("next");
    const destino = next ? new URL(next, window.location.origin) : null;
    window.location.href =
      destino && destino.origin === window.location.origin
        ? destino.pathname + destino.search + destino.hash
        : "/";
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) {
      showError(error.message);
    } else {
      showError(error.message || "No se pudo iniciar sesión.");
    }
    setLoading(submit, false);
  }
});
