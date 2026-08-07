import { describe, expect, it } from "vitest";
import { tekrarMetni } from "@/types/notes";

describe("hatırlatma tekrar metni", () => {
  it("boş seçim her gün demektir", () => {
    // Ayrı bir "günlük" bayrağı yok; boş dizi bilerek bu anlama geliyor
    expect(tekrarMetni([])).toBe("Her gün");
  });

  it("yedi günün hepsi de her gündür", () => {
    expect(tekrarMetni([1, 2, 3, 4, 5, 6, 7])).toBe("Her gün");
  });

  it("yaygın kümeleri adlandırır", () => {
    expect(tekrarMetni([1, 2, 3, 4, 5])).toBe("Hafta içi");
    expect(tekrarMetni([6, 7])).toBe("Hafta sonu");
  });

  it("karışık seçimde günleri sıralı listeler", () => {
    // Kullanıcı hangi sırayla seçerse seçsin çıktı hafta sırasında olmalı
    expect(tekrarMetni([5, 1, 3])).toBe("Pzt, Çar, Cum");
  });

  it("tek gün", () => {
    expect(tekrarMetni([7])).toBe("Paz");
  });
});
