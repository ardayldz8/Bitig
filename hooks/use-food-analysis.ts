"use client";

import { getBrowserClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { checkImageBeforeUpload, prepareImage } from "@/lib/calorie/image";
import { buildRow, recalcRow, type DetectedItem } from "@/lib/calorie/rows";
import type { AnalysisStage, DetectedFood, ResolvedNutrition } from "@/types/calorie";
import type { FoodKind, FoodUnit } from "@/types/nutrition";

/** Hem görsel hem metin akışı aynı yapıyı üretir. */
type VisionItem = DetectedItem;

type VisionResult = {
  imageType: "meal" | "packaged_product" | "nutrition_label" | "barcode" | "unknown";
  barcode: string | null;
  overallConfidence: number;
  hasUnreadableText: boolean;
  detectedItems: VisionItem[];
  needsUserConfirmation: boolean;
};

export type AnalysisOutcome = {
  rows: DetectedFood[];
  /** Hiç yiyecek bulunamadı (boş/alakasız fotoğraf). */
  noFoodFound: boolean;
  /** En az bir yiyecek için doğrulanmış besin verisi yok. */
  hasUnresolved: boolean;
  lowConfidence: boolean;
  /** Metinden çıkarılamayan noktalar (ör. "kaşar peyniri miktarı"). */
  unclear?: string[];
  /**
   * Besin kaynağı geçici olarak yanıt vermedi (hız sınırı).
   * "Bulunamadı"dan ayrı tutulur: biri kalıcı, diğeri birkaç dakikalık.
   */
  sourceUnavailable?: string | null;
};

export type FoodAnalysis = {
  stage: AnalysisStage;
  error: string | null;
  outcome: AnalysisOutcome | null;
  isBusy: boolean;
  analyzeImage: (file: File) => Promise<void>;
  analyzeBarcode: (barcode: string) => Promise<void>;
  /** Serbest metinden ("iki dilim tost yedim") yiyecek çıkarır. */
  analyzeDescription: (text: string) => Promise<void>;
  updateRow: (rowId: string, patch: Partial<DetectedFood>) => void;
  removeRow: (rowId: string) => void;
  reset: () => void;
};

const GENERIC_ERROR = "Bir şeyler ters gitti. Tekrar dener misin?";

export function useFoodAnalysis(): FoodAnalysis {
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AnalysisOutcome | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Unmount sonrası state güncellemesi yapılmaz, uçan istek iptal edilir
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const safeSet = useCallback(<T,>(setter: (value: T) => void, value: T) => {
    if (mountedRef.current) setter(value);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setStage("idle");
    setError(null);
    setOutcome(null);
  }, []);

  const runSearch = useCallback(
    async (
      items: { name: string; brand: string | null; queries: string[]; barcode: string | null; kind: FoodKind }[],
      signal: AbortSignal,
    ): Promise<{ matches: (ResolvedNutrition | null)[]; warning: string | null }> => {
      const bos = { matches: items.map(() => null), warning: null };

      /*
       * Oturum jetonu gönderiliyor: uç, kullanıcının KENDİ tanımladığı
       * besinlere önce bakıyor. Jeton olmadan o adım atlanır ve doğrudan
       * dış kaynaklara gidilir — yani jeton yoksa da çalışır, sadece
       * kişisel tanımlar devreye girmez.
       */
      const client = getBrowserClient();
      const { data: oturum } = (await client?.auth.getSession()) ?? { data: { session: null } };
      const token = oturum.session?.access_token;

      const response = await fetch("/api/food/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ items }),
        signal,
      });

      if (!response.ok) return bos;

      const data: unknown = await response.json();
      if (typeof data !== "object" || data === null) return bos;

      // Kaynak erişilemezliği burada taşınır; atılırsa kullanıcı "hiç
      // bulmuyor" sanır, oysa birkaç dakika sonra çalışacak.
      const raw = (data as { warning?: unknown }).warning;
      const warning = typeof raw === "string" && raw.length > 0 ? raw : null;

      const matches = (data as { matches?: unknown }).matches;
      if (!Array.isArray(matches)) return { ...bos, warning };

      return {
        warning,
        matches: items.map((_, index) => {
          const entry = matches[index];
          if (typeof entry !== "object" || entry === null) return null;
          const match = (entry as { match?: unknown }).match;
          return isResolved(match) ? match : null;
        }),
      };
    },
    [],
  );

  const analyzeImage = useCallback(
    async (file: File) => {
      if (busyRef.current) return; // aynı isteğin art arda gönderilmesini engelle

      const localError = checkImageBeforeUpload(file);
      if (localError) {
        setError(localError);
        setStage("error");
        return;
      }

      busyRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setOutcome(null);
      safeSet(setStage, "preparing" as AnalysisStage);

      try {
        const prepared = await prepareImage(file);
        if (controller.signal.aborted) return;

        safeSet(setStage, "recognizing" as AnalysisStage);
        const form = new FormData();
        form.append("image", prepared.file);

        const response = await fetch("/api/food/analyze", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(readError(payload) ?? GENERIC_ERROR);
        }

        const vision = readVision(payload);
        if (!vision) throw new Error(GENERIC_ERROR);

        if (vision.detectedItems.length === 0) {
          safeSet(setOutcome, {
            rows: [],
            noFoodFound: true,
            hasUnresolved: false,
            lowConfidence: vision.overallConfidence < 0.5,
          });
          safeSet(setStage, "done" as AnalysisStage);
          return;
        }

        safeSet(setStage, "searching" as AnalysisStage);
        const requestItems = vision.detectedItems.slice(0, 10).map((item) => ({
          name: item.name,
          brand: item.brand,
          queries: item.searchQueries.length > 0 ? item.searchQueries : [item.name],
          barcode: vision.barcode,
          kind: inferKind(vision.imageType, item.brand),
        }));

        const { matches, warning } = await runSearch(requestItems, controller.signal);
        if (controller.signal.aborted) return;

        safeSet(setStage, "calculating" as AnalysisStage);
        const rows = vision.detectedItems.slice(0, 10).map((item, index) =>
          buildRow(item, matches[index] ?? null),
        );

        safeSet(setOutcome, {
          rows,
          noFoodFound: false,
          hasUnresolved: rows.some((row) => row.match === null),
          lowConfidence: vision.overallConfidence < 0.7 || vision.hasUnreadableText,
          sourceUnavailable: warning,
        });
        safeSet(setStage, "done" as AnalysisStage);
      } catch (caught) {
        if (controller.signal.aborted) return;
        safeSet(setError, caught instanceof Error ? caught.message : GENERIC_ERROR);
        safeSet(setStage, "error" as AnalysisStage);
      } finally {
        busyRef.current = false;
      }
    },
    [runSearch, safeSet],
  );

  /**
   * Serbest metinden yiyecek ekleme.
   *
   * Fotoğraf akışıyla aynı boru hattını kullanır: model yalnızca ne yendiğini
   * çıkarır, besin değerleri yine `/api/food/search` üzerinden kaynaklardan
   * gelir. Miktarı belirtilmemiş maddeler `unclear` olarak işaretlenir ve
   * kullanıcıya sorulur — tahmin uydurulmaz.
   */
  const analyzeDescription = useCallback(
    async (text: string) => {
      if (busyRef.current) return;

      const temiz = text.trim();
      if (temiz.length < 3) {
        setError("Ne yediğini birkaç kelimeyle yaz.");
        setStage("error");
        return;
      }

      busyRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setOutcome(null);
      safeSet(setStage, "recognizing" as AnalysisStage);

      try {
        const response = await fetch("/api/food/describe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: temiz }),
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            typeof payload === "object" && payload !== null
              ? (payload as { error?: unknown }).error
              : null;
          throw new Error(typeof message === "string" ? message : GENERIC_ERROR);
        }

        const result =
          typeof payload === "object" && payload !== null
            ? (payload as { result?: unknown }).result
            : null;
        const record =
          typeof result === "object" && result !== null
            ? (result as {
                items?: unknown;
                unclear?: unknown;
                noFoodFound?: unknown;
                overallConfidence?: unknown;
              })
            : null;

        const items = Array.isArray(record?.items) ? record.items : [];
        if (controller.signal.aborted) return;

        if (record?.noFoodFound === true || items.length === 0) {
          safeSet(setOutcome, {
            rows: [],
            noFoodFound: true,
            hasUnresolved: false,
            lowConfidence: false,
          });
          safeSet(setStage, "done" as AnalysisStage);
          return;
        }

        const normalized = items
          .map(toVisionItem)
          .filter((item): item is VisionItem => item !== null)
          .slice(0, 10);

        safeSet(setStage, "searching" as AnalysisStage);
        const { matches, warning } = await runSearch(
          normalized.map((item) => ({
            name: item.name,
            brand: item.brand,
            queries: item.searchQueries.length > 0 ? item.searchQueries : [item.name],
            barcode: null,
            kind: inferKind("meal", item.brand),
          })),
          controller.signal,
        );
        if (controller.signal.aborted) return;

        safeSet(setStage, "calculating" as AnalysisStage);
        const rows = normalized.map((item, index) => buildRow(item, matches[index] ?? null));

        const belirsiz = Array.isArray(record?.unclear)
          ? record.unclear.filter((item): item is string => typeof item === "string")
          : [];

        safeSet(setOutcome, {
          rows,
          noFoodFound: false,
          hasUnresolved: rows.some((row) => row.match === null),
          lowConfidence:
            typeof record?.overallConfidence === "number"
              ? record.overallConfidence < 0.7
              : false,
          sourceUnavailable: warning,
          // Modelin metinden çıkaramadığı noktalar kullanıcıya gösterilir
          unclear: belirsiz.length > 0 ? belirsiz : undefined,
        });
        safeSet(setStage, "done" as AnalysisStage);
      } catch (caught) {
        if (controller.signal.aborted) return;
        safeSet(setError, caught instanceof Error ? caught.message : GENERIC_ERROR);
        safeSet(setStage, "error" as AnalysisStage);
      } finally {
        busyRef.current = false;
      }
    },
    [runSearch, safeSet],
  );

  const analyzeBarcode = useCallback(
    async (barcode: string) => {
      if (busyRef.current) return;

      busyRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setOutcome(null);
      safeSet(setStage, "searching" as AnalysisStage);

      try {
        const response = await fetch("/api/food/barcode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode }),
          signal: controller.signal,
        });

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(readError(payload) ?? GENERIC_ERROR);
        }

        const match =
          typeof payload === "object" && payload !== null
            ? (payload as { match?: unknown }).match
            : null;

        safeSet(setStage, "calculating" as AnalysisStage);

        if (!isResolved(match)) {
          safeSet(setOutcome, {
            rows: [
              buildRow(
                {
                  name: `Barkod ${barcode}`,
                  brand: null,
                  estimatedQuantity: 100,
                  unit: "g",
                  confidence: 1,
                  searchQueries: [],
                },
                null,
              ),
            ],
            noFoodFound: false,
            hasUnresolved: true,
            lowConfidence: false,
          });
        } else {
          safeSet(setOutcome, {
            rows: [
              buildRow(
                {
                  name: match.name,
                  brand: match.brand,
                  estimatedQuantity: match.servingGrams ?? 100,
                  unit: match.basis,
                  confidence: 1,
                  searchQueries: [],
                },
                match,
              ),
            ],
            noFoodFound: false,
            hasUnresolved: false,
            lowConfidence: false,
          });
        }
        safeSet(setStage, "done" as AnalysisStage);
      } catch (caught) {
        if (controller.signal.aborted) return;
        safeSet(setError, caught instanceof Error ? caught.message : GENERIC_ERROR);
        safeSet(setStage, "error" as AnalysisStage);
      } finally {
        busyRef.current = false;
      }
    },
    [safeSet],
  );

  const updateRow = useCallback((rowId: string, patch: Partial<DetectedFood>) => {
    setOutcome((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((row) => (row.rowId === rowId ? recalcRow(row, patch) : row)),
      };
    });
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setOutcome((prev) => {
      if (!prev) return prev;
      return { ...prev, rows: prev.rows.filter((row) => row.rowId !== rowId) };
    });
  }, []);

  return {
    stage,
    error,
    outcome,
    isBusy: stage === "preparing" || stage === "recognizing" || stage === "searching" || stage === "calculating",
    analyzeImage,
    analyzeBarcode,
    analyzeDescription,
    updateRow,
    removeRow,
    reset,
  };
}

