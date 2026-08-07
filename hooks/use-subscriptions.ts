"use client";

import { useCallback } from "react";
import { useCloudCollection } from "@/hooks/use-cloud-collection";
import { createId } from "@/lib/ids";
import type { Subscription } from "@/lib/subscriptions/calc";
import type { Row } from "@/lib/cloud/mappers";

function rowToSubscription(row: Row): Subscription | null {
  const id = row.id;
  const name = row.name;
  const startedOn = row.started_on;
  if (typeof id !== "string" || typeof name !== "string" || typeof startedOn !== "string") {
    return null;
  }

  const amount = typeof row.amount === "number" ? row.amount : Number(row.amount);
  const period = row.period === "yearly" ? "yearly" : "monthly";

  return {
    id,
    name,
    amount: Number.isFinite(amount) ? amount : 0,
    currency: typeof row.currency === "string" ? row.currency : "TRY",
    startedOn: startedOn.slice(0, 10),
    period,
    active: row.active !== false,
    notes: typeof row.notes === "string" ? row.notes : null,
  };
}

export type SubscriptionDraft = Omit<Subscription, "id" | "active">;

export type SubscriptionLibrary = {
  subscriptions: Subscription[];
  hydrated: boolean;
  error: string | null;
  addSubscription: (draft: SubscriptionDraft) => void;
  updateSubscription: (id: string, draft: SubscriptionDraft) => void;
  toggleActive: (id: string) => void;
  removeSubscription: (id: string) => void;
};

export function useSubscriptions(): SubscriptionLibrary {
  const collection = useCloudCollection<Subscription>({
    table: "subscriptions",
    orderColumn: "started_on",
    ascending: true,
    toItem: rowToSubscription,
  });

  const { mutate } = collection;

  const toRow = (item: Subscription, userId: string): Row => ({
    id: item.id,
    user_id: userId,
    name: item.name,
    amount: item.amount,
    currency: item.currency,
    started_on: item.startedOn,
    period: item.period,
    active: item.active,
    notes: item.notes,
    updated_at: new Date().toISOString(),
  });

  const addSubscription = useCallback(
    (draft: SubscriptionDraft) => {
      const item: Subscription = { ...draft, id: createId(), active: true };
      mutate(
        (previous) => [...previous, item],
        (client, userId) => client.from("subscriptions").insert(toRow(item, userId)),
        "Abonelik eklenemedi",
      );
    },
    [mutate],
  );

  const updateSubscription = useCallback(
    (id: string, draft: SubscriptionDraft) => {
      mutate(
        (previous) => previous.map((item) => (item.id === id ? { ...item, ...draft } : item)),
        (client, userId, next) => {
          const item = next.find((entry) => entry.id === id);
          if (!item) return Promise.resolve({ error: null });
          return client.from("subscriptions").update(toRow(item, userId)).eq("id", id);
        },
        "Abonelik güncellenemedi",
      );
    },
    [mutate],
  );

  const toggleActive = useCallback(
    (id: string) => {
      mutate(
        (previous) =>
          previous.map((item) => (item.id === id ? { ...item, active: !item.active } : item)),
        (client, _userId, next) => {
          const item = next.find((entry) => entry.id === id);
          if (!item) return Promise.resolve({ error: null });
          return client.from("subscriptions").update({ active: item.active }).eq("id", id);
        },
        "Abonelik değiştirilemedi",
      );
    },
    [mutate],
  );

  const removeSubscription = useCallback(
    (id: string) => {
      mutate(
        (previous) => previous.filter((item) => item.id !== id),
        (client) => client.from("subscriptions").delete().eq("id", id),
        "Abonelik silinemedi",
      );
    },
    [mutate],
  );

  return {
    subscriptions: collection.items,
    hydrated: collection.hydrated,
    error: collection.error,
    addSubscription,
    updateSubscription,
    toggleActive,
    removeSubscription,
  };
}
