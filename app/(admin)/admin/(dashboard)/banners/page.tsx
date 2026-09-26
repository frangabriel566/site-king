import type { Metadata } from "next";
import Link from "next/link";
import { SafeImage } from "@/components/shop/safe-image";
import { Plus, Pencil } from "lucide-react";
import { getAllBannersAdmin } from "@/lib/data/banners";
import { Button } from "@/components/ui/button";
import { ActiveBadge } from "@/components/admin/status-badge";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteBannerAction } from "@/lib/actions/banners";
import { BannerActiveToggle } from "./banner-active-toggle";

export const metadata: Metadata = { title: "Banners — Painel" };

export default async function AdminBannersPage() {
  const banners = await getAllBannersAdmin();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-label mb-2">Painel</p>
          <h1 className="text-heading text-3xl">Banners</h1>
        </div>
        <Button asChild size="lg">
          <Link href="/admin/banners/novo">
            <Plus className="size-4" /> Novo banner
          </Link>
        </Button>
      </div>

      {banners.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum banner cadastrado.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-card p-4 transition-colors duration-150 ease-out hover:border-line-strong md:gap-5"
            >
              <div className="relative h-20 w-32 shrink-0 overflow-hidden bg-field">
                {banner.image_url && (
                  <SafeImage
                    src={banner.image_url}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate text-sm">
                  {banner.wordmark || "(sem wordmark)"}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {banner.headline_line1} {banner.headline_line2}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Posição {banner.position}
                </p>
              </div>
              <ActiveBadge active={banner.active} labels={["Ativo", "Inativo"]} />
              <BannerActiveToggle id={banner.id} active={banner.active} />
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href={`/admin/banners/${banner.id}`} aria-label="Editar banner">
                  <Pencil className="size-4" />
                </Link>
              </Button>
              <DeleteButton
                itemLabel="banner"
                action={deleteBannerAction.bind(null, banner.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
