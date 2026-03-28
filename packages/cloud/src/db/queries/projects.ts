import type { Project } from "../../types.js";

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function getProjectQueries(db: D1Database) {
  async function getProject(id: string): Promise<Project | null> {
    const row = await db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapProject(row) : null;
  }

  async function createProject(
    orgId: string,
    name: string,
    description?: string | null,
  ): Promise<Project> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO projects (id, org_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(id, orgId, name, description ?? null, now, now)
      .run();
    return {
      id,
      orgId,
      name,
      description: description ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async function listProjects(orgId: string): Promise<Project[]> {
    const { results } = await db
      .prepare(
        "SELECT * FROM projects WHERE org_id = ? ORDER BY created_at DESC LIMIT 100",
      )
      .bind(orgId)
      .all();
    return results.map(mapProject);
  }

  async function deleteProject(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .prepare("DELETE FROM projects WHERE id = ? AND org_id = ?")
      .bind(id, orgId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function countProjects(orgId: string): Promise<number> {
    const row = await db
      .prepare("SELECT COUNT(*) as count FROM projects WHERE org_id = ?")
      .bind(orgId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  async function updateProject(
    id: string,
    orgId: string,
    fields: Partial<Pick<Project, "name" | "description">>,
  ): Promise<Project | null> {
    const sets: string[] = ["updated_at = ?"];
    const values: unknown[] = [new Date().toISOString()];

    if (fields.name !== undefined) {
      sets.push("name = ?");
      values.push(fields.name);
    }
    if (fields.description !== undefined) {
      sets.push("description = ?");
      values.push(fields.description);
    }

    if (sets.length === 1) return getProject(id);

    values.push(id, orgId);
    const result = await db
      .prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ? AND org_id = ?`)
      .bind(...values)
      .run();

    if ((result.meta?.changes ?? 0) === 0) return null;
    return getProject(id);
  }

  return {
    getProject,
    createProject,
    listProjects,
    deleteProject,
    countProjects,
    updateProject,
  };
}
