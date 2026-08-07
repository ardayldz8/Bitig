import type { Metadata } from "next";
import NotesPage from "@/components/notes/notes-page";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Notlar",
  description: "Notlarını yaz, istediğin saatlerde kendine hatırlat.",
};

export default function Notlar() {
  // VAPID açık anahtarı zaten herkese açık; sunucudan geçirmek NEXT_PUBLIC_
  // değişkenini istemci paketine gömmekten farksız ama tek kaynaktan okunuyor.
  return <NotesPage vapidPublicKey={env.vapidPublicKey()} />;
}
