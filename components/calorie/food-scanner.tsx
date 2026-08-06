"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Image as ImageIcon,
  PencilLine,
  RefreshCw,
  ScanBarcode,
  ScanText,
} from "lucide-react";
import { STAGE_LABELS, type AnalysisStage } from "@/types/calorie";

type ScanMode = "meal" | "label";

type FoodScannerProps = {
  stage: AnalysisStage;
  error: string | null;
  isBusy: boolean;
  onImageSelected: (file: File, mode: ScanMode) => void;
  onBarcodeDetected: (barcode: string) => void;
  onManualAdd: () => void;
  onRetry: () => void;
};

const ACCEPT = "image/jpeg,image/png,image/webp";
const STAGE_ORDER: (keyof typeof STAGE_LABELS)[] = [
  "preparing",
  "recognizing",
  "searching",
  "calculating",
];

/** BarcodeDetector desteklenmiyorsa fotoğraf yükleme fallback'i kullanılır. */
function supportsBarcodeDetector(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export default function FoodScanner({
  stage,
  error,
  isBusy,
  onImageSelected,
  onBarcodeDetected,
  onManualAdd,
  onRetry,
}: FoodScannerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [barcodeAvailable, setBarcodeAvailable] = useState(false);
  const [barcodeNote, setBarcodeNote] = useState<string | null>(null);

  // Yalnızca mount sonrası belirlenir → SSR ile uyuşmazlık olmaz
  useEffect(() => {
    setBarcodeAvailable(supportsBarcodeDetector());
  }, []);

  function handlePick(
    event: React.ChangeEvent<HTMLInputElement>,
    mode: ScanMode,
  ) {
    const file = event.target.files?.[0];
    event.target.value = ""; // aynı dosya tekrar seçilebilsin
    if (file) onImageSelected(file, mode);
  }

  async function handleBarcodeImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBarcodeNote(null);

    const globalWithDetector = window as unknown as {
      BarcodeDetector?: BarcodeDetectorCtor;
    };
    const Detector = globalWithDetector.BarcodeDetector;

    if (!Detector) {
      // Desteklenmiyorsa fotoğrafı normal ürün analizine gönder
      onImageSelected(file, "meal");
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const detector = new Detector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
      });
      const found = await detector.detect(bitmap);
      bitmap.close();

      if (found.length > 0 && found[0].rawValue) {
        onBarcodeDetected(found[0].rawValue);
      } else {
        setBarcodeNote("Barkod okunamadı — ürünü fotoğraftan tanımaya çalışıyorum.");
        onImageSelected(file, "meal");
      }
    } catch {
      setBarcodeNote("Barkod okunamadı — ürünü fotoğraftan tanımaya çalışıyorum.");
      onImageSelected(file, "meal");
    }
  }

  const currentIndex = STAGE_ORDER.indexOf(stage as keyof typeof STAGE_LABELS);

  return (
    <section
      aria-label="Yemeğini tara"
      className="rounded-card border-2 border-dashed border-line-strong bg-brand-soft/50 p-5 sm:p-6"
    >
      <div className="text-center sm:text-left">
        <h2 className="text-xl font-bold text-ink">Yemeğini Tara</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Fotoğrafını çek, yiyecekleri ve besin değerlerini otomatik bulalım.
        </p>
      </div>

      {/* Ana aksiyonlar */}
      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={isBusy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Camera size={18} aria-hidden="true" />
          Fotoğraf çek
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={isBusy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 font-medium text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImageIcon size={18} aria-hidden="true" />
          Galeriden seç
        </button>
      </div>

      {/* İkincil aksiyonlar */}
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => barcodeRef.current?.click()}
          disabled={isBusy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-3 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ScanBarcode size={17} aria-hidden="true" />
          Barkod tara
        </button>
        <button
          type="button"
          onClick={() => labelRef.current?.click()}
          disabled={isBusy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-3 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ScanText size={17} aria-hidden="true" />
          Besin etiketi tara
        </button>
        <button
          type="button"
          onClick={onManualAdd}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-3 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
        >
          <PencilLine size={17} aria-hidden="true" />
          Manuel ekle
        </button>
      </div>

      {!barcodeAvailable && (
        <p className="mt-3 text-xs text-ink-soft">
          Bu cihaz otomatik barkod okumayı desteklemiyor — barkod fotoğrafı yüklersen
          ürünü görselden tanımaya çalışırız.
        </p>
      )}
      {barcodeNote && <p className="mt-2 text-xs text-ink-soft">{barcodeNote}</p>}

      {/* Aşamalı yükleme durumu — tek sonsuz spinner yerine adım adım */}
      {isBusy && (
        <div aria-live="polite" className="mt-5 rounded-xl border border-line bg-surface p-4">
          <ol className="space-y-2">
            {STAGE_ORDER.map((key, index) => {
              const isDone = currentIndex > index;
              const isActive = currentIndex === index;
              return (
                <li key={key} className="flex items-center gap-2.5 text-sm">
                  <span
                    aria-hidden="true"
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                      isDone
                        ? "border-brand bg-brand text-white"
                        : isActive
                          ? "border-brand text-brand"
                          : "border-line text-ink-soft"
                    }`}
                  >
                    {isDone ? "✓" : index + 1}
                  </span>
                  <span className={isActive ? "font-medium text-ink" : "text-ink-soft"}>
                    {STAGE_LABELS[key]}
                    {isActive ? "…" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Hata + tekrar dene */}
      {stage === "error" && error && (
        <div
          role="alert"
          className="mt-5 flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-surface px-4 py-2 text-sm font-medium text-danger"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Tekrar dene
          </button>
        </div>
      )}

      {/* Gizli dosya girişleri */}
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        onChange={(event) => handlePick(event, "meal")}
        className="sr-only"
        aria-label="Kamera ile yemek fotoğrafı çek"
        tabIndex={-1}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPT}
        onChange={(event) => handlePick(event, "meal")}
        className="sr-only"
        aria-label="Galeriden yemek fotoğrafı seç"
        tabIndex={-1}
      />
      <input
        ref={labelRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        onChange={(event) => handlePick(event, "label")}
        className="sr-only"
        aria-label="Besin etiketi fotoğrafı yükle"
        tabIndex={-1}
      />
      <input
        ref={barcodeRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        onChange={handleBarcodeImage}
        className="sr-only"
        aria-label="Barkod fotoğrafı yükle"
        tabIndex={-1}
      />
    </section>
  );
}
