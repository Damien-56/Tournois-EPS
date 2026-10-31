import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("PWA standalone contract", () => {
  it("audits the standalone manifest identity and install assets", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
      id: string;
      start_url: string;
      scope: string;
      display: string;
      lang: string;
      icons: Array<{ src: string; sizes: string; type: string }>;
    };
    expect(manifest.id).toBe("/Tournois-EPS/?v=20261031");
    expect(manifest.start_url).toBe("./?pwa_version=20261031");
    expect(manifest.scope).toBe("./");
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("fr-FR");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "./icon-192.png", sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ src: "./icon-512.png", sizes: "512x512", type: "image/png" }),
    ]));
  });

  it("keeps the PWA shell and its update protocol scoped to Tournois EPS", () => {
    const serviceWorker = read("public/sw.js");
    const pwa = read("src/pwa.ts");
    const index = read("index.html");
    expect(serviceWorker).toContain('const CACHE_PREFIX = "tournois-eps-pwa-"');
    expect(serviceWorker).toContain('const CACHE_NAME = "tournois-eps-pwa-v3-20261031"');
    expect(serviceWorker).toContain('event.data?.type === "SKIP_WAITING"');
    expect(serviceWorker).toContain('key.startsWith(CACHE_PREFIX)');
    expect(pwa).toContain("updatefound");
    expect(pwa).toContain("controllerchange");
    expect(pwa).toContain("updateAvailable");
    expect(pwa).toContain("SKIP_WAITING");
    expect(index).toContain('name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"');
    expect(index).toContain('name="mobile-web-app-capable" content="yes"');
    expect(index).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(index).toContain('rel="apple-touch-icon" href="./icon-192.png"');
  });

  it("exposes version, offline state, install and web fallback controls", () => {
    const app = read("src/App.tsx");
    const styles = read("src/styles.css");
    expect(app).toContain("Une mise à jour est disponible.");
    expect(app).toContain("Mettre à jour");
    expect(app).toContain("Ouvrir la version Web");
    expect(app).toContain("Hors connexion");
    expect(styles).toContain(".pwa-status");
    expect(styles).toContain("@media (max-width: 900px)");
    expect(styles).toContain(':root[data-theme="dark"]');
  });
});
