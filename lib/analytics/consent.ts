import { COOKIE_CONSENT_KEY } from "@/lib/constants";

/**
 * Google Consent Mode v2 for the store (LGPD).
 *
 * Until the shopper accepts the cookie banner, GA4 and any ad tag in GTM
 * run with storage denied: no analytics or advertising cookies are written,
 * and GA4 only receives the cookieless pings Consent Mode allows. Accepting
 * grants them, in this page and in every later visit (the choice lives in
 * localStorage, where the banner already kept it).
 *
 * `gtmBootstrapScript` runs inline, while the page is parsed (before any
 * component can push an event), so the dataLayer always starts with the
 * consent default and then GTM's own start event — the order Google
 * documents for Consent Mode with Tag Manager. The start event is the
 * official snippet's `{'gtm.start', event: 'gtm.js'}`; `gtag` is defined
 * only for the consent commands, never to load or configure GA4 (the
 * Google tag inside GTM does that, once).
 */

export const GTM_ID = "GTM-WZ64DZLP";

const GRANTED = {
  analytics_storage: "granted",
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
} as const;

/** The inline bootstrap: dataLayer + gtag, consent default, then GTM. */
export function gtmBootstrapScript(): string {
  return `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
(function(){
  var accepted = false;
  try { accepted = localStorage.getItem(${JSON.stringify(COOKIE_CONSENT_KEY)}) === "accepted"; } catch (e) {}
  var state = accepted ? "granted" : "denied";
  gtag("consent", "default", {
    analytics_storage: state,
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500
  });
})();
dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
(function(){
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtm.js?id=${GTM_ID}";
  document.head.appendChild(s);
})();`;
}

/** Called by the cookie banner's "Aceitar". */
export function grantAnalyticsConsent() {
  if (typeof window === "undefined") return;
  const w = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  // Defined by the bootstrap on every store page. Without it GTM never
  // loaded here, and there is nothing to grant.
  if (typeof w.gtag !== "function") return;
  try {
    w.gtag("consent", "update", GRANTED);
    w.dataLayer?.push({ event: "cookie_consent_granted" });
  } catch {
    // The banner still closes and the choice is still saved.
  }
}
