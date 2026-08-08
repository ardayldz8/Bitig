"use client";

import { useCallback, useMemo } from "react";
import { useCloudCollection } from "@/hooks/use-cloud-collection";
import { createId } from "@/lib/ids";
import type { RepoSnapshot, RepoWithTriage, TriageDecision } from "@/lib/repos/inventory";
import type { Row } from "@/lib/cloud/mappers";

type Triage = { id: string; fullName: string; decision: TriageDecision; note: string | null };

function num(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowToSnapshot(row: Row): (RepoSnapshot & { id: string }) | null {
  const id = row.id;
  const fullName = row.full_name;
  if (typeof id !== "string" || typeof fullName !== "string") return null;

  const str = (key: string) => (typeof row[key] === "string" ? (row[key] as string) : null);

  return {
    id,
    fullName,
    isPrivate: row.is_private === true,
    isFork: row.is_fork === true,
    isArchived: row.is_archived === true,
    language: str("language"),
    description: str("description"),
    htmlUrl: str("html_url"),
    pushedAt: str("pushed_at"),
    openIssues: num(row, "open_issues"),
    openPrs: num(row, "open_prs"),
    ciConclusion: str("ci_conclusion"),
    ciAt: str("ci_at"),
  };
}

function rowToTriage(row: Row): Triage | null {
  const id = row.id;
  const fullName = row.full_name;
  const decision = row.decision;
  const gecerli = ["active", "done", "someday", "junk"];
  if (
    typeof id !== "string" ||
    typeof fullName !== "string" ||
    typeof decision !== "string" ||
    !gecerli.includes(decision)
  ) {
    return null;
  }
  return {
    id,
    fullName,
    decision: decision as TriageDecision,
    note: typeof row.note === "string" ? row.note : null,
  };
}

export type RepoInventory = {
  repos: RepoWithTriage[];
  hydrated: boolean;
  error: string | null;
  setDecision: (fullName: string, decision: TriageDecision | null) => void;
  reload: () => Promise<void>;
};

export function useRepoInventory(): RepoInventory {
  const snapshots = useCloudCollection<RepoSnapshot & { id: string }>({
    table: "repo_snapshots",
    orderColumn: "pushed_at",
    ascending: false,
    toItem: rowToSnapshot,
  });

  const triage = useCloudCollection<Triage>({
    table: "repo_triage",
    orderColumn: "decided_at",
    ascending: false,
    toItem: rowToTriage,
  });

  const { mutate: mutateTriage } = triage;

  const repos = useMemo<RepoWithTriage[]>(() => {
    const kararlar = new Map(triage.items.map((item) => [item.fullName, item]));
    return snapshots.items.map((repo) => {
      const karar = kararlar.get(repo.fullName);
      return { ...repo, decision: karar?.decision ?? null, note: karar?.note ?? null };
    });
  }, [snapshots.items, triage.items]);

  const setDecision = useCallback(
    (fullName: string, decision: TriageDecision | null) => {
      if (decision === null) {
        // Karardan vazgeçmek: satır silinir, repo yeniden "karar bekliyor" olur
        mutateTriage(
          (previous) => previous.filter((item) => item.fullName !== fullName),
          (client, userId) =>
            client.from("repo_triage").delete().eq("user_id", userId).eq("full_name", fullName),
          "Karar geri alınamadı",
        );
        return;
      }

      mutateTriage(
        (previous) => {
          const varOlan = previous.find((item) => item.fullName === fullName);
          if (varOlan) {
            return previous.map((item) =>
              item.fullName === fullName ? { ...item, decision } : item,
            );
          }
          return [...previous, { id: createId(), fullName, decision, note: null }];
        },
        (client, userId, next) => {
          const item = next.find((entry) => entry.fullName === fullName);
          if (!item) return Promise.resolve({ error: null });
          /*
           * upsert + onConflict: aynı repo için ikinci kez karar verildiğinde
           * yeni satır açmak yerine mevcut satır güncellenir. Tabloda
           * (user_id, full_name) benzersiz.
           */
          return client.from("repo_triage").upsert(
            {
              id: item.id,
              user_id: userId,
              full_name: fullName,
              decision,
              decided_at: new Date().toISOString(),
            },
            { onConflict: "user_id,full_name" },
          );
        },
        "Karar kaydedilemedi",
      );
    },
    [mutateTriage],
  );

  return {
    repos,
    hydrated: snapshots.hydrated && triage.hydrated,
    error: snapshots.error ?? triage.error,
    setDecision,
    reload: snapshots.reload,
  };
}
