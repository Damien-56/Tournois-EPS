/// <reference types="vite/client" />

import { useEffect, useState } from "react";

export const PWA_VERSION = "2026.10.31";
export const PWA_VERSION_LABEL = "Version 2026.10.31";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PwaStatus {
  offline: boolean;
  updateAvailable: boolean;
  canInstall: boolean;
  standalone: boolean;
  version: string;
}

let registration: ServiceWorkerRegistration | undefined;
let installPrompt: BeforeInstallPromptEvent | undefined;
let updateAvailable = false;
let reloading = false;

function isStandalone() {
  return Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches) || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function getStatus(): PwaStatus {
  return {
    offline: !navigator.onLine,
    updateAvailable,
    canInstall: Boolean(installPrompt),
    standalone: isStandalone(),
    version: PWA_VERSION,
  };
}

function publishStatus() {
  window.dispatchEvent(new CustomEvent<PwaStatus>("eps:pwa-status", { detail: getStatus() }));
}

function observeRegistration(nextRegistration: ServiceWorkerRegistration) {
  registration = nextRegistration;
  if (registration.waiting) {
    updateAvailable = true;
    publishStatus();
  }
  registration.addEventListener("updatefound", () => {
    const installing = registration?.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        updateAvailable = true;
        publishStatus();
      }
    });
  });
}

export function registerPwa() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || "Capacitor" in window) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as BeforeInstallPromptEvent;
    publishStatus();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = undefined;
    publishStatus();
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" })
      .then((nextRegistration) => {
        observeRegistration(nextRegistration);
        return nextRegistration.update();
      })
      .catch((error) => {
        console.warn("Le mode hors ligne PWA n'a pas pu être activé", error);
      });
  }, { once: true });
}

export function applyPwaUpdate() {
  if (!registration?.waiting) return false;
  updateAvailable = false;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  publishStatus();
  return true;
}

export async function installPwa() {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  installPrompt = undefined;
  await prompt.prompt();
  await prompt.userChoice;
  publishStatus();
  return true;
}

export function usePwaStatus() {
  const [status, setStatus] = useState<PwaStatus>(() => getStatus());

  useEffect(() => {
    const onStatus = (event: Event) => setStatus((event as CustomEvent<PwaStatus>).detail);
    const onConnection = () => setStatus(getStatus());
    window.addEventListener("eps:pwa-status", onStatus);
    window.addEventListener("online", onConnection);
    window.addEventListener("offline", onConnection);
    publishStatus();
    return () => {
      window.removeEventListener("eps:pwa-status", onStatus);
      window.removeEventListener("online", onConnection);
      window.removeEventListener("offline", onConnection);
    };
  }, []);

  return status;
}
