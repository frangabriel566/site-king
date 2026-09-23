import { CartProvider } from "@/lib/cart/context";
import { getSiteSettings } from "@/lib/data/settings";
import { getActiveCategories } from "@/lib/data/categories";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { WhatsAppFloat } from "@/components/shop/whatsapp-float";
import { CookieBanner } from "@/components/shop/cookie-banner";
import { HeaderDebug } from "@/components/shop/header-debug";
import { OverlayGuard } from "@/components/shop/overlay-guard";
import { Toaster } from "@/components/ui/sonner";

/**
 * Records which header control was pressed before the page was able to
 * respond to it.
 *
 * This runs while the HTML is still being parsed — seconds before the
 * React bundle finishes hydrating on a mid-range phone over mobile
 * data. Until that moment the menu and bag buttons are inert markup:
 * they are painted, they take the tap highlight, and their onClick does
 * not exist yet, so every press in that window disappeared. Desktop
 * never showed it because it hydrates before a hand can reach the
 * mouse.
 *
 * Kept to a capture-phase listener and two globals on purpose: it has
 * to be small enough to be inline, and it must not assume anything
 * about the app that is still loading around it. The Header calls
 * `__khTapTake()` on mount, which hands over the pending press and
 * uninstalls this. Any other click, or any scroll, clears it first —
 * a press the shopper has already given up on must not open a drawer
 * under them a second later.
 */
const EARLY_TAP = `(function(){
var w=window;w.__khTap=null;
function t(e){var n=e.target&&e.target.closest?e.target.closest("[data-tap-intent]"):null;w.__khTap=n?n.getAttribute("data-tap-intent"):null}
function c(){w.__khTap=null}
document.addEventListener("click",t,true);
w.addEventListener("scroll",c,{passive:true});
w.__khTapTake=function(){document.removeEventListener("click",t,true);w.removeEventListener("scroll",c);var v=w.__khTap;w.__khTap=null;return v}
})();`;

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, categories] = await Promise.all([
    getSiteSettings(),
    getActiveCategories(),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.store_name,
    url: siteUrl,
    logo: settings.logo_url ?? undefined,
    sameAs: [
      settings.instagram
        ? `https://instagram.com/${settings.instagram.replace("@", "")}`
        : null,
      settings.tiktok ? `https://tiktok.com/${settings.tiktok.replace("@", "")}` : null,
      settings.youtube
        ? `https://youtube.com/${settings.youtube.replace("@", "")}`
        : null,
    ].filter(Boolean),
  };

  return (
    <CartProvider>
      <div className="storefront-theme flex min-h-full flex-col bg-bg text-fg">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {/* Before <Header>, so it is listening by the time the header it
            covers has even been parsed. */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_TAP }} />
        <Header settings={settings} categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer settings={settings} categories={categories} />
        <CartDrawer />
        <WhatsAppFloat phone={settings.whatsapp} />
        <CookieBanner />
        {/* Renders nothing. Asserts that a closed overlay never leaves the
            document locked — see the file for why that can happen. */}
        <OverlayGuard />
        {/* Renders nothing at all unless the URL carries ?debug=1 — it is
            a field probe for the iOS header problem, not a feature. */}
        <HeaderDebug />
        <Toaster theme="light" position="bottom-right" />
      </div>
    </CartProvider>
  );
}
