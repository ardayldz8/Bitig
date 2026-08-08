export type GunlukKalori = { date: string; calories: number };

/**
 * Son N günün kalori ortalaması.
 *
 * Kayıt GİRİLMEMİŞ günler ortalamaya katılmıyor. Sıfır saymak, unuttuğunuz
 * bir günü "hiç yemedim" gibi göstererek ortalamayı sahte biçimde düşürürdü —
 * ve bu tam da takip etmeyi bıraktığınız günlerde olur.
 */
export function averageCalories(gunler: GunlukKalori[]): number | null {
  const dolu = gunler.filter((gun) => gun.calories > 0);
  if (dolu.length === 0) return null;
  return dolu.reduce((toplam, gun) => toplam + gun.calories, 0) / dolu.length;
}

/** Kaç günde kayıt var — ortalamanın ne kadar temsil ettiğini gösterir. */
export function trackedDays(gunler: GunlukKalori[]): number {
  return gunler.filter((gun) => gun.calories > 0).length;
}

export type OkumaKaydi = { name: string; currentChapter: number; createdAt: string | null };

/**
 * Haftalık okuma hızı: bölüm / hafta.
 *
 * Toplam bölüm, kaydın açıldığı tarihten bugüne geçen süreye bölünüyor.
 * Kayıt tarihi olmayan ya da bugün eklenmiş mangalar hesaba katılmıyor:
 * "bugün ekledim, 200 bölümdeyim" bir haftada 1400 bölüm okunmuş gibi
 * görünürdü.
 */
export function weeklyReadingPace(kayitlar: OkumaKaydi[], now: Date): number | null {
  const GUN = 86_400_000;
  let bolum = 0;
  let haftaToplam = 0;

  for (const kayit of kayitlar) {
    if (!kayit.createdAt || kayit.currentChapter <= 0) continue;
    const gun = (now.getTime() - new Date(kayit.createdAt).getTime()) / GUN;
    // En az bir hafta geçmiş olmalı
    if (!Number.isFinite(gun) || gun < 7) continue;

    bolum += kayit.currentChapter;
    haftaToplam += gun / 7;
  }

  if (haftaToplam === 0) return null;
  return bolum / haftaToplam;
}

export type AbonelikKaydi = { amount: number; currency: string; period: string; active: boolean };

/** Yıllık gider, para birimi başına. Yıllıklar olduğu gibi, aylıklar ×12. */
export function yearlySpend(abonelikler: AbonelikKaydi[]): Map<string, number> {
  const toplam = new Map<string, number>();
  for (const item of abonelikler) {
    if (!item.active) continue;
    const yillik = item.period === "yearly" ? item.amount : item.amount * 12;
    toplam.set(item.currency, (toplam.get(item.currency) ?? 0) + yillik);
  }
  return toplam;
}

export type MedyaKaydi = { mediaType: string; status: string; rating: number | null };

export type MedyaOzeti = {
  dizi: number;
  film: number;
  tamamlanan: number;
  izleniyor: number;
  planlanan: number;
  ortalamaPuan: number | null;
};

export function mediaSummary(kayitlar: MedyaKaydi[]): MedyaOzeti {
  const ozet: MedyaOzeti = {
    dizi: 0,
    film: 0,
    tamamlanan: 0,
    izleniyor: 0,
    planlanan: 0,
    ortalamaPuan: null,
  };

  const puanlar: number[] = [];

  for (const kayit of kayitlar) {
    if (kayit.mediaType === "movie") ozet.film++;
    else ozet.dizi++;

    if (kayit.status === "completed") ozet.tamamlanan++;
    else if (kayit.status === "watching") ozet.izleniyor++;
    else if (kayit.status === "planned") ozet.planlanan++;

    // Puanlanmamış kayıtlar ortalamayı bozmasın
    if (typeof kayit.rating === "number" && kayit.rating > 0) puanlar.push(kayit.rating);
  }

  if (puanlar.length > 0) {
    ozet.ortalamaPuan = puanlar.reduce((a, b) => a + b, 0) / puanlar.length;
  }

  return ozet;
}

/** En uzun ardışık kayıt serisi — bugünden geriye. */
export function currentStreak(gunler: GunlukKalori[], today: string): number {
  const doluGunler = new Set(gunler.filter((g) => g.calories > 0).map((g) => g.date));
  let seri = 0;
  const tarih = new Date(`${today}T00:00:00Z`);

  /*
   * Bugün kayıt yoksa seri bozulmuş sayılmıyor: gün henüz bitmedi ve akşam
   * yemeği girilmemiş olabilir. Dünden başlamak, sabahları seriyi haksız
   * yere sıfırlamayı önlüyor.
   */
  if (!doluGunler.has(today)) tarih.setUTCDate(tarih.getUTCDate() - 1);

  while (doluGunler.has(tarih.toISOString().slice(0, 10))) {
    seri++;
    tarih.setUTCDate(tarih.getUTCDate() - 1);
  }

  return seri;
}
