/// <reference types="vite/client" />

export function registerPwa() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || "Capacitor" in window) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((error) => {
      console.warn("Le mode hors ligne PWA n'a pas pu être activé", error);
    });
  }, { once: true });
}
