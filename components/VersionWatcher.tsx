"use client";

import { useEffect, useRef } from "react";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Detecta cuando hay un deploy más nuevo que el bundle que el navegador ya
// tiene cargado (buildId distinto en /version.json) y recarga la página sola.
// No recarga si el usuario está escribiendo en un input/textarea en ese
// momento, para no tirarle un formulario a mitad de completar — en ese caso
// se reintenta en el próximo chequeo.
export default function VersionWatcher() {
  const buildIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBuildId = async (): Promise<string | null> => {
      try {
        const r = await fetch("/version.json", { cache: "no-store" });
        if (!r.ok) return null;
        const data = await r.json();
        return typeof data.buildId === "string" ? data.buildId : null;
      } catch {
        return null;
      }
    };

    const check = async () => {
      const current = await fetchBuildId();
      if (cancelled || !current) return;
      if (buildIdRef.current === null) {
        buildIdRef.current = current;
        return;
      }
      if (current !== buildIdRef.current) {
        const el = document.activeElement;
        const escribiendo = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
        if (!escribiendo) window.location.reload();
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
