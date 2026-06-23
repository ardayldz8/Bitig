"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { computeTargets, ACTIVITY_LABELS, GOAL_LABELS } from "@/lib/nutrition";

export default function ProfileForm({
  profile,
  onSave,
}: {
  profile: Profile | null;
  onSave: (p: Profile) => void;
}) {
  const [p, setP] = useState<Profile>(profile ?? {});
  const [saved, setSaved] = useState(false);
  const targets = computeTargets(p);

  function num(v: string): number | undefined {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Boy (cm)">
          <input
            type="number"
            inputMode="numeric"
            defaultValue={p.height_cm ?? ""}
            onChange={(e) => setP((s) => ({ ...s, height_cm: num(e.target.value) }))}
            className={inputCls}
          />
        </Field>
        <Field label="Kilo (kg)">
          <input
            type="number"
            inputMode="numeric"
            defaultValue={p.weight_kg ?? ""}
            onChange={(e) => setP((s) => ({ ...s, weight_kg: num(e.target.value) }))}
            className={inputCls}
          />
        </Field>
        <Field label="Yaş">
          <input
            type="number"
            inputMode="numeric"
            defaultValue={p.age ?? ""}
            onChange={(e) => setP((s) => ({ ...s, age: num(e.target.value) }))}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Cinsiyet">
          <select
            defaultValue={p.sex ?? ""}
            onChange={(e) => setP((s) => ({ ...s, sex: (e.target.value || undefined) as Profile["sex"] }))}
            className={inputCls}
          >
            <option value="">Seç</option>
            <option value="male">Erkek</option>
            <option value="female">Kadın</option>
          </select>
        </Field>
        <Field label="Hedef">
          <select
            defaultValue={p.goal ?? ""}
            onChange={(e) => setP((s) => ({ ...s, goal: (e.target.value || undefined) as Profile["goal"] }))}
            className={inputCls}
          >
            <option value="">Seç</option>
            {Object.entries(GOAL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Aktivite">
        <select
          defaultValue={p.activity ?? ""}
          onChange={(e) =>
            setP((s) => ({ ...s, activity: (e.target.value || undefined) as Profile["activity"] }))
          }
          className={inputCls}
        >
          <option value="">Seç</option>
          {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>

      {targets ? (
        <p className="rounded-xl bg-indigo-500/10 px-3 py-2 text-sm">
          Günlük hedef: <b>{targets.target} kcal</b>{" "}
          <span className="text-[var(--muted)]">
            · P {targets.protein} · K {targets.carb} · Y {targets.fat} g
          </span>
        </p>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          Hedefin hesaplanması için boy, kilo, yaş, cinsiyet ve aktiviteyi doldur.
        </p>
      )}

      <button
        onClick={() => {
          onSave(p);
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1500);
        }}
        className="w-full rounded-xl bg-indigo-500 py-2 text-sm font-medium text-white"
      >
        {saved ? "Kaydedildi ✓" : "Profili kaydet"}
      </button>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-sm outline-none focus:border-indigo-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
