/**
 * Gerçek bir katalogda doğrulanmış eser.
 *
 * Öneri akışının temel kuralı: model NE önerileceğini söyler, eserin gerçekten
 * var olduğunu ve künyesini DIŞ KAYNAK doğrular. Besin değerlerinde uygulanan
 * desenin aynısı — orada da model yalnızca yiyeceği tanıyor, kalori yalnızca
 * izin verilen veritabanlarından geliyor.
 *
 * Sebep: model var olmayan bir manga ya da dizi uydurduğunda öneri yalnızca
 * işe yaramaz olmuyor, kullanıcı onu aramaya çıkıp zaman kaybediyor.
 */
export type CatalogItem = {
  title: string;
  year: number | null;
  imageUrl: string | null;
  description: string | null;
  /** Kullanıcının kaynağa gidip bakabilmesi için. */
  sourceUrl: string | null;
  source: CatalogSource;
};

export type CatalogSource = "mangadex" | "tvmaze" | "wikipedia";

/** Aranacak eser türü; her tür farklı katalogda doğrulanıyor. */
export type CatalogKind = "manga" | "series" | "movie";
