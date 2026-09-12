"use client";

import { usePathname } from "next/navigation";
import { Newsletter } from "./newsletter";

/**
 * The home page already renders a full, prominent newsletter section
 * right above the footer (`NewsletterSection`) — showing the footer's
 * own compact newsletter field directly under it would be the same
 * capture form twice in one scroll. Everywhere else, the footer is the
 * only newsletter opportunity on the page, so it stays.
 */
export function FooterNewsletter() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return <Newsletter variant="dark" />;
}
