import { CartProvider } from "@/lib/cart/context";
import { getSiteSettings } from "@/lib/data/settings";
import { getActiveCategories } from "@/lib/data/categories";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { WhatsAppFloat } from "@/components/shop/whatsapp-float";
import { CookieBanner } from "@/components/shop/cookie-banner";
import { Toaster } from "@/components/ui/sonner";

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
        <Header settings={settings} categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer settings={settings} categories={categories} />
        <CartDrawer />
        <WhatsAppFloat phone={settings.whatsapp} />
        <CookieBanner />
        <Toaster theme="light" position="bottom-right" />
      </div>
    </CartProvider>
  );
}
