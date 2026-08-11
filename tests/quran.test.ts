import { describe, expect, it } from "vitest";
import {
  AYAH_COUNTS,
  MIRROR_EDITIONS,
  TOTAL_AYAHS,
  TURKISH_EDITIONS,
  isKnownEdition,
  randomVerseRef,
} from "@/lib/quran/editions";
import {
  normalizeArabic,
  normalizeTurkish,
  sameTranslation,
  sameVerse,
} from "@/lib/quran/normalize";

/*
 * Bu testlerdeki Arapça metinler GERÇEK API yanıtlarından alındı; elle
 * yazılmadı. Amaç kaynakların birbirinden nasıl ayrıştığını sabitlemek:
 * ayrışmaları elle uydurmak, gerçekte olmayan bir şeyi test etmek olurdu.
 */

describe("Arapça sadeleştirme", () => {
  it("harekeleri ve durak işaretlerini düşürür", () => {
    // 2:255 alquran.cloud
    const a = "ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ";
    // aynı ayet fawazahmed0 — farklı sükûn biçimi, ي yerine ى
    const b = "ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلۡحَيُّ ٱلۡقَيُّومُۚ";

    expect(normalizeArabic(a)).toBe(normalizeArabic(b));
    expect(sameVerse(a, b)).toBe(true);
  });

  it("quran.com'un ـٰ yazımını da eşitler", () => {
    expect(sameVerse("لَآ إِلَٰهَ", "لَآ إِلَـٰهَ")).toBe(true);
  });

  it("hamza taşıyıcısı farkını düzler", () => {
    // 17:82 — alquran.cloud ؤ kullanıyor, fawazahmed0 و
    expect(sameVerse("لِّلْمُؤْمِنِينَ", "لِّلْمُومِنِينَ")).toBe(true);
    // 3:190 — ayrık hamza + elif ile elif madde
    expect(sameVerse("لَّءَايَٰتٍ", "لَّأٓيَٰتٍ")).toBe(true);
  });

  it("GERÇEKTEN farklı ayetleri eşit saymaz", () => {
    // İhlas 1 ile Nas 1 — sadeleştirme her şeyi eşitlememeli
    expect(sameVerse("قُلْ هُوَ ٱللَّهُ أَحَدٌ", "قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ")).toBe(false);
  });

  it("boş metni teyit saymaz", () => {
    /*
     * "karşılaştıracak bir şey yoktu" ile "aynı çıktı" karıştırılırsa,
     * yanıt vermeyen bir kaynak sessizce onaylıyor gibi görünürdü.
     */
    expect(sameVerse("", "")).toBe(false);
    expect(sameVerse("قُلْ هُوَ ٱللَّهُ أَحَدٌ", "")).toBe(false);
    expect(sameVerse("۞ ۚ ۖ", "")).toBe(false); // yalnızca durak işareti
  });
});

describe("besmele farkı", () => {
  const BESMELE = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

  it("sure başındaki besmele eklentisini yok sayar", () => {
    /*
     * alquran.cloud her surenin ilk ayetinin başına besmeleyi ekliyor,
     * diğer iki kaynak eklemiyor. Ölçüldü: İhlas 1 ve Yasin 1.
     */
    expect(sameVerse(`${BESMELE} قُلْ هُوَ ٱللَّهُ أَحَدٌ`, "قُلْ هُوَ ٱللَّهُ أَحَدٌ")).toBe(true);
    expect(sameVerse(`${BESMELE} يس`, "يس")).toBe(true);
  });

  it("Fatiha 1'de besmeleyi SİLMEZ — ayetin kendisi o", () => {
    expect(sameVerse(BESMELE, BESMELE)).toBe(true);
    // Besmele ile başka bir ayet karıştırılmamalı
    expect(sameVerse(BESMELE, "قُلْ هُوَ ٱللَّهُ أَحَدٌ")).toBe(false);
  });
});

