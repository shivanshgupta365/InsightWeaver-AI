import Dexie, { type EntityTable } from "dexie";
import type { Project } from "../types";

const db = new Dexie("insightweaver") as Dexie & {
  projects: EntityTable<Project, "id">;
};
db.version(1).stores({ projects: "id, updatedAt, source" });
export async function saveProject(project: Project) {
  await db.projects.put(project);
}
export async function listProjects() {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}
export async function deleteProject(id: string) {
  await db.projects.delete(id);
}
export async function getProject(id: string) {
  return db.projects.get(id);
}
