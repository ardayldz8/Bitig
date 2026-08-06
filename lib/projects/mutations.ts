import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rowToActivity,
  rowToFeature,
  rowToNote,
  rowToProject,
  rowToTask,
} from "@/lib/projects/queries";
import type {
  FeatureInput,
  NoteInput,
  ProjectInput,
  TaskInput,
} from "@/lib/projects/validation";
import type {
  Project,
  ProjectActivity,
  ProjectFeature,
  ProjectNote,
  ProjectTask,
} from "@/types/project";

/**
 * Supabase yazma işlemleri.
 * user_id istemciden gönderilse de RLS `with check (auth.uid() = user_id)`
 * ile doğrular — başkasının adına kayıt yazılamaz.
 */

function fail(message: string | undefined): never {
  throw new Error(message ?? "Supabase işlemi başarısız.");
}

export async function insertProject(
  client: SupabaseClient,
  userId: string,
  input: ProjectInput,
): Promise<Project> {
  const { data, error } = await client
    .from("projects")
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description,
      status: input.status,
      technologies: input.technologies,
      github_full_name: input.githubFullName,
    })
    .select("*")
    .single();

  if (error || !data) fail(error?.message);
  return rowToProject(data);
}

export async function updateProjectRow(
  client: SupabaseClient,
  id: string,
  input: ProjectInput,
): Promise<void> {
  const { error } = await client
    .from("projects")
    .update({
      name: input.name,
      description: input.description,
      status: input.status,
      technologies: input.technologies,
      github_full_name: input.githubFullName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) fail(error.message);
}

export async function deleteProjectRow(
  client: SupabaseClient,
  id: string,
): Promise<void> {
  // Alt tablolar ON DELETE CASCADE ile birlikte silinir
  const { error } = await client.from("projects").delete().eq("id", id);
  if (error) fail(error.message);
}

export async function insertFeature(
  client: SupabaseClient,
  projectId: string,
  input: FeatureInput,
  position: number,
): Promise<ProjectFeature> {
  const { data, error } = await client
    .from("project_features")
    .insert({
      project_id: projectId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      acceptance_criteria: input.acceptanceCriteria,
      target_date: input.targetDate,
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
      position,
    })
    .select("*")
    .single();

  if (error || !data) fail(error?.message);
  return rowToFeature(data);
}

export async function updateFeatureRow(
  client: SupabaseClient,
  id: string,
  input: FeatureInput,
): Promise<void> {
  const { error } = await client
    .from("project_features")
    .update({
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      acceptance_criteria: input.acceptanceCriteria,
      target_date: input.targetDate,
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) fail(error.message);
}

export async function patchFeatureRow(
  client: SupabaseClient,
  id: string,
  patch: Partial<ProjectFeature>,
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
  if (patch.githubIssueNumber !== undefined) row.github_issue_number = patch.githubIssueNumber;
  if (patch.githubIssueUrl !== undefined) row.github_issue_url = patch.githubIssueUrl;

  const { error } = await client.from("project_features").update(row).eq("id", id);
  if (error) fail(error.message);
}

export async function deleteFeatureRow(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("project_features").delete().eq("id", id);
  if (error) fail(error.message);
}

export async function insertNote(
  client: SupabaseClient,
  projectId: string,
  input: NoteInput,
): Promise<ProjectNote> {
  const { data, error } = await client
    .from("project_notes")
    .insert({
      project_id: projectId,
      title: input.title,
      content: input.content,
      related_feature_id: input.relatedFeatureId,
      tags: input.tags,
      pinned: input.pinned,
    })
    .select("*")
    .single();

  if (error || !data) fail(error?.message);
  return rowToNote(data);
}

export async function updateNoteRow(
  client: SupabaseClient,
  id: string,
  input: NoteInput,
): Promise<void> {
  const { error } = await client
    .from("project_notes")
    .update({
      title: input.title,
      content: input.content,
      related_feature_id: input.relatedFeatureId,
      tags: input.tags,
      pinned: input.pinned,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) fail(error.message);
}

export async function patchNoteRow(
  client: SupabaseClient,
  id: string,
  patch: Partial<ProjectNote>,
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.pinned !== undefined) row.pinned = patch.pinned;
  if (patch.relatedFeatureId !== undefined) row.related_feature_id = patch.relatedFeatureId;

  const { error } = await client.from("project_notes").update(row).eq("id", id);
  if (error) fail(error.message);
}

export async function deleteNoteRow(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("project_notes").delete().eq("id", id);
  if (error) fail(error.message);
}

export async function insertTask(
  client: SupabaseClient,
  projectId: string,
  input: TaskInput,
): Promise<ProjectTask> {
  const { data, error } = await client
    .from("project_tasks")
    .insert({
      project_id: projectId,
      title: input.title,
      description: input.description,
      completed: input.completed,
      priority: input.priority,
      related_feature_id: input.relatedFeatureId,
      due_date: input.dueDate,
    })
    .select("*")
    .single();

  if (error || !data) fail(error?.message);
  return rowToTask(data);
}

export async function patchTaskRow(
  client: SupabaseClient,
  id: string,
  patch: Partial<ProjectTask>,
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.completed !== undefined) row.completed = patch.completed;
  if (patch.priority !== undefined) row.priority = patch.priority;

  const { error } = await client.from("project_tasks").update(row).eq("id", id);
  if (error) fail(error.message);
}

export async function deleteTaskRow(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("project_tasks").delete().eq("id", id);
  if (error) fail(error.message);
}

export async function insertActivity(
  client: SupabaseClient,
  activity: Omit<ProjectActivity, "id">,
): Promise<ProjectActivity> {
  const { data, error } = await client
    .from("project_activities")
    .insert({
      project_id: activity.projectId,
      source: activity.source,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      external_url: activity.externalUrl,
      occurred_at: activity.occurredAt,
    })
    .select("*")
    .single();

  if (error || !data) fail(error?.message);
  return rowToActivity(data);
}