describe("meal karşılaştırma", () => {
  it("yalnızca sondaki noktalama farkını hoş görür", () => {
    // Ölçüldü: iki kaynak arasındaki tek fark sondaki nokta
    expect(sameTranslation("O yücedir, büyüktür.", "O yücedir, büyüktür")).toBe(true);
  });

  it("kapanış tırnağı farkını hoş görür", () => {
    expect(sameTranslation('bir kavim oldular."', "bir kavim oldular")).toBe(true);
  });

  it("sondaki köşeli parantezli atıfları düşürür", () => {
    // Suat Yıldırım mealinde ayet sonunda çapraz göndermeler var
    expect(
      sameTranslation("amellerine ulaştırmaz. [7,179]", "amellerine ulaştırmaz."),
    ).toBe(true);
    expect(
      sameTranslation("haline geldiler. [34,40-41; 46,5-6]", "haline geldiler."),
    ).toBe(true);
  });

  it("metin İÇİNDEKİ parantezli açıklamaya dokunmaz", () => {
    // Elmalılı'da "(hayydır)" gibi açıklamalar metnin parçası
    expect(normalizeTurkish("O daima diridir (hayydır), bütün varlığın")).toContain("(hayydır)");
  });

  it("GERÇEK içerik farkını yakalar", () => {
    expect(sameTranslation("Allah birdir.", "Allah çoktur.")).toBe(false);
    // Tek kelimelik fark bile gözden kaçmamalı
    expect(sameTranslation("Rabbinin adıyla oku.", "Rabbinin adıyla yaz.")).toBe(false);
  });

  it("boş metni teyit saymaz", () => {
    expect(sameTranslation("", "")).toBe(false);
    expect(sameTranslation("Allah birdir.", "")).toBe(false);
    expect(sameTranslation("...", "")).toBe(false); // sadeleştirince boşalıyor
  });
});

describe("sure tablosu", () => {
  it("114 sure ve 6236 ayet", () => {
    // Kaynak: alquran.cloud /v1/meta
    expect(AYAH_COUNTS).toHaveLength(114);
    expect(TOTAL_AYAHS).toBe(6236);
  });

  it("bilinen uzunluklar doğru", () => {
    expect(AYAH_COUNTS[0]).toBe(7); // Fatiha
    expect(AYAH_COUNTS[1]).toBe(286); // Bakara — en uzun
    expect(AYAH_COUNTS[107]).toBe(3); // Kevser — en kısa
    expect(AYAH_COUNTS[113]).toBe(6); // Nas
  });
});

describe("rastgele ayet seçimi", () => {
  it("sınırlarda geçerli ayet döner", () => {
    expect(randomVerseRef(() => 0)).toEqual({ surah: 1, ayah: 1 });
    // rand() tam 1 dönerse taşma olmamalı
    expect(randomVerseRef(() => 1)).toEqual({ surah: 114, ayah: 6 });
    expect(randomVerseRef(() => 0.999999)).toEqual({ surah: 114, ayah: 6 });
  });

  it("her zaman var olan bir ayete işaret eder", () => {
    let tohum = 12345;
    const rnd = () => ((tohum = (tohum * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

    for (let i = 0; i < 3000; i += 1) {
      const { surah, ayah } = randomVerseRef(rnd);
      expect(surah).toBeGreaterThanOrEqual(1);
      expect(surah).toBeLessThanOrEqual(114);
      expect(ayah).toBeGreaterThanOrEqual(1);
      // Asıl kontrol: seçilen ayet O SURENİN uzunluğunu aşmamalı
      expect(ayah).toBeLessThanOrEqual(AYAH_COUNTS[surah - 1]);
    }
  });

  it("uzun sureleri kısa surelerle aynı olasılıkta seçmez", () => {
    /*
     * Önce sure seçip içinden ayet seçmek yanlış olurdu: Kevser'in 3 ayeti
     * Bakara'nın 286 ayetiyle aynı şansı alırdı. Düz çekiliş, uzun sureleri
     * ayet sayısıyla orantılı seçmeli.
     */
    let tohum = 777;
    const rnd = () => ((tohum = (tohum * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

    let bakara = 0;
    let kevser = 0;
    for (let i = 0; i < 20000; i += 1) {
      const { surah } = randomVerseRef(rnd);
      if (surah === 2) bakara += 1;
      if (surah === 108) kevser += 1;
    }

    // Bakara 286/3 ≈ 95 kat daha sık gelmeli; geniş pay bırakıldı
    expect(bakara).toBeGreaterThan(kevser * 20);
  });
});

describe("meal listesi", () => {
  it("her mealin ikinci kaynakta karşılığı var", () => {
    /*
     * Karşılığı olmayan bir meal seçilirse teyit HİÇ yapılamaz ve kullanıcı
     * sürekli "teyit edilemedi" görür. Liste büyütülürse bu test hatırlatır.
     */
    for (const edition of TURKISH_EDITIONS) {
      expect(MIRROR_EDITIONS[edition.id], `${edition.id} için ayna yok`).toBeTruthy();
    }
  });

  it("bilinmeyen meal kimliğini reddeder", () => {
    expect(isKnownEdition("tr.diyanet")).toBe(true);
    expect(isKnownEdition("tr.uydurma")).toBe(false);
    expect(isKnownEdition("")).toBe(false);
  });
});
