/** Veriler mount sonrası okunurken gösterilen sade iskelet. */
export default function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Özet bilgiler yükleniyor</p>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <li
            key={index}
            className="rounded-card border border-line bg-surface p-5 shadow-card"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 shrink-0 rounded-full bg-line" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-line" />
                <div className="h-3 w-full max-w-56 rounded bg-line" />
              </div>
            </div>
            <div className="mt-6 border-t border-line pt-4">
              <div className="h-3 w-24 rounded bg-line" />
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-line" />
            </div>
            <div className="mt-4 h-11 w-11 rounded-xl bg-line" />
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="h-4 w-36 rounded bg-line" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-line" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-28 rounded bg-line" />
                <div className="h-2.5 w-20 rounded bg-line" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
