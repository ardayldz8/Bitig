"use client";

import { useId, useState } from "react";
import { Check, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { displayNumber } from "@/lib/nutrition/calculate-nutrition";
import { parseDecimal } from "@/lib/calorie/validation";
import { UNIT_LABELS, type DetectedFood } from "@/types/calorie";
import { SOURCE_LABELS, type FoodUnit } from "@/types/nutrition";

type DetectedFoodRowProps = {
  row: DetectedFood;
  onChange: (rowId: string, patch: Partial<DetectedFood>) => void;
  onRemove: (rowId: string) => void;
};

const UNITS: FoodUnit[] = ["g", "ml", "piece", "portion"];
const fieldClass =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink";

export default function DetectedFoodRow({
  row,
  onChange,
  onRemove,
}: DetectedFoodRowProps) {
  const baseId = useId();
  const [editing, setEditing] = useState(false);

  const sourceLabel = row.match ? SOURCE_LABELS[row.match.source] : null;

  /**
   * Makro alanları kontrolsüzdür (kullanıcı "8," gibi yarım değer yazabilsin diye).
   * Miktar/birim değişince değerler kaynaktan yeniden hesaplandığı için alanların
   * da tazelenmesi gerekir — bu anahtar yalnızca o zaman değişir, makroya
   * yazarken değişmez (imleç kaymaz).
   */
  const macroKey = `${row.quantity}-${row.unit}`;

  function commitNumber(field: keyof DetectedFood, raw: string) {
    const value = parseDecimal(raw);
    if (value === null || value < 0) return;
    onChange(row.rowId, { [field]: value } as Partial<DetectedFood>);
  }

  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{row.name}</p>
          {row.brand && <p className="text-sm text-ink-soft">{row.brand}</p>}
        </div>

        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            aria-label={`${row.name} değerlerini düzenle`}
            aria-expanded={editing}
            className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand"
          >
            {editing ? <Check size={16} aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => onRemove(row.rowId)}
            aria-label={`${row.name} satırını sil`}
            className="grid h-11 w-11 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:border-danger hover:text-danger"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Besin kaynağı bulunamadı uyarısı */}
      {!row.match && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          Bu yiyecek için doğrulanmış besin verisi bulunamadı. Değerleri manuel
          girebilirsin.
        </p>
      )}

      {/* Kaynak var ama "adet"in kaç gram olduğu bilinmiyor. Değerler 0 kalır;
          bunu gerçek bir 0'dan ayırt edilebilir kılmak gerekiyor. */}
      {row.match && row.needsQuantity && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
          <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          Bir {row.unit === "piece" ? "adedin" : "porsiyonun"} kaç gram olduğu
          bilinmiyor, bu yüzden değerler hesaplanamadı. Miktarı gram cinsinden
          gir.
        </p>
      )}

      {editing ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${baseId}-qty`} className="mb-1 block text-xs font-medium text-ink">
              Miktar
            </label>
            <input
              id={`${baseId}-qty`}
              type="text"
              inputMode="decimal"
              defaultValue={displayNumber(row.quantity)}
              onChange={(event) => commitNumber("quantity", event.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-unit`} className="mb-1 block text-xs font-medium text-ink">
              Birim
            </label>
            <select
              id={`${baseId}-unit`}
              value={row.unit}
              onChange={(event) =>
                onChange(row.rowId, { unit: event.target.value as FoodUnit })
              }
              className={fieldClass}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${baseId}-kcal`} className="mb-1 block text-xs font-medium text-ink">
              Kalori (kcal)
            </label>
            <input
              key={macroKey}
              id={`${baseId}-kcal`}
              type="text"
              inputMode="decimal"
              defaultValue={displayNumber(row.calories)}
              onChange={(event) => commitNumber("calories", event.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-protein`} className="mb-1 block text-xs font-medium text-ink">
              Protein (g)
            </label>
            <input
              key={macroKey}
              id={`${baseId}-protein`}
              type="text"
              inputMode="decimal"
              defaultValue={displayNumber(row.protein)}
              onChange={(event) => commitNumber("protein", event.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-carb`} className="mb-1 block text-xs font-medium text-ink">
              Karbonhidrat (g)
            </label>
            <input
              key={macroKey}
              id={`${baseId}-carb`}
              type="text"
              inputMode="decimal"
              defaultValue={displayNumber(row.carbohydrates)}
              onChange={(event) => commitNumber("carbohydrates", event.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-fat`} className="mb-1 block text-xs font-medium text-ink">
              Yağ (g)
            </label>
            <input
              key={macroKey}
              id={`${baseId}-fat`}
              type="text"
              inputMode="decimal"
              defaultValue={displayNumber(row.fat)}
              onChange={(event) => commitNumber("fat", event.target.value)}
              className={fieldClass}
            />
          </div>
        </div>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
          <Stat label="Miktar" value={`${displayNumber(row.quantity)} ${UNIT_LABELS[row.unit]}`} />
          <Stat label="Kalori" value={`${displayNumber(row.calories)} kcal`} strong />
          <Stat label="Protein" value={`${displayNumber(row.protein)} g`} />
          <Stat label="Karbonhidrat" value={`${displayNumber(row.carbohydrates)} g`} />
          <Stat label="Yağ" value={`${displayNumber(row.fat)} g`} />
        </dl>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-soft">
        <span>
          Kaynak:{" "}
          <strong className="font-medium text-ink">
            {row.manuallyEdited ? "Manuel (düzenlendi)" : (sourceLabel ?? "Manuel")}
          </strong>
        </span>
        {row.confidence !== null && (
          <span>
            Güven: <strong className="font-medium text-ink">%{Math.round(row.confidence * 100)}</strong>
          </span>
        )}
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className={strong ? "font-semibold text-ink" : "text-ink"}>{value}</dd>
    </div>
  );
}
