import type { Manga } from "@/types/manga";

const STORAGE_KEY = "bitig.mangas.v1";

function isManga(value: unknown): value is Manga {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    typeof candidate.currentChapter === "number" &&
    Number.isFinite(candidate.currentChapter) &&
    typeof candidate.rating === "number" &&
    Number.isFinite(candidate.rating) &&
    (candidate.status === "reading" || candidate.status === "completed")
  );
}

/**
 * Kayıtlı listeyi okur. Tarayıcı dışında (SSR) ya da veri bozuksa null döner —
 * çağıran taraf bu durumda varsayılan örnek veriyi kullanır.
 */
export function readStoredMangas(): Manga[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed.filter(isManga);
  } catch {
    // Bozuk JSON / erişilemeyen depolama (ör. Safari gizli mod)
    return null;
  }
}

export function writeStoredMangas(mangas: Manga[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mangas));
  } catch {
    // Depolama dolu ya da yazma engelli — uygulama çalışmaya devam etsin
  }
}
