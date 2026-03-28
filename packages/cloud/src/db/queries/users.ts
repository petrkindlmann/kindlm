import type { User } from "../../types.js";

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    githubId: row.github_id as number,
    githubLogin: row.github_login as string,
    email: (row.email as string) ?? null,
    avatarUrl: (row.avatar_url as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function getUserQueries(db: D1Database) {
  async function getUser(id: string): Promise<User | null> {
    const row = await db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapUser(row) : null;
  }

  async function getUserByGithubId(githubId: number): Promise<User | null> {
    const row = await db
      .prepare("SELECT * FROM users WHERE github_id = ?")
      .bind(githubId)
      .first();
    return row ? mapUser(row) : null;
  }

  async function getUserByEmail(email: string): Promise<User | null> {
    const row = await db
      .prepare("SELECT * FROM users WHERE email = ?")
      .bind(email)
      .first();
    return row ? mapUser(row) : null;
  }

  async function createUser(
    githubId: number,
    githubLogin: string,
    email: string | null,
    avatarUrl: string | null,
  ): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO users (id, github_id, github_login, email, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(id, githubId, githubLogin, email, avatarUrl, now)
      .run();
    return { id, githubId, githubLogin, email, avatarUrl, createdAt: now };
  }

  async function updateUser(
    id: string,
    fields: Partial<Pick<User, "githubLogin" | "email" | "avatarUrl">>,
  ): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (fields.githubLogin !== undefined) {
      sets.push("github_login = ?");
      values.push(fields.githubLogin);
    }
    if (fields.email !== undefined) {
      sets.push("email = ?");
      values.push(fields.email);
    }
    if (fields.avatarUrl !== undefined) {
      sets.push("avatar_url = ?");
      values.push(fields.avatarUrl);
    }
    if (sets.length === 0) return;
    values.push(id);
    await db
      .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  return {
    getUser,
    getUserByGithubId,
    getUserByEmail,
    createUser,
    updateUser,
  };
}