function inferKind(imageType: VisionResult["imageType"], brand: string | null): FoodKind {
  if (imageType === "packaged_product" || imageType === "barcode" || brand) {
    return "branded_packaged";
  }
  if (imageType === "meal") return "turkish_or_restaurant";
  return "generic_basic";
}

function readError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const message = (payload as { error?: unknown }).error;
  return typeof message === "string" ? message : null;
}

/**
 * Modelden gelen tek bir yiyecek maddesini normalleştirir.
 *
 * Hem görsel hem metin akışı aynı yapıyı üretiyor; ayrıştırma tek yerde
 * tutuluyor ki biri değişince diğeri sessizce geride kalmasın.
 */
function toVisionItem(raw: unknown): VisionItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.name !== "string" || item.name.length === 0) return null;

  return {
    name: item.name,
    brand: typeof item.brand === "string" ? item.brand : null,
    estimatedQuantity:
      typeof item.estimatedQuantity === "number" ? item.estimatedQuantity : null,
    unit: isUnitLike(item.unit) ? item.unit : "unknown",
    confidence: typeof item.confidence === "number" ? item.confidence : 0,
    searchQueries: Array.isArray(item.searchQueries)
      ? item.searchQueries.filter((query): query is string => typeof query === "string")
      : [],
  };
}

