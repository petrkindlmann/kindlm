import type {
  Org,
  OrgMember,
  OrgRole,
  PendingInvite,
} from "../../types.js";

function mapOrg(row: Record<string, unknown>): Org {
  return {
    id: row.id as string,
    name: row.name as string,
    plan: row.plan as Org["plan"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapOrgMember(row: Record<string, unknown>): OrgMember {
  return {
    orgId: row.org_id as string,
    userId: row.user_id as string,
    role: row.role as OrgRole,
    createdAt: row.created_at as string,
  };
}

function mapPendingInvite(row: Record<string, unknown>): PendingInvite {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    email: row.email as string,
    role: row.role as OrgRole,
    invitedBy: row.invited_by as string,
    expiresAt: row.expires_at as string,
    createdAt: row.created_at as string,
  };
}

export function getOrgQueries(db: D1Database) {
  async function getOrg(id: string): Promise<Org | null> {
    const row = await db
      .prepare("SELECT * FROM orgs WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapOrg(row) : null;
  }

  async function createOrg(
    name: string,
    plan: Org["plan"] = "free",
  ): Promise<Org> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO orgs (id, name, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(id, name, plan, now, now)
      .run();
    return { id, name, plan, createdAt: now, updatedAt: now };
  }

  // ---- Org Members ----

  async function addOrgMember(
    orgId: string,
    userId: string,
    role: OrgRole = "member",
  ): Promise<OrgMember> {
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO org_members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(orgId, userId, role, now)
      .run();
    return { orgId, userId, role, createdAt: now };
  }

  async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
    const { results } = await db
      .prepare(
        `SELECT om.org_id, om.user_id, om.role, om.created_at,
                u.id as u_id, u.github_id as u_github_id, u.github_login as u_github_login,
                u.email as u_email, u.avatar_url as u_avatar_url, u.created_at as u_created_at
         FROM org_members om
         JOIN users u ON om.user_id = u.id
         WHERE om.org_id = ?
         ORDER BY om.created_at`,
      )
      .bind(orgId)
      .all();
    return results.map((row) => {
      const member = mapOrgMember(row);
      member.user = {
        id: row.u_id as string,
        githubId: row.u_github_id as number,
        githubLogin: row.u_github_login as string,
        email: (row.u_email as string) ?? null,
        avatarUrl: (row.u_avatar_url as string) ?? null,
        createdAt: row.u_created_at as string,
      };
      return member;
    });
  }

  async function removeOrgMember(orgId: string, userId: string): Promise<boolean> {
    const result = await db
      .prepare("DELETE FROM org_members WHERE org_id = ? AND user_id = ?")
      .bind(orgId, userId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function updateOrgMemberRole(
    orgId: string,
    userId: string,
    role: OrgRole,
  ): Promise<boolean> {
    const result = await db
      .prepare("UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?")
      .bind(role, orgId, userId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function countOrgMembers(orgId: string): Promise<number> {
    const row = await db
      .prepare("SELECT COUNT(*) as count FROM org_members WHERE org_id = ?")
      .bind(orgId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  async function getOrgMember(orgId: string, userId: string): Promise<OrgMember | null> {
    const row = await db
      .prepare("SELECT * FROM org_members WHERE org_id = ? AND user_id = ?")
      .bind(orgId, userId)
      .first();
    return row ? mapOrgMember(row) : null;
  }

  async function getUserOrgs(userId: string): Promise<Org[]> {
    const { results } = await db
      .prepare(
        `SELECT o.* FROM orgs o
         JOIN org_members om ON o.id = om.org_id
         WHERE om.user_id = ?
         ORDER BY o.created_at`,
      )
      .bind(userId)
      .all();
    return results.map(mapOrg);
  }

  // ---- Pending Invites ----

  async function createPendingInvite(
    orgId: string,
    email: string,
    role: OrgRole,
    invitedBy: string,
    expiresAt: string,
  ): Promise<PendingInvite> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO pending_invites (id, org_id, email, role, invited_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, orgId, email, role, invitedBy, expiresAt, now)
      .run();
    return { id, orgId, email, role, invitedBy, expiresAt, createdAt: now };
  }

  async function getPendingInvitesByOrg(orgId: string): Promise<PendingInvite[]> {
    const { results } = await db
      .prepare(
        "SELECT * FROM pending_invites WHERE org_id = ? AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 100",
      )
      .bind(orgId)
      .all();
    return results.map(mapPendingInvite);
  }

  async function getPendingInviteByEmail(orgId: string, email: string): Promise<PendingInvite | null> {
    const row = await db
      .prepare(
        "SELECT * FROM pending_invites WHERE org_id = ? AND email = ? AND expires_at > datetime('now')",
      )
      .bind(orgId, email)
      .first();
    return row ? mapPendingInvite(row) : null;
  }

  async function deletePendingInvite(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .prepare("DELETE FROM pending_invites WHERE id = ? AND org_id = ?")
      .bind(id, orgId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function getOrgTokenTtl(orgId: string): Promise<number | null> {
    const row = await db
      .prepare("SELECT token_default_ttl_hours FROM orgs WHERE id = ?")
      .bind(orgId)
      .first<{ token_default_ttl_hours: number | null }>();
    return row?.token_default_ttl_hours ?? null;
  }

  async function updateOrgTokenTtl(orgId: string, ttlHours: number | null): Promise<boolean> {
    const result = await db
      .prepare("UPDATE orgs SET token_default_ttl_hours = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(ttlHours, orgId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  return {
    getOrg,
    createOrg,
    getOrgTokenTtl,
    updateOrgTokenTtl,
    addOrgMember,
    listOrgMembers,
    removeOrgMember,
    updateOrgMemberRole,
    countOrgMembers,
    getOrgMember,
    getUserOrgs,
    createPendingInvite,
    getPendingInvitesByOrg,
    getPendingInviteByEmail,
    deletePendingInvite,
  };
}
