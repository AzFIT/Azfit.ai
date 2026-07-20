import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import posthog from "posthog-js";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;

let posthogInitialized = false;

function initPostHog() {
  if (!posthogKey || posthogInitialized) return;
  posthog.init(posthogKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // we handle this manually for SPA navigation
    capture_pageleave: true,
  });
  posthogInitialized = true;
}

function initPlausible() {
  if (!plausibleDomain || document.getElementById("plausible-script")) return;
  const script = document.createElement("script");
  script.id = "plausible-script";
  script.defer = true;
  script.setAttribute("data-domain", plausibleDomain);
  script.src = "https://plausible.io/js/script.js";
  document.head.appendChild(script);
}

/**
 * Initializes product analytics (PostHog + Plausible) and tracks
 * virtual pageviews on SPA navigation. Call once at the top of App.
 */
export function useAnalytics() {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    initPostHog();
    initPlausible();
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Track SPA navigation as pageviews
    if (posthogInitialized) {
      posthog.capture("$pageview", {
        $current_url: window.location.href,
        $pathname: location.pathname,
      });
    }
    // Plausible automatically tracks the URL at the moment the script runs,
    // so for SPA navigation we push a custom event if the global is present.
    const plausible = (window as unknown as Record<string, unknown>).plausible as
      | ((name: string, options?: { props: Record<string, string> }) => void)
      | undefined;
    if (plausible) {
      plausible("pageview", { props: { url: window.location.href } });
    }
  }, [location.pathname]);
}
