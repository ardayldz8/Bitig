"use client";

import { useEffect, useState } from "react";
import { displayName, formatToday } from "@/lib/dashboard/dashboard-utils";
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Güncel tarih — İSTEMCİDE üretilir.
 * Sunucuda üretilseydi statik prerender'da build zamanına donar ve
 * kullanıcının değil sunucunun saat dilimini gösterirdi.
 * Mount öncesi boş kalır → hydration uyuşmazlığı olmaz.
 */
export function TodayDate() {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(formatToday());
  }, []);

  return (
    <p className="min-h-5 text-sm text-ink-soft sm:pt-1" suppressHydrationWarning>
      {today}
    </p>
  );
}

/**
 * Karşılama adı. Oturum varsa e-postadan ilk isim çıkarılır,
 * yoksa sade karşılamaya düşer. Hiçbir yerde isim hardcode edilmez.
 */
export function GreetingTitle() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const client = getBrowserClient();
    if (!client) return;

    let active = true;
    client.auth
      .getSession()
      .then(({ data }) => {
        if (active) setName(displayName(data.session?.user?.email ?? null));
      })
      .catch(() => {
        // Oturum okunamazsa sade karşılama kullanılır
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
      {name ? `Hoş geldin, ${name}.` : "Hoş geldin."}
    </h1>
  );
}
