"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Ana sayfadaki hızlı işlem bağlantılarını karşılar (`?action=add` gibi).
 *
 * - Beklenen değer gelmezse hiçbir şey yapmaz, sayfa normal görünür.
 * - `clear()` parametreyi siler; `replace` kullanıldığı için geri tuşu bozulmaz.
 */
export function useActionParam(expected: string): {
  triggered: boolean;
  clear: () => void;
} {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    if (params.get("action") === expected) setTriggered(true);
  }, [params, expected]);

  const clear = useCallback(() => {
    setTriggered(false);
    if (!params.get("action")) return;

    const next = new URLSearchParams(params.toString());
    next.delete("action");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return { triggered, clear };
}
