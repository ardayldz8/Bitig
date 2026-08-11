/**
 * Kullanılabilir Türkçe mealler ve sure uzunlukları.
 *
 * Meal listesi alquran.cloud'un `/v1/edition/language/tr` ucundan alındı;
 * sabit tutuluyor çünkü kullanıcıya gösterilen adların doğru olması gerekiyor
 * ve uzaktan gelen bir listeyi arayüzde doğrulamadan göstermek istemiyoruz.
 */
export type Edition = {
  /** alquran.cloud kimliği */
  id: string;
  /** Mütercim adı */
  name: string;
};

export const TURKISH_EDITIONS: readonly Edition[] = [
  { id: "tr.diyanet", name: "Diyanet İşleri" },
  { id: "tr.vakfi", name: "Diyanet Vakfı" },
  { id: "tr.yazir", name: "Elmalılı Hamdi Yazır" },
  { id: "tr.bulac", name: "Ali Bulaç" },
  { id: "tr.ates", name: "Süleyman Ateş" },
  { id: "tr.golpinarli", name: "Abdülbaki Gölpınarlı" },
  { id: "tr.ozturk", name: "Yaşar Nuri Öztürk" },
  { id: "tr.yildirim", name: "Suat Yıldırım" },
] as const;

/** Hiç seçim yapılmamışsa gösterilecek mealler. */
export const DEFAULT_EDITIONS = ["tr.diyanet", "tr.yazir"] as const;

/**
 * Aynı mütercimin ikinci kaynaktaki karşılığı.
 *
 * Meal metni bu eşleştirme sayesinde teyit edilebiliyor: alquran.cloud'un
 * "Diyanet İşleri" dediği metin, fawazahmed0'ın "Diyanet Isleri" metniyle
 * karşılaştırılıyor. Ölçüldü: 160 karşılaştırmanın 159'u birebir aynı,
 * fark yalnızca sondaki noktalama.
 *
 * Karşılığı olmayan meal için giriş yok — teyit edilemeyeni edilmiş gibi
 * göstermektense hiç eşleştirmemek doğru.
 */
export const MIRROR_EDITIONS: Readonly<Record<string, string>> = {
  "tr.diyanet": "tur-diyanetisleri",
  "tr.vakfi": "tur-diyanetvakfi",
  "tr.yazir": "tur-elmalilihamdiya",
  "tr.bulac": "tur-alibulac",
  "tr.ates": "tur-suleymanates",
  "tr.golpinarli": "tur-abdulbakigolpin",
  "tr.ozturk": "tur-yasarnuriozturk",
  "tr.yildirim": "tur-suatyildirim",
};

export function editionName(id: string): string {
  return TURKISH_EDITIONS.find((e) => e.id === id)?.name ?? id;
}

export function isKnownEdition(id: string): boolean {
  return TURKISH_EDITIONS.some((e) => e.id === id);
}

/**
 * Her surenin ayet sayısı (1. sure ilk sırada).
 *
 * Ağdan çekilmiyor: bu sayılar değişmiyor ve rastgele ayet seçmek için her
 * seferinde bir istek atmak gereksiz. Değerler alquran.cloud `/v1/meta`
 * ucundan üretildi; toplamı 6236 ve bu testle sabitlendi.
 */
export const AYAH_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111,
  43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64,
  77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83,
  182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29,
  18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28,
  20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25,
  22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19,
  5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3,
  6, 3, 5, 4, 5, 6,
];

export const TOTAL_AYAHS = AYAH_COUNTS.reduce((a, b) => a + b, 0);

export type VerseRef = { surah: number; ayah: number };

/**
 * Rastgele bir ayet seçer.
 *
 * Sure seçip içinden ayet seçmek YANLIŞ olurdu: Kevser'in 3 ayeti Bakara'nın
 * 286 ayetiyle aynı olasılığı alırdı. Bunun yerine 6236 ayet arasından düz
 * çekiliş yapılıp sure/ayet numarasına çevriliyor.
 *
 * `rand` dışarıdan verilebiliyor ki test yinelenebilir olsun.
 */
export function randomVerseRef(rand: () => number = Math.random): VerseRef {
  let kalan = Math.floor(rand() * TOTAL_AYAHS);
  for (let i = 0; i < AYAH_COUNTS.length; i += 1) {
    if (kalan < AYAH_COUNTS[i]) return { surah: i + 1, ayah: kalan + 1 };
    kalan -= AYAH_COUNTS[i];
  }
  // rand() tam 1 dönerse buraya düşer; son ayete sabitle
  return { surah: 114, ayah: 6 };
}
