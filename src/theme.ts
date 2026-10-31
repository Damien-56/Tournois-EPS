import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

export interface EpsThemeApi {
  version: "1.0.0";
  app: "tournois-sports-individuels";
  key: "eps.theme.v1.tournois-sports-individuels";
  get: () => ThemeMode;
  set: (value: ThemeMode) => boolean;
  isPersistent: () => boolean;
  subscribe: (listener: (mode: ThemeMode, persistent: boolean) => void) => () => void;
}

declare global {
  interface Window { EPSTheme?: EpsThemeApi; }
}

export function useEpsTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => window.EPSTheme?.get() ?? "light");
  const [persistent, setPersistent] = useState(() => window.EPSTheme?.isPersistent() ?? true);

  useEffect(() => {
    const api = window.EPSTheme;
    if (!api) return;
    setMode(api.get());
    setPersistent(api.isPersistent());
    return api.subscribe((nextMode, nextPersistent) => {
      setMode(nextMode);
      setPersistent(nextPersistent);
    });
  }, []);

  const setTheme = (nextMode: ThemeMode) => {
    if (window.EPSTheme) window.EPSTheme.set(nextMode);
  };

  return { mode, persistent, setTheme };
}
