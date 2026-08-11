/**
 * Arapça metni karşılaştırma için sadeleştirir.
 *
 * Kur'an metni standarttır ama kaynaklar farklı Unicode yazımları kullanıyor:
 * aynı ayet alquran.cloud'da `ٱلْحَىُّ`, fawazahmed0'da `ٱلۡحَيُّ`,
 * quran.com'da `إِلَـٰهَ` biçiminde geliyor. Ham karşılaştırma her ayette
 * "uyuşmadı" derdi.
 *
 * Karşılaştırılan şey HARF İSKELETİ: harekeler, duraklar ve harf biçim
 * farkları düşürülür. İskelet tutuyorsa iki kaynak aynı ayeti veriyor
 * demektir; tutmuyorsa gerçekten bir sorun var ve ayet gönderilmemeli.
 *
 * Bu sadeleştirme YALNIZCA doğrulama içindir. Kullanıcıya gösterilen metin
 * her zaman kaynağın orijinal hâlidir — harekeler okunuşun parçası.
 */
export function normalizeArabic(text: string): string {
  return (
    text
      // Harekeler ve tecvid işaretleri
      .replace(/[ً-ٰٟۖ-ۭ]/g, "")
      // Tatweel (uzatma çizgisi) — yalnızca yazım süsü
      .replace(/ـ/g, "")
      // Elif biçimleri: أ إ آ ٱ ا → ا
      .replace(/[آأإٱ]/g, "ا")
      /*
       * Hamza taşıyıcıları düzleniyor — kaynaklar burada da ayrışıyor:
       * 17:82 alquran.cloud'da `لِّلْمُؤْمِنِينَ`, fawazahmed0'da `لِّلْمُومِنِينَ`;
       * 3:190 alquran.cloud'da `لَّءَايَٰتٍ`, diğerlerinde `لَّأٓيَٰتٍ`.
       * ؤ → و, ئ → ي, ayrık ء düşer.
       */
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/ء/g, "")
      // Elif maksura ↔ ya: ى → ي
      .replace(/ى/g, "ي")
      // Te merbuta → he: ة → ه
      .replace(/ة/g, "ه")
      // Arap harfi olmayan her şeyi at (durak simgeleri, noktalama, rakamlar)
      .replace(/[^ء-ي]/g, "")
      .trim()
  );
}

/** Sadeleştirilmiş besmele — iskelet biçiminde. */
const BESMELE = normalizeArabic("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");

/**
 * Baştaki besmeleyi düşürür.
 *
 * Kaynaklar sure başlarında ayrışıyor: alquran.cloud her surenin ilk ayetinin
 * başına besmeleyi ekliyor, fawazahmed0 ve quran.com eklemiyor. Yerleşik bir
 * yayım farkı, hata değil — ama karşılaştırmada hesaba katılmazsa her sure
 * başında yanlış alarm veriyor.
 *
 * Geriye metin KALMIYORSA düşürülmez: Fatiha'nın 1. ayeti besmelenin
 * kendisidir ve onu atmak ayeti yok etmek olurdu.
 */
function besmelesiz(iskelet: string): string {
  if (!iskelet.startsWith(BESMELE)) return iskelet;
  const kalan = iskelet.slice(BESMELE.length);
  return kalan.length > 0 ? kalan : iskelet;
}

/**
 * İki kaynaktan gelen ayet aynı mı.
 *
 * Eşitlik iskelet üzerinden; biri boşsa doğrulama BAŞARISIZ sayılır —
 * "karşılaştıracak bir şey yoktu" ile "aynı çıktı" karıştırılmamalı.
 */
export function sameVerse(a: string, b: string): boolean {
  const x = besmelesiz(normalizeArabic(a));
  const y = besmelesiz(normalizeArabic(b));
  return x.length > 0 && x === y;
}

/**
 * Türkçe meali karşılaştırma için sadeleştirir.
 *
 * Arapçanın aksine meal metni mütercimin yorumu — farklı mütercimler farklı
 * yazar ve bu hata değil. Burada karşılaştırılan şey AYNI mütercimin metninin
 * iki farklı kaynakta aynı gelip gelmediği; yani "bu gerçekten Diyanet'in
 * meali mi, yolda bozulmuş ya da yanlış etiketlenmiş mi".
 *
 * Ölçüldü: iki kaynak arasındaki tek fark sondaki nokta. 400-540 karakterlik
 * metinler bunun dışında harfi harfine aynı. Sadeleştirme bu yüzden dar
 * tutuldu — fazla hoşgörü, gerçek bir bozulmayı da gizlerdi.
 */
export function normalizeTurkish(text: string): string {
  return (
    text
      .normalize("NFC")
      // Kesme işareti türleri tek biçime
      .replace(/[’‘´`]/g, "'")
      // Satır sonu ve çoklu boşluk tek boşluğa
      .replace(/\s+/g, " ")
      /*
       * Sondaki köşeli parantezli atıflar düşürülüyor: Suat Yıldırım mealinde
       * ayet sonuna `[7,179]` gibi çapraz göndermeler var, alquran.cloud
       * bunları koruyor fawazahmed0 atıyor. Yayıncı eklentisi, meal metninin
       * kendisi değil. Yalnızca rakam/noktalama içeren ve SONDA duran
       * parantezler siliniyor — metin içindeki parantezli açıklamalar durur.
       */
      .replace(/(\s*\[[\d\s,;:.–-]+\])+\s*$/g, "")
      // Baştaki/sondaki noktalama, tırnak ve kapanış parantezleri
      .replace(/^[\s.,;:!?"'“”«»()[\]]+|[\s.,;:!?"'“”«»()[\]]+$/g, "")
      .trim()
  );
}

/** Aynı mütercimin metni iki kaynakta da aynı mı. */
export function sameTranslation(a: string, b: string): boolean {
  const x = normalizeTurkish(a);
  const y = normalizeTurkish(b);
  return x.length > 0 && x === y;
}
