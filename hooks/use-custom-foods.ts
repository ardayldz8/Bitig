"use client";

import { useCallback } from "react";
import { useCloudCollection } from "@/hooks/use-cloud-collection";
import { createId } from "@/lib/ids";
import type { Row } from "@/lib/cloud/mappers";

export type CustomFood = {
  id: string;
  name: string;
  brand: string | null;
  caloriesPer100: number;
  proteinPer100: number;
  carbohydratesPer100: number;
  fatPer100: number;
  basis: "g" | "ml";
  /** Bir adedin kaç gram olduğu; bilinmiyorsa null — uydurulmuyor. */
  servingGrams: number | null;
};

export type CustomFoodDraft = Omit<CustomFood, "id">;

function sayi(row: Row, key: string): number {
  const value = row[key];
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function rowToCustomFood(row: Row): CustomFood | null {
  const id = row.id;
  const name = row.name;
  if (typeof id !== "string" || typeof name !== "string") return null;

  const porsiyon = row.serving_grams;
  return {
    id,
    name,
    brand: typeof row.brand === "string" && row.brand ? row.brand : null,
    caloriesPer100: sayi(row, "calories_per_100"),
    proteinPer100: sayi(row, "protein_per_100"),
    carbohydratesPer100: sayi(row, "carbohydrates_per_100"),
    fatPer100: sayi(row, "fat_per_100"),
    basis: row.basis === "ml" ? "ml" : "g",
    servingGrams:
      porsiyon === null || porsiyon === undefined ? null : sayi(row, "serving_grams"),
  };
}

export type CustomFoodLibrary = {
  foods: CustomFood[];
  hydrated: boolean;
  error: string | null;
  addFood: (draft: CustomFoodDraft) => void;
  removeFood: (id: string) => void;
};

export function useCustomFoods(): CustomFoodLibrary {
  const collection = useCloudCollection<CustomFood>({
    table: "custom_foods",
    orderColumn: "name",
    ascending: true,
    toItem: rowToCustomFood,
  });

  const { mutate } = collection;

  const addFood = useCallback(
    (draft: CustomFoodDraft) => {
      const food: CustomFood = { ...draft, id: createId() };
      mutate(
        (previous) => [...previous, food],
        (client, userId) =>
          client.from("custom_foods").insert({
            id: food.id,
            user_id: userId,
            name: food.name,
            brand: food.brand,
            calories_per_100: food.caloriesPer100,
            protein_per_100: food.proteinPer100,
            carbohydrates_per_100: food.carbohydratesPer100,
            fat_per_100: food.fatPer100,
            basis: food.basis,
            serving_grams: food.servingGrams,
          }),
        "Besin eklenemedi",
      );
    },
    [mutate],
  );

  const removeFood = useCallback(
    (id: string) => {
      mutate(
        (previous) => previous.filter((food) => food.id !== id),
        (client) => client.from("custom_foods").delete().eq("id", id),
        "Besin silinemedi",
      );
    },
    [mutate],
  );

  return {
    foods: collection.items,
    hydrated: collection.hydrated,
    error: collection.error,
    addFood,
    removeFood,
  };
}
