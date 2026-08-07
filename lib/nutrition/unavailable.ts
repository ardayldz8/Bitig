/**
 * Kaynak geçici olarak ya da yapılandırma nedeniyle yanıt veremiyor.
 *
 * "Sonuç bulunamadı" ile "servis şu anda kapalı" ayrı şeyler. İkisi aynı
 * gösterilince kullanıcı özelliğin bozuk olduğunu sanıyor; oysa bir dakika
 * sonra çalışacak. Open Food Facts hız sınırında 503 ya da 200 + HTML dönüyor,
 * FatSecret ise IP whitelist dışındaki isteklere 200 gövdesinde hata veriyor.
 *
 * Tek bir sağlayıcıya değil, tüm sağlayıcılara ait bir kavram olduğu için
 * ayrı modülde: aksi hâlde fatsecret.ts, open-food-facts.ts'i import etmek
 * zorunda kalıyordu.
 */
export class NutritionUnavailableError extends Error {
  constructor(readonly provider: string) {
    super(`${provider} şu anda yanıt vermiyor`);
    this.name = "NutritionUnavailableError";
  }
}
