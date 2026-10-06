"use client";

import { WidgetEditor } from "@/components/widget/WidgetEditor";
import type { MerchantWidgetDto } from "@/lib/widget/settings";

type TabId = "button" | "extra";

type Props = {
  initial: MerchantWidgetDto;
  shopName: string;
  storeUrl: string | null;
  catalogStatus: string | null;
  /** Deep-link from Kezdőlap discovery (?tab=extra). */
  initialTab?: TabId;
  embedToken?: string | null;
};

/** Shoprenter embed widget page — shared editor + EmbedShell. */
export function EmbedWidgetEditor({
  initial,
  shopName,
  storeUrl,
  catalogStatus,
  initialTab = "button",
  embedToken,
}: Props) {
  return (
    <WidgetEditor
      surface="embed"
      initial={initial}
      shopName={shopName}
      storeUrl={storeUrl}
      catalogStatus={catalogStatus}
      initialTab={initialTab}
      embedToken={embedToken}
    />
  );
}
