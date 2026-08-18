import type { Metadata } from "next";
import { PlatformSettingsForm } from "@/components/platform/PlatformSettingsForm";
import { PlatformShell } from "@/components/platform/PlatformShell";

export const metadata: Metadata = {
  title: "Platform beállítások",
};

export default function PlatformSettingsPage() {
  return (
    <PlatformShell title="Beállítások" nav="settings">
      <div className="mx-auto w-full max-w-[920px]">
        <PlatformSettingsForm />
      </div>
    </PlatformShell>
  );
}
