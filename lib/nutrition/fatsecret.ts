import type {
  NutritionProvider,
  NutritionSearchQuery,
  NutritionSearchResult,
} from "@/types/nutrition";

const TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const API_URL = "https://platform.fatsecret.com/rest/server.api";
const TIMEOUT_MS = 12_000;

let cachedToken: { value: string; expiresAt: number } | null = null;

function credentials(): { id: string; secret: string } | null {
  const id = process.env.FATSECRET_CLIENT_ID ?? "";
  const secret = process.env.FATSECRET_CLIENT_SECRET ?? "";
  return id && secret ? { id, secret } : null;
}

async function getAccessToken(signal?: AbortSignal): Promise<string | null> {
  const creds = credentials();
  if (!creds) return null;

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  try {
    const basic = Buffer.from(`${creds.id}:${creds.secret}`).toString("base64");
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=basic",
      signal,
    });
    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null) return null;

    const record = data as { access_token?: unknown; expires_in?: unknown };
    if (typeof record.access_token !== "string") return null;

    const ttl = typeof record.expires_in === "number" ? record.expires_in : 3600;
    cachedToken = {
      value: record.access_token,
      expiresAt: Date.now() + (ttl - 60) * 1000,
    };
    return cachedToken.value;
  } catch {
    return null;
  }
}

/**
 * FatSecret ücretsiz katmanı besin değerlerini serbest metinde döndürür:
 * "Per 100g - Calories: 165kcal | Fat: 3.57g | Carbs: 0.00g | Protein: 31.02g"
 * Bu metinden 100 g bazlı değerleri çıkarır. Porsiyon bazlıysa gramına böler.
 */
function parseDescription(description: string): {
  caloriesPer100: number;
  proteinPer100: number;
  carbohydratesPer100: number;
  fatPer100: number;
  basis: "g" | "ml";
} | null {
  const amount = (label: string): number | null => {
    const match = description.match(new RegExp(`${label}:\\s*([\\d.,]+)`, "i"));
    if (!match) return null;
    const value = Number(match[1].replace(",", "."));
    return Number.isFinite(value) ? value : null;
  };

  const calories = amount("Calories");
  if (calories === null) return null;

  // "Per 100g" / "Per 100ml" / "Per 1 serving (30 g)" gibi başlıkları çöz
  const perMatch = description.match(/Per\s+([\d.,]+)\s*(g|ml)\b/i);
  const basis: "g" | "ml" = /ml\b/i.test(perMatch?.[2] ?? "") ? "ml" : "g";
  const perAmount = perMatch ? Number(perMatch[1].replace(",", ".")) : 100;
  const factor = Number.isFinite(perAmount) && perAmount > 0 ? 100 / perAmount : 1;

  return {
    caloriesPer100: calories * factor,
    proteinPer100: (amount("Protein") ?? 0) * factor,
    carbohydratesPer100: (amount("Carbs") ?? 0) * factor,
    fatPer100: (amount("Fat") ?? 0) * factor,
    basis,
  };
}

function toResult(food: Record<string, unknown>): NutritionSearchResult | null {
  const name = food.food_name;
  const description = food.food_description;
  if (typeof name !== "string" || typeof description !== "string") return null;

  const per100 = parseDescription(description);
  if (!per100) return null;

  const brand = food.brand_name;

  return {
    provider: "fatsecret",
    foodId: String(food.food_id ?? name),
    name,
    brand: typeof brand === "string" && brand ? brand : null,
    per100,
    servingGrams: null,
  };
}

/** FatSecret — Türk yemekleri, restoran ve genel gıdalarda ana kaynak. */
export const fatSecretProvider: NutritionProvider = {
  name: "fatsecret",

  isConfigured() {
    return credentials() !== null;
  },

  async search(query: NutritionSearchQuery, signal?: AbortSignal) {
    const token = await getAccessToken(signal);
    if (!token) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);

    try {
      const expression = [query.brand, query.query].filter(Boolean).join(" ");
      // region+language olmadan ABD veritabanı dönüyor. Türk mutfağı için
      // FatSecret'in asıl değeri Türkiye kataloğunda (fatsecret.com.tr);
      // bu iki parametre olmadan USDA'dan farkı kalmıyor.
      const url =
        `${API_URL}?method=foods.search&format=json&max_results=5` +
        `&region=TR&language=tr` +
        `&search_expression=${encodeURIComponent(expression)}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) return [];

      const data: unknown = await response.json();
      if (typeof data !== "object" || data === null) return [];

      const foodsContainer = (data as { foods?: unknown }).foods;
      if (typeof foodsContainer !== "object" || foodsContainer === null) return [];

      const rawFood = (foodsContainer as { food?: unknown }).food;
      // Tek sonuçta obje, çoklu sonuçta dizi döner
      const list = Array.isArray(rawFood) ? rawFood : rawFood ? [rawFood] : [];

      return list
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map(toResult)
        .filter((item): item is NutritionSearchResult => item !== null);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  },
};
