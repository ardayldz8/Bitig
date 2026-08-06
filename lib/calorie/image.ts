import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/calorie/validation";

const MAX_EDGE = 1280;
const COMPRESS_ABOVE_BYTES = 1_200_000;
const JPEG_QUALITY = 0.85;

export type PreparedImage = { file: File; wasCompressed: boolean };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    image.src = url;
  });
}

/**
 * Yüklemeden önce büyük fotoğrafları küçültür.
 * Sıkıştırma başarısız olursa orijinal dosya kullanılır (akış kesilmez).
 * Görsel HİÇBİR ŞEKİLDE kalıcı olarak saklanmaz.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const acceptable = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
  if (!acceptable) return { file, wasCompressed: false };
  if (file.size <= COMPRESS_ABOVE_BYTES) return { file, wasCompressed: false };

  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return { file, wasCompressed: false };
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    if (!blob || blob.size >= file.size) return { file, wasCompressed: false };

    const compressed = new File([blob], "upload.jpg", { type: "image/jpeg" });
    return { file: compressed, wasCompressed: true };
  } catch {
    return { file, wasCompressed: false };
  }
}

export function checkImageBeforeUpload(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Yalnızca JPEG, PNG veya WEBP yükleyebilirsin.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Fotoğraf 8 MB'tan büyük olamaz.";
  }
  return null;
}
