"use client";

import { PROJECT_TABS, TAB_LABELS, type ProjectTab } from "@/types/project";

type TabsProps = {
  active: ProjectTab;
  onChange: (tab: ProjectTab) => void;
};

export default function ProjectTabs({ active, onChange }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Proje bölümleri"
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1"
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
  );
}
