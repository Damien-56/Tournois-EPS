import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("eps.theme 1.0.0 local contract", () => {
  it("bootstraps the individual-sports identity before the stylesheet", () => {
    const index = read("index.html");
    expect(index).toContain('data-eps-app="tournois-sports-individuels"');
    expect(index).toContain('<script src="./theme/eps-theme-boot.js"></script>');
    expect(index.indexOf("eps-theme-boot.js")).toBeLessThan(index.indexOf("eps-theme.css"));
  });

  it("keeps the preference separate from tournament data and other applications", () => {
    const boot = read("public/theme/eps-theme-boot.js");
    const tokens = read("public/theme/tokens.json");
    expect(boot).toContain("var key = 'eps.theme.v1.' + app;");
    expect(boot).toContain("var app = 'tournois-sports-individuels';");
    expect(boot).toContain("localStorage.getItem(key)");
    expect(boot).toContain("localStorage.setItem(key, value)");
    expect(tokens).toContain('"applicationId": "tournois-sports-individuels"');
    expect(tokens).toContain('"themeModes": ["light", "dark"]');
    expect(`${boot}\n${tokens}`).not.toMatch(/crossscan|CrossScan|PWA-balises/i);
  });

  it("ships all runtime theme files through the PWA shell", () => {
    const serviceWorker = read("public/sw.js");
    expect(serviceWorker).toContain("tournois-eps-pwa-v3");
    expect(serviceWorker).toContain("./theme/eps-theme-boot.js");
    expect(serviceWorker).toContain("./theme/eps-theme.css");
    expect(serviceWorker).toContain("./theme/tokens.json");
  });
});
