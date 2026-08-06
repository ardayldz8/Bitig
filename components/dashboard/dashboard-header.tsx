import { Sparkles } from "lucide-react";
import { GreetingTitle, TodayDate } from "@/components/dashboard/dashboard-greeting";

/**
 * Sunucu bileşeni. Yalnızca tarih ve karşılama adı istemci tarafında
 * çözülür (gerçek yerel saat + oturum bilgisi gerektirdikleri için).
 */
export default function DashboardHeader() {
  return (
    <header>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="inline-flex items-center gap-1.5 text-lg font-semibold text-brand">
          Bitig
          <Sparkles size={15} aria-hidden="true" />
        </p>

        <TodayDate />
      </div>

      <GreetingTitle />
      <p className="mt-1.5 text-ink-soft">Bugün neye devam etmek istiyorsun?</p>
    </header>
  );
}
