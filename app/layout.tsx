import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

// || not ?? — an env var explicitly set to "" (e.g. left blank in the
// Vercel dashboard before the first deploy's URL was known) is neither
// null nor undefined, so ?? would leave siteUrl empty and new URL()
// below would throw "Invalid URL" during the production build.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "King Store — Roupa Masculina",
    template: "%s — King Store",
  },
  description:
    "King Store. Vista-se como um rei: moletons, camisetas, calças e acessórios.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "King Store",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
