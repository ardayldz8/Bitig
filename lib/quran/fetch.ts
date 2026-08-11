import { MIRROR_EDITIONS, editionName, type VerseRef } from "@/lib/quran/editions";
import { sameTranslation, sameVerse } from "@/lib/quran/normalize";

/**
 * Ayet metnini çeker ve BAĞIMSIZ kaynaklarla karşılaştırır.
 *
 * Neden çapraz doğrulama: Kur'an metninde tek harf hata kabul edilemez ve
 * tek kaynağa güvenmenin bir yolu yok — API sessizce bozuk veri dönebilir,
 * yanlış ayeti verebilir ya da ele geçirilmiş olabilir. Üç bağımsız kaynak
 * aynı şeyi söylüyorsa metin doğrudur; söylemiyorsa gönderilmez.
 *
 * ARAPÇA metin ile MEAL farklı muamele görüyor:
 * - Arapça değişmez; iki kaynak ayrışıyorsa ortada bir sorun var → ayet
 *   kullanılmaz.
 * - Meal mütercimin yorumu. Burada doğrulanan "doğru meal mi" değil, "bu
 *   gerçekten o mütercimin metni mi". Teyit edilemezse meal yine gösterilir
 *   ama teyitsiz olduğu İŞARETLENİR — sessizce güvenilir göstermek yanlış
 *   olurdu.
 */

/**
 * Mealin teyit durumu.
 *
 * ÜÇ ayrı durum, iki değil: "kaynak farklı metin verdi" ile "kaynağa
 * ulaşılamadı" bir arada gösterilemez. İlki gerçek bir uyarı, ikincisi
 * yalnızca eksik bilgi. Ölçümde 49:1'in mealleri teyitsiz göründü; sebep
 * içerik farkı değil, o an cevap vermeyen bir sunucuydu — metinler
 * sonradan bakıldığında birebir aynıydı.
 */
export type Confirmation = "confirmed" | "differs" | "unavailable";

/** Tek bir mealin metni ve teyit durumu. */
export type TranslationText = {
  edition: string;
  /** Mütercim adı */
  name: string;
  /** Birincil kaynaktaki hâli — gösterilecek metin bu */
  text: string;
  confirmation: Confirmation;
};

export type VerifiedVerse = {
  surah: number;
  ayah: number;
  /** Surenin Arapça adı */
  surahName: string;
  /** Surenin latin harfli adı */
  surahNameLatin: string;
  arabic: string;
  translations: TranslationText[];
  /** Arapça metni teyit eden kaynaklar */
  arabicSources: string[];
};

/** Ayet doğrulanamadı — gönderilmemeli. */
export class VerseUnverifiedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerseUnverifiedError";
  }
}

/*
 * Netlify eşzamanlı işlevleri 10 saniyede kesiyor. Ölçümde en yavaş ayet
 * 6.1 saniye sürmüştü; teyit istekleri paralel gittiği için tek bir yavaş
 * kaynak bütün çağrıyı bekletiyor. 4.5 saniye o kaynağı düşürüp diğer
 * ikisiyle devam etmeye yetiyor.
 */
const ISTEK_ZAMAN_ASIMI = 4_500;

async function jsonGetir(url: string, signal?: AbortSignal): Promise<unknown | null> {
  try {
    /*
     * İki koşul da geçerli olmalı: çağıranın iptali VE kendi zaman aşımımız.
     * Önce `signal ?? AbortSignal.timeout(...)` yazılmıştı; çağıran bir signal
     * verdiğinde zaman aşımı hiç devreye girmiyordu ve yavaş bir kaynak
     * çağrıyı Netlify sınırına kadar bekletebilirdi.
     */
    const kesici = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(ISTEK_ZAMAN_ASIMI)])
      : AbortSignal.timeout(ISTEK_ZAMAN_ASIMI);

    const response = await fetch(url, {
      signal: kesici,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    /*
     * Bir kaynağın erişilemez olması hata değil, eksik teyit. Çağıran taraf
     * kaç kaynağın onayladığına bakarak karar veriyor.
     */
    return null;
  }
}

type BirincilYanit = {
  data?: {
    number?: number;
    text?: string;
    numberInSurah?: number;
    edition?: { identifier?: string };
    surah?: { number?: number; name?: string; englishName?: string };
  }[];
};

