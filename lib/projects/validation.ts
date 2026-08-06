import { z } from "zod";

export const projectStatusSchema = z.enum(["active", "on_hold", "completed", "archived"]);
export const featureStatusSchema = z.enum([
  "planned",
  "in_progress",
  "completed",
  "blocked",
  "on_hold",
]);
export const prioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Proje adı boş bırakılamaz.").max(120),
  description: z.string().trim().max(2000).nullable().default(null),
  status: projectStatusSchema.default("active"),
  technologies: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  githubFullName: z
    .string()
    .trim()
    .regex(/^[\w.-]+\/[\w.-]+$/, "Geçersiz repository adı.")
    .nullable()
    .default(null),
});

export const featureInputSchema = z.object({
  title: z.string().trim().min(1, "Başlık boş bırakılamaz.").max(200),
  description: z.string().trim().max(4000).nullable().default(null),
  status: featureStatusSchema.default("planned"),
  priority: prioritySchema.default("medium"),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı.")
    .nullable()
    .default(null),
});

export const noteInputSchema = z.object({
  title: z.string().trim().min(1, "Başlık boş bırakılamaz.").max(200),
  content: z.string().trim().max(20_000).default(""),
  relatedFeatureId: z.string().nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  pinned: z.boolean().default(false),
});

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Başlık boş bırakılamaz.").max(200),
  description: z.string().trim().max(4000).nullable().default(null),
  completed: z.boolean().default(false),
  priority: prioritySchema.default("medium"),
  relatedFeatureId: z.string().nullable().default(null),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
export type FeatureInput = z.infer<typeof featureInputSchema>;
export type NoteInput = z.infer<typeof noteInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;

/** Zod hatasını alan bazlı, kullanıcıya gösterilebilir mesajlara çevirir. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in output)) {
      output[key] = issue.message;
    }
  }
  return output;
}
