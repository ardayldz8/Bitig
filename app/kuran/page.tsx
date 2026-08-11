import { Suspense } from "react";
import type { Metadata } from "next";
import QuranPage from "@/components/quran/quran-page";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Kur'an-ı Kerim",
  description: "Belirlediğin vakitlerde ayet bildirimi al, beğendiklerini kaydet.",
};

export default function Kuran() {
  /*
   * Suspense şart: sayfa bildirimden `?ayet=<id>` ile açılıyor ve
   * `useSearchParams` sarmalanmadan derleme sırasında hata veriyor.
   */
  return (
    <Suspense fallback={null}>
      <QuranPage vapidPublicKey={env.vapidPublicKey()} />
    </Suspense>
  );
}
