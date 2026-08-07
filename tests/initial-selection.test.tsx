import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInitialSelection } from "@/hooks/use-initial-selection";

/**
 * Bu testlerin varlık sebebi gerçek bir hata: "Projelere dön" düğmesi
 * çalışmıyordu. Düğme seçimi temizliyor, ilk-seçim effect'i aynı anda ilk
 * projeyi geri seçiyordu. Kullanıcı açısından düğme hiç tepki vermiyordu.
 */
describe("ilk seçim", () => {
  it("liste yüklenince ilk kaydı seçer", () => {
    const onSelect = vi.fn();
    renderHook(() =>
      useInitialSelection({ hydrated: true, firstId: "a", selectedId: null, onSelect }),
    );

    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("kullanıcı seçimi temizleyince GERİ SEÇMEZ", () => {
    // Asıl hata buydu
    const onSelect = vi.fn();
    const { rerender } = renderHook(
      (props: { selectedId: string | null }) =>
        useInitialSelection({
          hydrated: true,
          firstId: "a",
          selectedId: props.selectedId,
          onSelect,
        }),
      { initialProps: { selectedId: "a" as string | null } },
    );

    onSelect.mockClear();
    rerender({ selectedId: null }); // "Projelere dön"

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("yükleme bitmeden seçim yapmaz", () => {
    const onSelect = vi.fn();
    const { rerender } = renderHook(
      (props: { hydrated: boolean }) =>
        useInitialSelection({
          hydrated: props.hydrated,
          firstId: null,
          selectedId: null,
          onSelect,
        }),
      { initialProps: { hydrated: false } },
    );

    expect(onSelect).not.toHaveBeenCalled();
    rerender({ hydrated: true });
    // Liste hâlâ boş; seçilecek bir şey yok
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("derin bağlantıyla gelinmişse seçimi ezmez", () => {
    const onSelect = vi.fn();
    renderHook(() =>
      useInitialSelection({ hydrated: true, firstId: "a", selectedId: "b", onSelect }),
    );

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("boş listeye sonradan kayıt eklenince otomatik seçmez", () => {
    /*
     * Bayrak yalnızca "seçim yapıldığında" kapansaydı burada açık kalır ve
     * kullanıcı ilk kaydını oluşturup listeye dönmek istediğinde aynı hata
     * geri gelirdi.
     */
    const onSelect = vi.fn();
    const { rerender } = renderHook(
      (props: { firstId: string | null }) =>
        useInitialSelection({
          hydrated: true,
          firstId: props.firstId,
          selectedId: null,
          onSelect,
        }),
      { initialProps: { firstId: null as string | null } },
    );

    rerender({ firstId: "yeni" });

    expect(onSelect).not.toHaveBeenCalled();
  });
});
