import { CartProvider } from "@/lib/cart/context";
import { getSiteSettings } from "@/lib/data/settings";
import { getActiveCategories } from "@/lib/data/categories";
import { AnnouncementBar } from "@/components/shop/announcement-bar";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { WhatsAppFloat } from "@/components/shop/whatsapp-float";
import { CookieBanner } from "@/components/shop/cookie-banner";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, categories] = await Promise.all([
    getSiteSettings(),
    getActiveCategories(),
  ]);

  return (
    <CartProvider>
      <AnnouncementBar
        text={settings.announcement}
        active={settings.announcement_active}
      />
      <Header storeName={settings.store_name} categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} categories={categories} />
      <CartDrawer />
      <WhatsAppFloat phone={settings.whatsapp} />
      <CookieBanner />
    </CartProvider>
  );
}
