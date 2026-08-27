import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth/require";

export const metadata: Metadata = {
  title: "Tudásbázis",
};

export default async function TudasbazisPage() {
  await requireMerchant();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <h1 className="text-[20px] font-semibold tracking-tight text-text">
        Tudásbázis
      </h1>
      <p className="mt-2 text-[13px] text-faint">
        A súgó hamarosan ide kerül.
      </p>
    </div>
  );
}
