import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { applyHeaders } from "../_shared.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyHeaders(res);
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    return res
      .status(503)
      .json({ error: "Cloud projects are not configured." });
  const token = String(req.headers.authorization ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token)
    return res.status(401).json({ error: "Authentication required." });
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);
  if (error || !user)
    return res.status(401).json({ error: "Invalid session." });
  const projectId = String(req.body?.projectId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(projectId))
    return res.status(400).json({ error: "Invalid project id." });
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return res.status(204).end();
  const prefix = `${user.id}/${projectId}`;
  const { data: runs } = await admin
    .from("runs")
    .select("id")
    .eq("project_id", projectId)
    .eq("owner_id", user.id);
  for (const run of runs ?? []) {
    const { data: objects } = await admin.storage
      .from("project-files")
      .list(`${prefix}/${run.id}`);
    const paths = (objects ?? []).map((o) => `${prefix}/${run.id}/${o.name}`);
    if (paths.length) await admin.storage.from("project-files").remove(paths);
  }
  const { error: deleteError } = await admin
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("owner_id", user.id);
  if (deleteError) return res.status(500).json({ error: "Deletion failed." });
  return res.status(204).end();
}
