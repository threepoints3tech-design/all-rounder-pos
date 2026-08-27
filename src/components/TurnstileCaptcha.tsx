import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "light" | "dark" | "auto";
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const scriptId = "cloudflare-turnstile";

type TurnstileCaptchaProps = {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
};

export function TurnstileCaptcha({
  siteKey,
  onTokenChange,
}: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | null = null;

    const mountWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenChange(token),
        "expired-callback": () => onTokenChange(null),
        "error-callback": () => onTokenChange(null),
        theme: "auto",
      });
    };

    const existingScript = document.getElementById(scriptId);
    if (window.turnstile) {
      mountWidget();
    } else if (existingScript) {
      existingScript.addEventListener("load", mountWidget, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", mountWidget, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      onTokenChange(null);
    };
  }, [onTokenChange, siteKey]);

  return <div ref={containerRef} className="flex justify-center" />;
}
