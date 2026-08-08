"use client";

import { useState } from "react";
import { Apple, Plus, Trash2, X } from "lucide-react";
import { useCustomFoods, type CustomFoodDraft } from "@/hooks/use-custom-foods";
import { createId } from "@/lib/ids";
import { MEAL_LABELS, MEAL_TYPES, type FoodEntry, type MealType } from "@/types/calorie";

const alan = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink";

const BOS: CustomFoodDraft = {
  name: "",
  brand: null,
  caloriesPer100: 0,
  proteinPer100: 0,
  carbohydratesPer100: 0,
  fatPer100: 0,
  basis: "g",
  servingGrams: null,
};

/**
 * Kendi besinlerin.
 *
 * Türk mutfağının tek kalemleri (simit, poğaça, açma) hiçbir veritabanında
 * güvenilir biçimde yok — ne barkodlu ürün ne standart gıda. Bir kez
 * tanımlanır, sonsuza kadar kullanılır.
 *
 * Buraya eklenen besinler arama zincirinin BAŞINDA: "simit yedim"
 * yazdığında dış kaynaklara hiç gidilmiyor, kendi tanımın kullanılıyor.
 */
export default function CustomFoodsPanel({
  onAdd,
}: {
  onAdd: (entry: FoodEntry) => void;
}) {
  const library = useCustomFoods();
  const [acik, setAcik] = useState(false);
  const [mealType, setMealType] = useState<MealType>("snack");
  const [taslak, setTaslak] = useState<CustomFoodDraft | null>(null);
  const [porsiyon, setPorsiyon] = useState<Record<string, string>>({});

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
      >
        <Apple size={16} aria-hidden="true" />
        Kendi besinlerim
      </button>
    );
  }

  const ekle = (food: (typeof library.foods)[number]) => {
    const gram = Number(porsiyon[food.id]);
    if (!Number.isFinite(gram) || gram <= 0) return;

    const oran = gram / 100;
    onAdd({
      id: createId(),
      name: food.name,
      brand: food.brand,
      quantity: gram,
      unit: food.basis,
      calories: food.caloriesPer100 * oran,
      protein: food.proteinPer100 * oran,
      carbohydrates: food.carbohydratesPer100 * oran,
      fat: food.fatPer100 * oran,
      mealType,
      source: "custom",
      sourceFoodId: food.id,
      originalCalories: null,
      originalProtein: null,
      originalCarbohydrates: null,
      originalFat: null,
      manuallyEdited: false,
      consumedAt: new Date().toISOString(),
    } as FoodEntry);

    setPorsiyon((p) => ({ ...p, [food.id]: "" }));
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <h3 className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold text-ink">
          <Apple size={18} className="shrink-0 text-brand" aria-hidden="true" />
          Kendi besinlerim
        </h3>
        <button
          type="button"
          onClick={() => setAcik(false)}
          aria-label="Kapat"
          className="grid h-11 w-11 place-items-center rounded-xl text-ink-soft hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {MEAL_TYPES.map((meal) => (
          <button
            key={meal}
            type="button"
            aria-pressed={meal === mealType}
            onClick={() => setMealType(meal)}
            className={`min-h-11 rounded-xl border px-3 text-sm font-medium transition-colors ${
              meal === mealType
                ? "border-brand bg-brand text-white"
                : "border-line text-ink-soft hover:border-brand hover:text-brand"
            }`}
          >
            {MEAL_LABELS[meal]}
          </button>
        ))}
      </div>

      {library.error && <p className="mt-2 text-sm text-danger">{library.error}</p>}

      {library.hydrated && library.foods.length === 0 && (
        <p className="mt-3 text-sm text-ink-soft">
          Simit, poğaça gibi veritabanlarında bulunmayan besinleri bir kez
          tanımla. Sonra &ldquo;simit yedim&rdquo; yazdığında bu değer kullanılır.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {library.foods.map((food) => (
          <li
            key={food.id}
            className="flex items-center gap-2 rounded-xl border border-line p-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{food.name}</p>
              <p className="text-xs text-ink-soft">
                {Math.round(food.caloriesPer100)} kcal/100 {food.basis}
                {food.servingGrams ? ` · 1 adet ≈ ${food.servingGrams} g` : ""}
              </p>
            </div>

            <input
              type="number"
              inputMode="numeric"
              value={porsiyon[food.id] ?? ""}
              onChange={(e) => setPorsiyon((p) => ({ ...p, [food.id]: e.target.value }))}
              placeholder={food.basis}
              aria-label={`${food.name} miktarı`}
              className="min-h-11 w-20 shrink-0 rounded-xl border border-line bg-surface px-2 text-center text-sm text-ink"
            />
            {/* Porsiyon ağırlığı biliniyorsa tek tıkla bir adet */}
            {food.servingGrams && (
              <button
                type="button"
                onClick={() =>
                  setPorsiyon((p) => ({ ...p, [food.id]: String(food.servingGrams) }))
                }
                className="min-h-11 shrink-0 rounded-xl border border-line px-2 text-xs text-ink-soft hover:border-brand hover:text-brand"
              >
                1 adet
              </button>
            )}
            <button
              type="button"
              onClick={() => ekle(food)}
              className="min-h-11 shrink-0 rounded-xl bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong"
            >
              Ekle
            </button>
            <button
              type="button"
              onClick={() => library.removeFood(food.id)}
              aria-label={`${food.name} tanımını sil`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>

      {taslak === null ? (
        <button
          type="button"
          onClick={() => setTaslak({ ...BOS })}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 text-sm text-ink-soft transition-colors hover:border-brand hover:text-brand"
        >
          <Plus size={16} aria-hidden="true" />
          Yeni besin tanımla
        </button>
      ) : (
        <div className="mt-3 space-y-2 rounded-xl border border-dashed border-line-strong p-3">
          <input
            value={taslak.name}
            onChange={(e) => setTaslak({ ...taslak, name: e.target.value })}
            placeholder="Besin adı (ör. simit)"
            aria-label="Besin adı"
            className={alan}
          />

          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={taslak.caloriesPer100 || ""}
              onChange={(e) =>
                setTaslak({ ...taslak, caloriesPer100: Number(e.target.value) })
              }
              placeholder="kcal/100"
              aria-label="100 birimdeki kalori"
              className={alan}
            />
            <select
              value={taslak.basis}
              onChange={(e) =>
                setTaslak({ ...taslak, basis: e.target.value === "ml" ? "ml" : "g" })
              }
              aria-label="Birim"
              className="min-h-11 w-20 shrink-0 rounded-xl border border-line bg-surface px-2 text-sm text-ink"
            >
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </div>

          <div className="flex gap-2">
            {(
              [
                ["proteinPer100", "protein"],
                ["carbohydratesPer100", "karb."],
                ["fatPer100", "yağ"],
              ] as const
            ).map(([anahtar, etiket]) => (
              <input
                key={anahtar}
                type="number"
                inputMode="decimal"
                value={taslak[anahtar] || ""}
                onChange={(e) => setTaslak({ ...taslak, [anahtar]: Number(e.target.value) })}
                placeholder={etiket}
                aria-label={`100 birimdeki ${etiket}`}
                className={alan}
              />
            ))}
          </div>

          <input
            type="number"
            inputMode="numeric"
            value={taslak.servingGrams ?? ""}
            onChange={(e) =>
              setTaslak({
                ...taslak,
                servingGrams: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="1 adet kaç gram? (opsiyonel)"
            aria-label="Bir adedin ağırlığı"
            className={alan}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!taslak.name.trim() || !(taslak.caloriesPer100 >= 0)) return;
                library.addFood({ ...taslak, name: taslak.name.trim() });
                setTaslak(null);
              }}
              className="min-h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong"
            >
              Kaydet
            </button>
            <button
              type="button"
              onClick={() => setTaslak(null)}
              className="min-h-11 rounded-xl border border-line px-4 text-sm text-ink hover:border-brand hover:text-brand"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
