import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SiteNav from "@/components/ui/site-nav";

const pathname = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}));

// next/link testte sade bir <a> olarak yeterli
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => pathname.mockReturnValue("/"));

describe("gezinme menüsü", () => {
  it("kapalıyken sayfa bağlantıları görünmez", () => {
    render(<SiteNav />);

    // Yalnızca logo bağlantısı olmalı; menü içeriği açılmadan basılmaz
    expect(screen.queryByRole("menuitem", { name: /manga/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /menüyü aç/i })).toBeInTheDocument();
  });

  it("açılınca yedi sayfanın hepsi listelenir", async () => {
    const user = userEvent.setup();
    render(<SiteNav />);

    await user.click(screen.getByRole("button", { name: /menüyü aç/i }));

    // Alt sekme çubuğu bu kadarını sığdıramadığı için açılır menüye geçildi
    expect(screen.getAllByRole("menuitem")).toHaveLength(7);
    for (const ad of ["Ana Sayfa", "Manga", "Dizi / Film", "Repolar", "Notlar", "Abonelikler", "İstatistikler"]) {
      expect(screen.getByRole("menuitem", { name: ad })).toBeInTheDocument();
    }
  });

  it("bulunulan sayfa işaretlenir", async () => {
    pathname.mockReturnValue("/abonelikler");
    const user = userEvent.setup();
    render(<SiteNav />);

    await user.click(screen.getByRole("button", { name: /menüyü aç/i }));

    expect(screen.getByRole("menuitem", { name: "Abonelikler" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("menuitem", { name: "Manga" })).not.toHaveAttribute("aria-current");
  });

  it("menüyü açmadan da nerede olunduğu yazar", () => {
    pathname.mockReturnValue("/notlar");
    render(<SiteNav />);

    expect(screen.getByText("Notlar")).toBeInTheDocument();
  });

  it("ana sayfada başlık tekrarlanmaz", () => {
    // Logo zaten "Bitig" diyor; yanına "Ana Sayfa" yazmak gereksiz gürültü
    render(<SiteNav />);
    expect(screen.queryByText("Ana Sayfa")).not.toBeInTheDocument();
  });

  it("Escape ile kapanır", async () => {
    const user = userEvent.setup();
    render(<SiteNav />);

    await user.click(screen.getByRole("button", { name: /menüyü aç/i }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(7);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("bağlantıya tıklayınca kapanır", async () => {
    /*
     * Açık kalırsa yeni sayfanın üstünü örter. pathname testte değişmediği
     * için kapanma tıklama işleyicisine bağlı olmalı, yalnızca yol
     * değişimine değil.
     */
    const user = userEvent.setup();
    render(<SiteNav />);

    await user.click(screen.getByRole("button", { name: /menüyü aç/i }));
    await user.click(screen.getByRole("menuitem", { name: "Manga" }));

    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });
});
