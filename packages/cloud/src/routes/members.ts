import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { getLimits } from "../middleware/plan-gate.js";
import { auditLog } from "./audit-helper.js";
import { inviteMemberBody, updateMemberRoleBody, validateBody } from "../validation.js";

export const memberRoutes = new Hono<AppEnv>();

// GET / — List org members
memberRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);
  const members = await queries.listOrgMembers(auth.org.id);

  return c.json({
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt,
      user: m.user
        ? {
            id: m.user.id,
            githubLogin: m.user.githubLogin,
            email: m.user.email,
            avatarUrl: m.user.avatarUrl,
          }
        : null,
    })),
  });
});

// POST /invite — Invite a member by GitHub username
memberRoutes.post("/invite", async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  // Check caller is owner or admin
  const callerId = auth.token.userId ?? auth.user?.id;
  if (!callerId) {
    return c.json({ error: "Token not associated with a user" }, 403);
  }
  const callerMember = await queries.getOrgMember(auth.org.id, callerId);
  if (!callerMember || (callerMember.role !== "owner" && callerMember.role !== "admin")) {
    return c.json({ error: "Only owners and admins can invite members" }, 403);
  }

  // Check member limit
  const limits = getLimits(auth.org.plan);
  const memberCount = await queries.countOrgMembers(auth.org.id);
  if (memberCount >= limits.members) {
    return c.json(
      {
        error: `Member limit reached (${limits.members} for ${auth.org.plan} plan). Please upgrade.`,
      },
      403,
    );
  }

  const raw = await c.req.json();
  const parsed = validateBody(inviteMemberBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  const role = body.role ?? "member";

  // Look up user by GitHub login
  // For now, the user must have logged in at least once
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM users WHERE github_login = ?",
  )
    .bind(body.githubLogin)
    .all();

  const userRow = results[0];
  if (!userRow) {
    return c.json(
      {
        error: `User "${body.githubLogin}" not found. They must sign in to KindLM Cloud first.`,
      },
      404,
    );
  }

  const userId = userRow.id as string;

  // Check if already a member
  const existing = await queries.getOrgMember(auth.org.id, userId);
  if (existing) {
    return c.json({ error: "User is already a member of this organization" }, 409);
  }

  const member = await queries.addOrgMember(auth.org.id, userId, role);
  auditLog(c, "member.invite", "member", userId, { role, githubLogin: body.githubLogin });
  return c.json(
    {
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
    },
    201,
  );
});

// PATCH /:userId — Update member role
memberRoutes.patch("/:userId", async (c) => {
  const auth = c.get("auth");
  const userId = c.req.param("userId");
  const queries = getQueries(c.env.DB);

  // Authorization: only owners and admins can change roles
  const callerId = auth.token.userId ?? auth.user?.id;
  if (!callerId) {
    return c.json({ error: "Token not associated with a user" }, 403);
  }
  const callerMember = await queries.getOrgMember(auth.org.id, callerId);
  if (!callerMember || (callerMember.role !== "owner" && callerMember.role !== "admin")) {
    return c.json({ error: "Only owners and admins can change member roles" }, 403);
  }

  // Prevent admins from demoting owners
  const targetMember = await queries.getOrgMember(auth.org.id, userId);
  if (targetMember?.role === "owner" && callerMember.role !== "owner") {
    return c.json({ error: "Only owners can change another owner's role" }, 403);
  }

  const raw = await c.req.json();
  const parsed = validateBody(updateMemberRoleBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  const updated = await queries.updateOrgMemberRole(auth.org.id, userId, body.role);
  if (!updated) {
    return c.json({ error: "Member not found" }, 404);
  }

  auditLog(c, "member.role_change", "member", userId, { role: body.role });
  return c.json({ userId, role: body.role });
});

// DELETE /:userId — Remove member
memberRoutes.delete("/:userId", async (c) => {
  const auth = c.get("auth");
  const userId = c.req.param("userId");
  const queries = getQueries(c.env.DB);

  // Authorization: only owners and admins can remove members
  const callerId = auth.token.userId ?? auth.user?.id;
  if (!callerId) {
    return c.json({ error: "Token not associated with a user" }, 403);
  }
  const callerMember = await queries.getOrgMember(auth.org.id, callerId);
  if (!callerMember || (callerMember.role !== "owner" && callerMember.role !== "admin")) {
    return c.json({ error: "Only owners and admins can remove members" }, 403);
  }

  // Prevent admins from removing owners
  const targetMember = await queries.getOrgMember(auth.org.id, userId);
  if (targetMember?.role === "owner" && callerMember.role !== "owner") {
    return c.json({ error: "Only owners can remove another owner" }, 403);
  }

  const removed = await queries.removeOrgMember(auth.org.id, userId);
  if (!removed) {
    return c.json({ error: "Member not found" }, 404);
  }

  auditLog(c, "member.remove", "member", userId);
  return c.body(null, 204);
});
