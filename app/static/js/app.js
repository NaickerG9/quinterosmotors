import { logout } from "./auth.js";
import { toast } from "./ui.js";

function applyTheme(dark) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch (error) {
    /* Ignorar almacenamiento no disponible. */
  }
}

function currentTheme() {
  return document.documentElement.classList.contains("dark");
}

function initThemeToggle() {
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    applyTheme(!currentTheme());
  });
}

function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const open = () => {
    sidebar?.classList.remove("-translate-x-full");
    overlay?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    sidebar?.classList.add("-translate-x-full");
    overlay?.classList.add("hidden");
    document.body.style.overflow = "";
  };
  document.getElementById("sidebar-toggle")?.addEventListener("click", open);
  document.getElementById("sidebar-close")?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024) close();
  });
}

function initLogout() {
  document.getElementById("logout-btn")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await logout();
    } catch (error) {
      toast(error.message || "No se pudo cerrar la sesión", "error");
      button.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initSidebar();
  initLogout();
});

window.addEventListener("unhandledrejection", (event) => {
  if (event.reason?.name === "ApiError") {
    toast(event.reason.message, "error");
  }
});
