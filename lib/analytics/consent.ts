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
 * `consentDefaultScript` runs inline before GTM loads — Consent Mode's
 * default must be in the dataLayer before the container's first tag.
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
gtag('js', new Date());
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
  w.gtag("consent", "update", GRANTED);
  w.dataLayer?.push({ event: "cookie_consent_granted" });
}
