import { api } from "./api.js";

export function currentUser() {
  return {
    name: document.body.dataset.userName || "",
    role: document.body.dataset.userRole || "vendedor",
  };
}

export function isAdmin() {
  return currentUser().role === "admin";
}

export async function logout() {
  await api("/api/v1/auth/logout", { method: "POST" });
  window.location.href = "/login";
}
