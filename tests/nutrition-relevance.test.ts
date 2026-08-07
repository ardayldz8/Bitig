import { describe, expect, it } from "vitest";
import { relevance } from "@/lib/nutrition/search-nutrition";

/**
 * Buradaki adayların hepsi canlı kaynaklardan (USDA / Open Food Facts) gerçek
 * aramalarda dönen sonuçlar. Uydurulmuş örnek yok.
 */

/** Doğru olanın yanlış olandan yüksek puan alması. */
const yener = (sorgu: string, dogru: string, yanlis: string) => {
  expect(relevance(sorgu, dogru)).toBeGreaterThan(relevance(sorgu, yanlis));
};

describe("türev niteleme cezası", () => {
  it("yumurta araması yumurta AKINI seçmez", () => {
    // "Egg white" 55 kcal; bütün yumurta ~143. Değer makul göründüğü için
    // makullük filtresi yakalayamıyor — yanlış olan yiyeceğin kendisi.
    yener("egg", "Egg, whole, raw, fresh", "Eggs, Grade A, Large, egg white");
  });

  it("yulaf araması kepek ya da yağ seçmez", () => {
    yener("oats", "Oats", "Oat bran, cooked");
    yener("oats", "Oats", "Oil, oat");
  });

  it("tavuk göğsü araması galeta unlusunu seçmez", () => {
    yener(
      "chicken breast",
      "Chicken, broilers or fryers, breast, meat only, raw",
      "Chicken breast tenders, breaded, uncooked",
    );
  });

  it("pilav araması kuru karışımı seçmez", () => {
    yener("rice pilaf", "Rice pilaf, cooked", "Rice and vermicelli mix, rice pilaf flavor");
  });

  it("kullanıcı türevi kendi istediyse ceza uygulanmaz", () => {
    // "portakal suyu" arayan için "juice" doğru sonucun parçası
    expect(relevance("orange juice", "Orange juice, raw")).toBeGreaterThan(0.5);
    // "yaprak sarma"da "leaves" sorgunun kendisinde geçiyor
    expect(
      relevance("stuffed grape leaves", "Grape Leaves stuffed with rice"),
    ).toBeGreaterThan(0.5);
  });
});

describe("baş bölüm (ilk virgüle kadar)", () => {
  it("bileşik ad başka bir yiyecektir", () => {
    // "Rice crackers" pirinç değil, pirinç krakeri (416 kcal). Virgülsüz
    // bileşik ad; "Rice, white, ..." ise pirincin kendisi + nitelemeleri.
    yener("rice", "Rice, white, long-grain, regular, cooked", "Rice crackers");
    yener("egg", "Eggs, Grade A, Large, egg whole", "Egg Noodle");
  });

  it("USDA'nın hazır yemek kaydı ham madde aramasını çalmaz", () => {
    // FNDDS ham madde zincirinden çıkarıldı ama aday yine de düşük kalmalı
    yener("egg", "Eggs, Grade A, Large, egg whole", "Egg, Benedict");
  });
});

describe("ilgi eşiği", () => {
  it("kelimeleri içeren ama başka olan yemek eşiğin altında kalır", () => {
    // USDA'nın kaşarlı tost aramasına verdiği gerçek yanıt. İçinde "grilled",
    // "cheese" ve "sandwich" kelimelerinin ÜÇÜ de geçiyor; kelime torbası bunu
    // tam kapsama sayıp kabul ediyordu. Ayıran şey sıra: "grilled cheese"
    // ikilisi burada yan yana değil.
    const tavuklu =
      "Fast foods, grilled chicken, bacon and tomato club sandwich, with cheese, lettuce, and mayonnaise";

    expect(relevance("grilled cheese sandwich", tavuklu)).toBeLessThan(0.5);
    yener("grilled cheese sandwich", "Grilled cheese sandwich", tavuklu);
  });

  it("aranan kelime sonda olsa da doğru ürün eşiği geçer", () => {
    // Open Food Facts adları serbest ürün adı; baş kelime kuralı tek başına
    // belirleyici olsaydı bu doğru sonuç elenirdi.
    expect(relevance("simit", "Turkish Sessame Bagel Simit")).toBeGreaterThan(0.5);
  });

  it("birebir ad tam puana yakın alır", () => {
    expect(relevance("mercimek çorbası", "Mercimek Çorbası")).toBeGreaterThan(0.9);
    expect(relevance("beyaz peynir", "Beyaz Peynir")).toBeGreaterThan(0.9);
  });

  it("fazladan kelime puanı düşürür ama sade eşleşmeyi elemez", () => {
    const sade = relevance("ayran", "Ayran");
    const uzun = relevance("ayran", "Ayran İçecek 250 ml Yayla Doğal");
    expect(sade).toBeGreaterThan(uzun);
    expect(uzun).toBeGreaterThan(0.5);
  });
});
