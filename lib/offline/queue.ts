/**
 * Çevrimdışı yazma kuyruğu.
 *
 * Uygulama telefonda ve PWA: metroda, asansörde, kırsalda kayıt eklemek
 * gerçek bir senaryo. Şu an sinyalsizken yapılan yazma sessizce
 * başarısız oluyor ve kayıt kayboluyor.
 *
 * localStorage DEĞİL IndexedDB: localStorage senkron ve ana iş parçacığını
 * bloke ediyor, ayrıca 5 MB civarında sınırlı. Kuyruk küçük olsa da
 * yazma sırasında arayüzün donması kabul edilemez.
 */

const DB_ADI = "bitig-offline";
const DEPO = "kuyruk";
const SURUM = 1;

export type QueuedWrite = {
  id: string;
  table: string;
  /** insert / update / delete — Supabase üzerinde uygulanacak işlem. */
  op: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  /** update/delete için hedef satır. */
  matchId?: string;
  queuedAt: number;
  /** Kaç kez denendi — sonsuz döngüye girmesin. */
  attempts: number;
};

/** En fazla bu kadar deneme; sonrasında kayıt hatalı sayılıp bırakılır. */
export const MAX_DENEME = 5;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const istek = indexedDB.open(DB_ADI, SURUM);
    istek.onupgradeneeded = () => {
      const db = istek.result;
      if (!db.objectStoreNames.contains(DEPO)) {
        db.createObjectStore(DEPO, { keyPath: "id" });
      }
    };
    istek.onsuccess = () => resolve(istek.result);
    istek.onerror = () => reject(istek.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(DEPO, mode);
    const istek = fn(tx.objectStore(DEPO));
    istek.onsuccess = () => resolve(istek.result);
    istek.onerror = () => reject(istek.error);
    tx.oncomplete = () => db.close();
  });
}

export async function enqueue(write: Omit<QueuedWrite, "queuedAt" | "attempts">): Promise<void> {
  await withStore("readwrite", (store) =>
    store.put({ ...write, queuedAt: Date.now(), attempts: 0 }),
  );
}

export async function listQueued(): Promise<QueuedWrite[]> {
  const hepsi = await withStore<QueuedWrite[]>("readonly", (store) => store.getAll());
  // Eski kayıt önce gitsin: bir kaydın güncellemesi, oluşturulmasından sonra
  return hepsi.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function dequeue(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function bumpAttempts(item: QueuedWrite): Promise<void> {
  const sonraki = { ...item, attempts: item.attempts + 1 };
  if (sonraki.attempts >= MAX_DENEME) {
    /*
     * Kalıcı hata (ör. veri kısıtı ihlali) kuyruğu sonsuza kadar tıkamamalı.
     * Denemesi biten kayıt siliniyor — kullanıcı zaten ekranda hatayı gördü.
     */
    await dequeue(item.id);
    return;
  }
  await withStore("readwrite", (store) => store.put(sonraki));
}

export async function queueSize(): Promise<number> {
  return withStore<number>("readonly", (store) => store.count());
}

/** IndexedDB olmayan ortamlarda (SSR, çok eski tarayıcı) kuyruk devre dışı. */
export function isQueueSupported(): boolean {
  return typeof indexedDB !== "undefined";
}
