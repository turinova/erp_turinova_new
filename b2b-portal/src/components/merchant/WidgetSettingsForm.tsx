"use client";

import { WidgetEditor } from "@/components/widget/WidgetEditor";
import type { MerchantWidgetDto } from "@/lib/widget/settings";

type Props = { initial: MerchantWidgetDto; apiBase: string };

/** Merchant /widget — same UI/settings as embed /sr-embed/widget. */
export function WidgetSettingsForm({ initial, apiBase }: Props) {
  return (
    <WidgetEditor
      surface="merchant"
      initial={initial}
      apiBase={apiBase}
      shopName={initial.shoprenterShopName}
      storeUrl={initial.storeUrl}
      catalogStatus={initial.catalogStatus}
    />
  );
}
