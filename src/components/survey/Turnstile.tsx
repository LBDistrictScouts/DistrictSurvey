"use client";

import { useCallback, useEffect, useRef } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  execute: (widget: string) => void;
  reset: (widget: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const scriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const tokenTimeoutMilliseconds = 60_000;

let loading: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load")));
    script.onerror = () => {
      loading = undefined;
      reject(new Error("Turnstile did not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Cloudflare Turnstile for the open link. The check runs only when the person submits, and each retry
 * asks for a new token. Only /survey loads it, and only /survey's security policy allows it.
 */
export function useTurnstile(siteKey: string) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string>(undefined);
  const waiting = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void }>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile().then((api) => {
      if (cancelled || !container.current || widget.current) return;
      widget.current = api.render(container.current, {
        sitekey: siteKey,
        execution: "execute",
        appearance: "interaction-only",
        callback: (token: string) => waiting.current?.resolve(token),
        "error-callback": () => waiting.current?.reject(new Error("Turnstile failed")),
        "expired-callback": () => undefined,
      });
    }, () => undefined);
    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  const getToken = useCallback(async (): Promise<string> => {
    try {
      const api = await loadTurnstile();
      if (!widget.current) throw new Error("Turnstile is not ready");
      const token = new Promise<string>((resolve, reject) => {
        waiting.current = { resolve, reject };
        setTimeout(() => reject(new Error("Turnstile timed out")), tokenTimeoutMilliseconds);
      });
      api.reset(widget.current);
      api.execute(widget.current);
      return await token;
    } catch {
      // An empty token is refused by the server as verification_failed, which tells the person to try again.
      return "";
    }
  }, []);

  return { container, getToken };
}