/**
 * Ayeti çeker; doğrulanamazsa `VerseUnverifiedError` fırlatır.
 *
 * Birincil kaynak Arapça metni ve TÜM mealleri tek istekte veriyor; teyit
 * istekleri paralel gidiyor. Netlify'ın 10 saniyelik sınırı yüzünden sıralı
 * çağrı yapılamaz.
 */
export async function fetchVerse(
  ref: VerseRef,
  editionIds: readonly string[],
  signal?: AbortSignal,
): Promise<VerifiedVerse> {
  const { surah, ayah } = ref;
  const surumler = ["quran-uthmani", ...editionIds].join(",");

  const birincil = (await jsonGetir(
    `https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/editions/${surumler}`,
    signal,
  )) as BirincilYanit | null;

  const kayitlar = birincil?.data ?? [];
  const arapcaKayit = kayitlar.find((k) => k.edition?.identifier === "quran-uthmani");
  const arapca = arapcaKayit?.text?.trim();

  if (!arapca) {
    throw new VerseUnverifiedError(`${surah}:${ayah} birincil kaynaktan alınamadı.`);
  }

  // ------------------------------------------------- Teyitler (paralel)

  const [fawazArapca, quranComArapca, ...mealTeyitleri] = await Promise.all([
    jsonGetir(
      `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranuthmanihaf/${surah}/${ayah}.json`,
      signal,
    ),
    jsonGetir(
      `https://api.quran.com/api/v4/quran/verses/uthmani?verse_key=${surah}:${ayah}`,
      signal,
    ),
    ...editionIds.map((id) => {
      const ayna = MIRROR_EDITIONS[id];
      if (!ayna) return Promise.resolve(null);
      return jsonGetir(
        `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/${ayna}/${surah}/${ayah}.json`,
        signal,
      );
    }),
  ]);

  const teyitEdenler = ["alquran.cloud"];
  const celisenler: string[] = [];
  const erisilemeyenler: string[] = [];

  const degerlendir = (ad: string, metin: string | undefined | null) => {
    if (!metin) erisilemeyenler.push(ad);
    else if (sameVerse(arapca, metin)) teyitEdenler.push(ad);
    else celisenler.push(ad);
  };

  degerlendir("fawazahmed0", (fawazArapca as { text?: string } | null)?.text);
  degerlendir(
    "quran.com",
    (quranComArapca as { verses?: { text_uthmani?: string }[] } | null)?.verses?.[0]?.text_uthmani,
  );

  /*
   * ÇELİŞKİ varsa ayet asla gönderilmez — kaç kaynak onaylarsa onaylasın.
   *
   * İki kaynak aynı deyip üçüncüsü farklı diyorsa "çoğunluk kazanır" demek
   * yanlış olurdu: Arapça metin değişmez, ayrışma varsa bir yerde sorun var
   * ve hangisinin doğru olduğunu bilmiyoruz.
   */
  if (celisenler.length > 0) {
    throw new VerseUnverifiedError(
      `${surah}:${ayah} kaynaklar arasında ÇELİŞKİ var (${celisenler.join(", ")}).`,
    );
  }

  // En az iki bağımsız kaynak aynı metni vermeli
  if (teyitEdenler.length < 2) {
    throw new VerseUnverifiedError(
      `${surah}:${ayah} teyit edilemedi; ${erisilemeyenler.join(", ")} yanıt vermedi.`,
    );
  }

  // ------------------------------------------------------------ Mealler

  const translations: TranslationText[] = [];
  editionIds.forEach((id, index) => {
    const kayit = kayitlar.find((k) => k.edition?.identifier === id);
    const metin = kayit?.text?.trim();
    if (!metin) return;

    const ayna = (mealTeyitleri[index] as { text?: string } | null)?.text;
    const confirmation: Confirmation = !MIRROR_EDITIONS[id]
      ? "unavailable" // bu mealin ikinci kaynakta karşılığı yok
      : !ayna
        ? "unavailable"
        : sameTranslation(metin, ayna)
          ? "confirmed"
          : "differs";

    translations.push({ edition: id, name: editionName(id), text: metin, confirmation });
  });

  if (translations.length === 0) {
    throw new VerseUnverifiedError(`${surah}:${ayah} için meal alınamadı.`);
  }

  return {
    surah,
    ayah,
    surahName: arapcaKayit?.surah?.name ?? "",
    surahNameLatin: arapcaKayit?.surah?.englishName ?? "",
    arabic: arapca,
    translations,
    arabicSources: teyitEdenler,
  };
}
