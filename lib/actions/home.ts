"use server";

import { revalidatePath } from "next/cache";
import { homeSettingsSchema } from "@/lib/validations/home";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { releaseImages, removedUrls } from "@/lib/media/images";

export type HomeActionResult = {
  status: "idle" | "error" | "success";
  message?: string;
};

const { home_settings } = schema;

export async function saveHomeSettingsAction(
  _prev: HomeActionResult,
  formData: FormData,
): Promise<HomeActionResult> {
  const text = (key: string) => (formData.get(key) as string | null) ?? "";
  const parsed = homeSettingsSchema.safeParse({
    eyebrow: text("eyebrow"),
    eyebrow_highlight: text("eyebrow_highlight"),
    headline: text("headline"),
    headline_highlight: text("headline_highlight"),
    subtitle: text("subtitle"),
    cta_label: text("cta_label"),
    cta_href: text("cta_href"),
    whatsapp_label: text("whatsapp_label"),
    featured_product_id: text("featured_product_id") || null,
    featured_label: text("featured_label"),
    hero_image_url: text("hero_image_url"),
    kit_image_url: text("kit_image_url"),
    kit_title: text("kit_title"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  await requireAdmin();
  const data = parsed.data;
  // Empty means "use the default text" (lib/data/home.ts).
  const row = {
    eyebrow: data.eyebrow || null,
    eyebrow_highlight: data.eyebrow_highlight || null,
    headline: data.headline || null,
    headline_highlight: data.headline_highlight || null,
    subtitle: data.subtitle || null,
    cta_label: data.cta_label || null,
    cta_href: data.cta_href || null,
    whatsapp_label: data.whatsapp_label || null,
    featured_product_id: data.featured_product_id || null,
    featured_label: data.featured_label || null,
    hero_image_url: data.hero_image_url || null,
    kit_image_url: data.kit_image_url || null,
    kit_title: data.kit_title || null,
  };

  let before: { hero_image_url: string | null; kit_image_url: string | null } | undefined;
  try {
    before = await getDb()
      .select({
        hero_image_url: home_settings.hero_image_url,
        kit_image_url: home_settings.kit_image_url,
      })
      .from(home_settings)
      .where(eq(home_settings.id, 1))
      .get();
    await getDb()
      .insert(home_settings)
      .values({ id: 1, ...row })
      .onConflictDoUpdate({ target: home_settings.id, set: row });
  } catch (error) {
    console.error("[saveHomeSettingsAction]", error);
    const missingTable = String(error).includes("no such table");
    const missingColumn = String(error).includes("no such column");
    return {
      status: "error",
      message: missingTable
        ? "O banco ainda não tem a tabela da Página inicial. Aplique a migration 0014 (npm run db:migrate:remote)."
        : missingColumn
          ? "O banco ainda não tem as fotos da Página inicial. Aplique as migrations 0015 e 0016 (npm run db:migrate:remote)."
          : "Não foi possível salvar a página inicial.",
    };
  }

  // A swapped or removed photo loses its file once nothing uses it.
  if (before) {
    await releaseImages(
      removedUrls(
        [before.hero_image_url, before.kit_image_url],
        [row.hero_image_url, row.kit_image_url],
      ),
    );
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/pagina-inicial");
  return { status: "success", message: "Página inicial salva." };
}
