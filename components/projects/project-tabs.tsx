"use client";

import { useEffect, useRef } from "react";
import { PROJECT_TABS, TAB_LABELS, type ProjectTab } from "@/types/project";

type TabsProps = {
  active: ProjectTab;
  onChange: (tab: ProjectTab) => void;
};

export default function ProjectTabs({ active, onChange }: TabsProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  /**
   * Aktif sekmeyi görünür alana kaydır.
   *
   * Sekmeler dar ekrana sığmıyor ve şerit yatay kayıyor. Adres çubuğundan
   * `?tab=ai` ile gelindiğinde ya da ok tuşlarıyla gezinildiğinde aktif sekme
   * ekran dışında kalıyordu.
   */
  useEffect(() => {
    const strip = stripRef.current;
    const button = activeRef.current;
    if (!strip || !button) return;

    const left = button.offsetLeft;
    const right = left + button.offsetWidth;
    const viewLeft = strip.scrollLeft;
    const viewRight = viewLeft + strip.clientWidth;

    // Yalnızca gerçekten dışarıdaysa kaydır; her sekme değişiminde sayfa
    // zıplamasın.
    if (left < viewLeft) {
      strip.scrollTo({ left: left - 12, behavior: "smooth" });
    } else if (right > viewRight) {
      strip.scrollTo({ left: right - strip.clientWidth + 12, behavior: "smooth" });
    }
  }, [active]);

  return (
    // Sağ kenardaki solma, şeridin devam ettiğini gösterir; yoksa "AI Asistan"
    // kesilmiş gibi duruyor ve kaydırılabildiği anlaşılmıyor.
    <div className="relative border-b border-line">
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Proje bölümleri"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onKeyDown={(event) => {
          // Klavye ile sekme gezinme (sol/sağ ok)
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const index = PROJECT_TABS.indexOf(active);
          const next =
            event.key === "ArrowRight"
              ? (index + 1) % PROJECT_TABS.length
              : (index - 1 + PROJECT_TABS.length) % PROJECT_TABS.length;
          onChange(PROJECT_TABS[next]);
        }}
      >
        {PROJECT_TABS.map((tab) => {
          const selected = tab === active;
          return (
            <button
              key={tab}
              ref={selected ? activeRef : undefined}
              role="tab"
              type="button"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab)}
              className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors ${
                selected
                  ? "border-brand text-brand"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent sm:hidden"
      />
    </div>
  );
}
