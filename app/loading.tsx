/**
 * Sayfa geçişlerinde anında görünen iskelet.
 *
 * Bu dosya olmadan Next, hedef sayfanın istemci bileşeni hazır olana kadar
 * ESKİ sayfayı ekranda tutuyordu: tıklamayla yeni içerik arasında görsel
 * olarak hiçbir şey olmuyor ve uygulama donmuş gibi hissettiriyordu.
 * Suspense sınırı sayesinde geçiş anında başlıyor.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-6 sm:px-6" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-line" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-line" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-line" />
        ))}
      </div>
      <span className="sr-only">Yükleniyor</span>
    </div>
  );
}
