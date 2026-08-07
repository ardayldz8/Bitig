"use client";

import { useCallback, useMemo } from "react";
import { useCloudCollection } from "@/hooks/use-cloud-collection";
import { createId } from "@/lib/ids";
import type { Recipe, RecipeIngredient } from "@/lib/calorie/recipe";
import type { Row } from "@/lib/cloud/mappers";

function num(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function rowToRecipe(row: Row): Recipe | null {
  const id = row.id;
  const name = row.name;
  if (typeof id !== "string" || typeof name !== "string") return null;
  return {
    id,
    name,
    totalGrams: num(row, "total_grams"),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

function rowToIngredient(row: Row): RecipeIngredient | null {
  const id = row.id;
  const recipeId = row.recipe_id;
  const name = row.name;
  if (typeof id !== "string" || typeof recipeId !== "string" || typeof name !== "string") {
    return null;
  }
  return {
    id,
    recipeId,
    name,
    grams: num(row, "grams"),
    caloriesPer100: num(row, "calories_per_100"),
    proteinPer100: num(row, "protein_per_100"),
    carbohydratesPer100: num(row, "carbohydrates_per_100"),
    fatPer100: num(row, "fat_per_100"),
    source: typeof row.source === "string" ? row.source : "manual",
  };
}

export type IngredientDraft = Omit<RecipeIngredient, "id" | "recipeId">;

export type RecipeLibrary = {
  recipes: Recipe[];
  ingredientsByRecipe: Map<string, RecipeIngredient[]>;
  hydrated: boolean;
  error: string | null;
  addRecipe: (name: string, totalGrams: number) => string;
  updateRecipe: (id: string, name: string, totalGrams: number) => void;
  removeRecipe: (id: string) => void;
  addIngredient: (recipeId: string, draft: IngredientDraft) => void;
  removeIngredient: (id: string) => void;
};

const SADECE_YEREL = () => Promise.resolve({ error: null });

export function useRecipes(): RecipeLibrary {
  const recipeCollection = useCloudCollection<Recipe>({
    table: "recipes",
    orderColumn: "name",
    ascending: true,
    toItem: rowToRecipe,
  });

  const ingredientCollection = useCloudCollection<RecipeIngredient>({
    table: "recipe_ingredients",
    orderColumn: "created_at",
    ascending: true,
    toItem: rowToIngredient,
  });

  const { mutate: mutateRecipes } = recipeCollection;
  const { mutate: mutateIngredients } = ingredientCollection;

  const ingredientsByRecipe = useMemo(() => {
    const map = new Map<string, RecipeIngredient[]>();
    for (const item of ingredientCollection.items) {
      const list = map.get(item.recipeId) ?? [];
      list.push(item);
      map.set(item.recipeId, list);
    }
    return map;
  }, [ingredientCollection.items]);

  const addRecipe = useCallback(
    (name: string, totalGrams: number) => {
      const recipe: Recipe = {
        id: createId(),
        name,
        totalGrams,
        updatedAt: new Date().toISOString(),
      };
      mutateRecipes(
        (previous) => [...previous, recipe],
        (client, userId) =>
          client.from("recipes").insert({
            id: recipe.id,
            user_id: userId,
            name: recipe.name,
            total_grams: recipe.totalGrams,
          }),
        "Tarif eklenemedi",
      );
      return recipe.id;
    },
    [mutateRecipes],
  );

  const updateRecipe = useCallback(
    (id: string, name: string, totalGrams: number) => {
      mutateRecipes(
        (previous) =>
          previous.map((item) =>
            item.id === id
              ? { ...item, name, totalGrams, updatedAt: new Date().toISOString() }
              : item,
          ),
        (client) =>
          client
            .from("recipes")
            .update({ name, total_grams: totalGrams, updated_at: new Date().toISOString() })
            .eq("id", id),
        "Tarif güncellenemedi",
      );
    },
    [mutateRecipes],
  );

  const removeRecipe = useCallback(
    (id: string) => {
      // Malzemeler veritabanında cascade ile gidiyor; yerel listeden de düşsün
      mutateIngredients(
        (previous) => previous.filter((item) => item.recipeId !== id),
        SADECE_YEREL,
        "",
      );
      mutateRecipes(
        (previous) => previous.filter((item) => item.id !== id),
        (client) => client.from("recipes").delete().eq("id", id),
        "Tarif silinemedi",
      );
    },
    [mutateRecipes, mutateIngredients],
  );

  const addIngredient = useCallback(
    (recipeId: string, draft: IngredientDraft) => {
      const ingredient: RecipeIngredient = { ...draft, id: createId(), recipeId };
      mutateIngredients(
        (previous) => [...previous, ingredient],
        (client, userId) =>
          client.from("recipe_ingredients").insert({
            id: ingredient.id,
            user_id: userId,
            recipe_id: recipeId,
            name: ingredient.name,
            grams: ingredient.grams,
            calories_per_100: ingredient.caloriesPer100,
            protein_per_100: ingredient.proteinPer100,
            carbohydrates_per_100: ingredient.carbohydratesPer100,
            fat_per_100: ingredient.fatPer100,
            source: ingredient.source,
          }),
        "Malzeme eklenemedi",
      );
    },
    [mutateIngredients],
  );

  const removeIngredient = useCallback(
    (id: string) => {
      mutateIngredients(
        (previous) => previous.filter((item) => item.id !== id),
        (client) => client.from("recipe_ingredients").delete().eq("id", id),
        "Malzeme silinemedi",
      );
    },
    [mutateIngredients],
  );

  return {
    recipes: recipeCollection.items,
    ingredientsByRecipe,
    hydrated: recipeCollection.hydrated && ingredientCollection.hydrated,
    error: recipeCollection.error ?? ingredientCollection.error,
    addRecipe,
    updateRecipe,
    removeRecipe,
    addIngredient,
    removeIngredient,
  };
}
