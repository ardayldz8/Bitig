import { z } from "zod";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ImageValidationError =
  | "missing"
  | "too_large"
  | "bad_mime"
  | "bad_content";

const MESSAGES: Record<ImageValidationError, string> = {
  missing: "Fotoğraf bulunamadı.",
  too_large: "Fotoğraf 8 MB'tan büyük olamaz.",
  bad_mime: "Yalnızca JPEG, PNG veya WEBP yükleyebilirsin.",
  bad_content: "Dosya içeriği geçerli bir görsel değil.",
};

export function imageErrorMessage(error: ImageValidationError): string {
  return MESSAGES[error];
}

/**
 * Dosyanın gerçekten görsel olduğunu MAGIC BYTES ile doğrular.
 * MIME type'a tek başına güvenilmez — istemci onu serbestçe değiştirebilir.
 */
function hasImageSignature(bytes: Uint8Array): boolean {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return true;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, index) => bytes[index] === byte)) {
    return true;
  }
  // WEBP: "RIFF" .... "WEBP"
  if (bytes.length >= 12) {
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (riff === "RIFF" && webp === "WEBP") return true;
  }
  return false;
}

export type ValidatedImage = { dataUrl: string; mimeType: string; bytes: number };

/** Sunucu tarafı dosya doğrulaması: boyut + MIME + içerik imzası. */
export async function validateImageFile(
  file: unknown,
): Promise<{ ok: true; image: ValidatedImage } | { ok: false; error: ImageValidationError }> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "missing" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "too_large" };
  }

  const declared = file.type;
  const isAccepted = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(declared);
  if (!isAccepted) {
    return { ok: false, error: "bad_mime" };
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!hasImageSignature(bytes)) {
    return { ok: false, error: "bad_content" };
  }

  const base64 = Buffer.from(buffer).toString("base64");
  return {
    ok: true,
    image: {
      dataUrl: `data:${declared};base64,${base64}`,
      mimeType: declared,
      bytes: file.size,
    },
  };
}

// --- API istek gövdeleri ---

export const searchRequestSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        brand: z.string().max(80).nullable().default(null),
        queries: z.array(z.string().min(1).max(120)).max(6).default([]),
        barcode: z.string().regex(/^\d{6,20}$/).nullable().default(null),
        kind: z
          .enum(["branded_packaged", "turkish_or_restaurant", "generic_basic"])
          .default("generic_basic"),
      }),
    )
    .min(1)
    .max(10),
});

export const barcodeRequestSchema = z.object({
  barcode: z.string().regex(/^\d{6,20}$/, "Geçersiz barkod."),
});

// --- Manuel giriş formu doğrulaması (istemci) ---

export type ManualFormValues = {
  name: string;
  brand: string;
  quantity: string;
  unit: string;
  calories: string;
  protein: string;
  carbohydrates: string;
  fat: string;
  mealType: string;
  consumedAt: string;
};

export type ManualFormErrors = Partial<Record<keyof ManualFormValues, string>>;

/** "8,5" gibi virgüllü girdileri de kabul eder. */
export function parseDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function validateManualForm(values: ManualFormValues): ManualFormErrors {
  const errors: ManualFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Yiyecek adı zorunlu.";
  }

  const quantity = parseDecimal(values.quantity);
  if (quantity === null) {
    errors.quantity = "Geçerli bir miktar gir.";
  } else if (quantity <= 0) {
    errors.quantity = "Miktar sıfırdan büyük olmalı.";
  }

  const numericFields: {
    key: keyof ManualFormValues;
    label: string;
  }[] = [
    { key: "calories", label: "Kalori" },
    { key: "protein", label: "Protein" },
    { key: "carbohydrates", label: "Karbonhidrat" },
    { key: "fat", label: "Yağ" },
  ];

  for (const field of numericFields) {
    const value = parseDecimal(values[field.key]);
    if (value === null) {
      errors[field.key] = `Geçerli bir ${field.label.toLowerCase()} değeri gir.`;
    } else if (value < 0) {
      errors[field.key] = `${field.label} negatif olamaz.`;
    }
  }

  if (!values.consumedAt) {
    errors.consumedAt = "Tarih ve saat gerekli.";
  }

  return errors;
}
