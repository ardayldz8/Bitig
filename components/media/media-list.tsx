"use client";

import MediaCard from "@/components/media/media-card";
import type { MediaEntry } from "@/types/media";

type MediaListProps = {
  entries: MediaEntry[];
  onEdit: (entry: MediaEntry) => void;
  onDelete: (entry: MediaEntry) => void;
  onEpisodeChange: (entry: MediaEntry, delta: number) => void;
};

export default function MediaList({
  entries,
  onEdit,
  onDelete,
  onEpisodeChange,
}: MediaListProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {entries.map((entry) => (
        <li key={entry.id}>
          <MediaCard
            entry={entry}
            onEdit={onEdit}
            onDelete={onDelete}
            onEpisodeChange={onEpisodeChange}
          />
        </li>
      ))}
    </ul>
  );
}
