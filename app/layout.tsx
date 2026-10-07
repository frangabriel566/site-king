import type { Metadata } from "next";
import localFont from "next/font/local";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Archivo, self-hosted: the exact latin file Google Fonts served through
// next/font/google (same bytes), so the build no longer depends on
// reaching Google — a flaky fetch there failed a Cloudflare build once.
// It is a variable font: one file covers every weight the site uses.
// License: app/fonts/OFL.txt.
//
// The fallback shown while it loads keeps the metrics next/font/google
// used ("Archivo Fallback" in globals.css): next/font/local would derive
// slightly different ones from the file, shifting text during the swap.
const archivo = localFont({
  src: [{ path: "./fonts/archivo-latin-wght.woff2", weight: "400 900", style: "normal" }],
  variable: "--font-archivo",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Archivo Fallback"],
});

// || not ?? — an env var explicitly set to "" (e.g. left blank in the
// Vercel dashboard before the first deploy's URL was known) is neither
// null nor undefined, so ?? would leave siteUrl empty and new URL()
// below would throw "Invalid URL" during the production build.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Every page reads the D1 database (the shop layout alone reads the site
// settings), and D1 only exists inside a request on the Worker — at build
// time there is no production database to prerender from. So nothing is
// static: each request renders with live data. (ISR would not help either:
// without an OpenNext incremental cache configured, it caches nothing.)
export const dynamic = "force-dynamic";

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
