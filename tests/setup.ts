import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/*
 * Her testten sonra DOM temizlenir. Olmazsa önceki testin bıraktığı düğmeler
 * belgede kalıyor ve getByRole birden fazla eşleşme bulup patlıyor — hata
 * mesajı da yanıltıcı oluyor ("birden fazla düğme bulundu").
 */
afterEach(() => cleanup());