function readVision(payload: unknown): VisionResult | null {
  if (typeof payload !== "object" || payload === null) return null;
  const result = (payload as { result?: unknown }).result;
  if (typeof result !== "object" || result === null) return null;

  const record = result as Record<string, unknown>;
  if (!Array.isArray(record.detectedItems)) return null;

  const items = record.detectedItems
    .map(toVisionItem)
    .filter((item): item is VisionItem => item !== null);

  return {
    imageType: isImageType(record.imageType) ? record.imageType : "unknown",
    barcode: typeof record.barcode === "string" ? record.barcode : null,
    overallConfidence:
      typeof record.overallConfidence === "number" ? record.overallConfidence : 0,
    hasUnreadableText: record.hasUnreadableText === true,
    detectedItems: items,
    needsUserConfirmation: record.needsUserConfirmation !== false,
  };
}

function isUnitLike(value: unknown): value is FoodUnit | "unknown" {
  return (
    value === "g" ||
    value === "ml" ||
    value === "piece" ||
    value === "portion" ||
    value === "unknown"
  );
}

function isImageType(value: unknown): value is VisionResult["imageType"] {
  return (
    value === "meal" ||
    value === "packaged_product" ||
    value === "nutrition_label" ||
    value === "barcode" ||
    value === "unknown"
  );
}

function isResolved(value: unknown): value is ResolvedNutrition {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.name === "string" &&
    typeof item.caloriesPer100 === "number" &&
    typeof item.proteinPer100 === "number" &&
    typeof item.carbohydratesPer100 === "number" &&
    typeof item.fatPer100 === "number" &&
    (item.basis === "g" || item.basis === "ml") &&
    typeof item.source === "string"
  );
}
