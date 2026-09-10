import { createClient, type User } from "@supabase/supabase-js";
import type { Project } from "../types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const cloudConfigured = Boolean(url && key);
export const supabase = cloudConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, detectSessionInUrl: true },
    })
  : null;
export async function currentUser(): Promise<User | null> {
  return (await supabase?.auth.getUser())?.data.user ?? null;
}
export async function signInWithEmail(email: string) {
  if (!supabase) throw new Error("Cloud is not configured.");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}
export async function signOut() {
  await supabase?.auth.signOut();
}
export async function syncProject(project: Project) {
  if (!supabase) throw new Error("Cloud is not configured.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in before enabling cloud sync.");
  const run = project.run!;
  const { error: pError } = await supabase.from("projects").upsert({
    id: project.id,
    owner_id: user.id,
    name: project.name,
    description: project.description,
    schema_version: project.schemaVersion,
    manifest: run.manifest,
  });
  if (pError) throw pError;
  const { error: rError } = await supabase.from("runs").upsert({
    id: run.id,
    project_id: project.id,
    owner_id: user.id,
    schema_version: project.schemaVersion,
    status: "complete",
    row_count: run.normalizedRows.length,
    column_count: run.manifest.columnCount,
    summary: {
      dashboard: run.dashboard,
      validations: run.validations,
      workflow: run.workflow,
      trace: run.trace,
    },
  });
  if (rError) throw rError;
  return user;
}
