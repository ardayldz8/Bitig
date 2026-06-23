import type { Entry, Profile } from "./types";
import { dayKey } from "./store";

// Mifflin-St Jeor BMR + aktivite çarpanı = TDEE; hedef = TDEE ± goal.
const ACTIVITY: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very: 1.9,
};
const GOAL_ADJ: Record<string, number> = { lose: -500, maintain: 0, gain: 300 };

export interface CalorieTargets {
  bmr: number;
  tdee: number;
  target: number; // günlük kalori hedefi
  protein: number; // g
  carb: number; // g
  fat: number; // g
}

/** Profil tamsa kalori + makro hedeflerini hesaplar; eksikse null. */
export function computeTargets(p: Profile | null): CalorieTargets | null {
  if (!p || !p.height_cm || !p.weight_kg || !p.age || !p.sex || !p.activity) return null;
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age;
  const bmr = Math.round(base + (p.sex === "male" ? 5 : -161));
  const tdee = Math.round(bmr * (ACTIVITY[p.activity] ?? 1.2));
  const target = Math.max(1200, Math.round(tdee + (GOAL_ADJ[p.goal ?? "maintain"] ?? 0)));
  const protein = Math.round(p.weight_kg * 1.8);
  const fat = Math.round((target * 0.25) / 9);
  const carb = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));
  return { bmr, tdee, target, protein, carb, fat };
}

export interface DayNutrition {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

/** Belirli bir günün (vars. bugün) toplam besin değerleri. */
export function nutritionForDay(entries: Entry[], day: string = dayKey()): DayNutrition {
  const sum = { kcal: 0, protein: 0, carb: 0, fat: 0 };
  for (const e of entries) {
    if (e.kind === "food" && e.date === day) {
      sum.kcal += e.kcal || 0;
      sum.protein += e.protein || 0;
      sum.carb += e.carb || 0;
      sum.fat += e.fat || 0;
    }
  }
  return {
    kcal: Math.round(sum.kcal),
    protein: Math.round(sum.protein),
    carb: Math.round(sum.carb),
    fat: Math.round(sum.fat),
  };
}

export const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Hareketsiz",
  light: "Az hareketli",
  moderate: "Orta",
  active: "Aktif",
  very: "Çok aktif",
};
export const GOAL_LABELS: Record<string, string> = {
  lose: "Kilo ver",
  maintain: "Koru",
  gain: "Kilo al",
};
