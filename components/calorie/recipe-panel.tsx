"use client";

import { useState } from "react";
import { ChefHat, Plus, Trash2, X } from "lucide-react";
import { useRecipes, type IngredientDraft } from "@/hooks/use-recipes";
import {
  recipePer100,
  recipeTotals,
  totalGramsWarning,
  type Recipe,
} from "@/lib/calorie/recipe";
import { createId } from "@/lib/ids";
import { MEAL_LABELS, MEAL_TYPES, type FoodEntry, type MealType } from "@/types/calorie";

const alan = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink";

/**
 * Kendi tariflerinden porsiyon ekleme.
 *
 * Ev yapımı Türk yemekleri hiçbir besin veritabanında yok; ama malzemeleri
 * hepsinde var. Yemeği bir kez malzemelerinden tanımlamak, herhangi bir
 * genel kayıttan daha doğru sonuç veriyor — kullanıcının kendi tarifi.
 */
export default function RecipePanel({
  defaultMeal = "dinner",
  onAdd,
}: {
  defaultMeal?: MealType;
  onAdd: (entry: FoodEntry) => void;
}) {
  const library = useRecipes();
  const [acik, setAcik] = useState(false);
  // Öğün seçilebilir olmalı: sabitlemek, kahvaltıda yenen tarifi akşam
  // yemeğine yazardı ve günlük dağılım yanlış görünürdü.
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [yeniAd, setYeniAd] = useState("");
  const [yeniGram, setYeniGram] = useState("");
  const [porsiyon, setPorsiyon] = useState<Record<string, string>>({});

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
      >
        <ChefHat size={16} aria-hidden="true" />
        Tariflerim
      </button>
    );
  }

  const ekle = (recipe: Recipe) => {
    const malzemeler = library.ingredientsByRecipe.get(recipe.id) ?? [];
    const per100 = recipePer100(malzemeler, recipe.totalGrams);
    const gram = Number(porsiyon[recipe.id]);
    if (!per100 || !Number.isFinite(gram) || gram <= 0) return;

    const oran = gram / 100;
    onAdd({
      id: createId(),
      name: recipe.name,
      brand: null,
      quantity: gram,
      unit: "g",
      calories: per100.caloriesPer100 * oran,
      protein: per100.proteinPer100 * oran,
      carbohydrates: per100.carbohydratesPer100 * oran,
      fat: per100.fatPer100 * oran,
      mealType,
      source: "recipe",
      sourceFoodId: recipe.id,
      originalCalories: null,
      originalProtein: null,
      originalCarbohydrates: null,
      originalFat: null,
      manuallyEdited: false,
      consumedAt: new Date().toISOString(),
    } as FoodEntry);

    setPorsiyon((p) => ({ ...p, [recipe.id]: "" }));
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <h3 className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold text-ink">
          <ChefHat size={18} className="shrink-0 text-brand" aria-hidden="true" />
          Tariflerim
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

      {library.recipes.length === 0 && library.hydrated && (
        <p className="mt-3 text-sm text-ink-soft">
          Henüz tarif yok. Karnıyarık gibi hiçbir veritabanında bulunmayan
          yemekleri bir kez tanımla, sonra tek tıkla ekle.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {library.recipes.map((recipe) => {
          const malzemeler = library.ingredientsByRecipe.get(recipe.id) ?? [];
          const per100 = recipePer100(malzemeler, recipe.totalGrams);
          const acikMi = duzenlenen === recipe.id;

          return (
            <li key={recipe.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDuzenlenen(acikMi ? null : recipe.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block text-sm font-semibold text-ink">{recipe.name}</span>
                  <span className="block text-xs text-ink-soft">
                    {per100
                      ? `${Math.round(per100.caloriesPer100)} kcal/100 g · ${malzemeler.length} malzeme`
                      : "malzeme ekle"}
                  </span>
                </button>

                {per100 && (
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={porsiyon[recipe.id] ?? ""}
                      onChange={(e) =>
                        setPorsiyon((p) => ({ ...p, [recipe.id]: e.target.value }))
                      }
                      placeholder="gram"
                      aria-label={`${recipe.name} porsiyonu (gram)`}
                      className="min-h-11 w-20 shrink-0 rounded-xl border border-line bg-surface px-2 text-center text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => ekle(recipe)}
                      className="min-h-11 shrink-0 rounded-xl bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong"
                    >
                      Ekle
                    </button>
                  </>
                )}
              </div>

              {acikMi && (
                <IngredientEditor
                  recipe={recipe}
                  ingredients={malzemeler}
                  onAddIngredient={(draft) => library.addIngredient(recipe.id, draft)}
                  onRemoveIngredient={library.removeIngredient}
                  onRemoveRecipe={() => {
                    library.removeRecipe(recipe.id);
                    setDuzenlenen(null);
                  }}
                  onChangeTotal={(gram) => library.updateRecipe(recipe.id, recipe.name, gram)}
                />
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex gap-2 rounded-xl border border-dashed border-line-strong p-3">
        <input
          value={yeniAd}
          onChange={(e) => setYeniAd(e.target.value)}
          placeholder="Tarif adı"
          aria-label="Yeni tarif adı"
          className={alan}
        />
        <input
          type="number"
          inputMode="numeric"
          value={yeniGram}
          onChange={(e) => setYeniGram(e.target.value)}
          placeholder="pişmiş g"
          aria-label="Pişmiş toplam ağırlık"
          className="min-h-11 w-28 shrink-0 rounded-xl border border-line bg-surface px-2 text-center text-ink"
        />
        <button
          type="button"
          onClick={() => {
            const gram = Number(yeniGram);
            if (!yeniAd.trim() || !Number.isFinite(gram) || gram <= 0) return;
            const id = library.addRecipe(yeniAd.trim(), gram);
            setYeniAd("");
            setYeniGram("");
            setDuzenlenen(id);
          }}
          aria-label="Tarif oluştur"
          className="grid min-h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white hover:bg-brand-strong"
        >
          <Plus size={18} />
        </button>
      </div>
    </section>
  );
}

function IngredientEditor({
  recipe,
  ingredients,
  onAddIngredient,
  onRemoveIngredient,
  onRemoveRecipe,
  onChangeTotal,
}: {
  recipe: Recipe;
  ingredients: ReturnType<typeof useRecipes>["ingredientsByRecipe"] extends Map<
    string,
    infer T
  >
    ? T
    : never;
  onAddIngredient: (draft: IngredientDraft) => void;
  onRemoveIngredient: (id: string) => void;
  onRemoveRecipe: () => void;
  onChangeTotal: (grams: number) => void;
}) {
  const [ad, setAd] = useState("");
  const [gram, setGram] = useState("");
  const [kcal, setKcal] = useState("");

  const toplam = recipeTotals(ingredients);
  const uyari = totalGramsWarning(toplam.ingredientGrams, recipe.totalGrams);

  return (
    <div className="mt-3 border-t border-line pt-3">
      {ingredients.length > 0 && (
        <ul className="mb-2 space-y-1">
          {ingredients.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-ink">{item.name}</span>
              <span className="shrink-0 tabular-nums text-ink-soft">
                {item.grams} g · {Math.round((item.caloriesPer100 * item.grams) / 100)} kcal
              </span>
              <button
                type="button"
                onClick={() => onRemoveIngredient(item.id)}
                aria-label={`${item.name} malzemesini sil`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:text-danger"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <input
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          placeholder="malzeme"
          aria-label="Malzeme adı"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-2 text-sm text-ink"
        />
        <input
          type="number"
          inputMode="numeric"
          value={gram}
          onChange={(e) => setGram(e.target.value)}
          placeholder="g"
          aria-label="Malzeme gramı"
          className="min-h-11 w-16 shrink-0 rounded-xl border border-line bg-surface px-1 text-center text-sm text-ink"
        />
        <input
          type="number"
          inputMode="numeric"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          placeholder="kcal/100"
          aria-label="100 gramdaki kalori"
          className="min-h-11 w-20 shrink-0 rounded-xl border border-line bg-surface px-1 text-center text-sm text-ink"
        />
        <button
          type="button"
          onClick={() => {
            const g = Number(gram);
            const k = Number(kcal);
            if (!ad.trim() || !Number.isFinite(g) || g <= 0 || !Number.isFinite(k) || k < 0) return;
            onAddIngredient({
              name: ad.trim(),
              grams: g,
              caloriesPer100: k,
              proteinPer100: 0,
              carbohydratesPer100: 0,
              fatPer100: 0,
              source: "manual",
            });
            setAd("");
            setGram("");
            setKcal("");
          }}
          aria-label="Malzeme ekle"
          className="grid min-h-11 w-11 shrink-0 place-items-center rounded-xl border border-line text-ink-soft hover:border-brand hover:text-brand"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <label className="text-xs text-ink-soft" htmlFor={`toplam-${recipe.id}`}>
          Pişmiş toplam
        </label>
        <input
          id={`toplam-${recipe.id}`}
          type="number"
          inputMode="numeric"
          defaultValue={recipe.totalGrams}
          onBlur={(e) => {
            const g = Number(e.target.value);
            if (Number.isFinite(g) && g > 0) onChangeTotal(g);
          }}
          className="min-h-11 w-24 rounded-xl border border-line bg-surface px-2 text-center text-sm text-ink"
        />
        <span className="text-xs text-ink-soft">
          g (malzeme: {Math.round(toplam.ingredientGrams)} g)
        </span>
        <button
          type="button"
          onClick={onRemoveRecipe}
          className="ml-auto min-h-11 rounded-xl px-2 text-xs text-ink-soft hover:text-danger"
        >
          Tarifi sil
        </button>
      </div>

      {uyari && (
        <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
          {uyari}
        </p>
      )}
    </div>
  );
}
