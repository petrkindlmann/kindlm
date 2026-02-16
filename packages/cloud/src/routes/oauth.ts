import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { hashToken } from "../middleware/auth.js";

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

export const oauthRoutes = new Hono<AppEnv>();

const ALLOWED_DASHBOARD_ORIGINS = [
  "https://cloud.kindlm.com",
  "http://localhost:3001",
];

// GET /github — Redirect to GitHub OAuth authorization
oauthRoutes.get("/github", (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;
  const redirectUri = new URL("/auth/github/callback", c.req.url).toString();
  const state = crypto.randomUUID();
  const dashboardRedirect = c.req.query("redirect_uri");

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email");

  // Encode dashboard redirect URI in state if provided and allowed
  if (dashboardRedirect && ALLOWED_DASHBOARD_ORIGINS.some((o) => dashboardRedirect.startsWith(o))) {
    url.searchParams.set("state", `${state}|${dashboardRedirect}`);
  } else {
    url.searchParams.set("state", state);
  }

  return c.redirect(url.toString());
});

// GET /github/callback — Exchange code for token, create/find user
oauthRoutes.get("/github/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: "Missing code parameter" }, 400);
  }

  // Exchange code for GitHub access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenRes.json()) as GitHubTokenResponse;
  if (tokenData.error) {
    return c.json(
      { error: `GitHub OAuth error: ${tokenData.error_description ?? tokenData.error}` },
      400,
    );
  }

  // Fetch GitHub user info
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
      "User-Agent": "KindLM-Cloud",
    },
  });

  if (!userRes.ok) {
    return c.json({ error: "Failed to fetch GitHub user info" }, 500);
  }

  const githubUser = (await userRes.json()) as GitHubUser;

  // Fetch primary email if not public
  let email = githubUser.email;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
        "User-Agent": "KindLM-Cloud",
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email ?? null;
    }
  }

  const queries = getQueries(c.env.DB);

  // Find or create user
  let user = await queries.getUserByGithubId(githubUser.id);
  if (user) {
    // Update user info on each login
    await queries.updateUser(user.id, {
      githubLogin: githubUser.login,
      email,
      avatarUrl: githubUser.avatar_url,
    });
  } else {
    user = await queries.createUser(
      githubUser.id,
      githubUser.login,
      email,
      githubUser.avatar_url,
    );
  }

  // Find user's org or create one
  const userOrgs = await queries.getUserOrgs(user.id);
  let org = userOrgs[0];
  if (!org) {
    org = await queries.createOrg(githubUser.login);
    await queries.addOrgMember(org.id, user.id, "owner");
  }

  // Generate API token
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plaintext = `klm_${hex}`;
  const tokenHash = await hashToken(plaintext);

  await queries.createToken(
    org.id,
    `login-${new Date().toISOString().slice(0, 10)}`,
    tokenHash,
    "full",
  );

  // If a dashboard redirect was encoded in state, redirect with token
  const stateParam = c.req.query("state") ?? "";
  const pipeIdx = stateParam.indexOf("|");
  if (pipeIdx !== -1) {
    const dashboardRedirect = stateParam.slice(pipeIdx + 1);
    if (ALLOWED_DASHBOARD_ORIGINS.some((o) => dashboardRedirect.startsWith(o))) {
      const redirectUrl = new URL(dashboardRedirect);
      redirectUrl.searchParams.set("token", plaintext);
      return c.redirect(redirectUrl.toString());
    }
  }

  // Return an HTML page showing the token for copy-paste into CLI
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KindLM — Authenticated</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; color: #1c1917; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #57534e; line-height: 1.6; }
    .token-box { background: #1c1917; color: #d6d3d1; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 14px; word-break: break-all; margin: 24px 0; cursor: pointer; position: relative; }
    .token-box:hover { background: #292524; }
    .hint { font-size: 13px; color: #a8a29e; }
    .cmd { background: #f5f5f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px; }
    .copied { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #4ade80; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Authenticated as ${githubUser.login}</h1>
  <p>Copy this token and paste it into your terminal:</p>
  <div class="token-box" id="token" onclick="copyToken()">
    ${plaintext}
    <span class="copied" id="copied" style="display:none">Copied!</span>
  </div>
  <p class="hint">Or run: <span class="cmd">kindlm login --token ${plaintext}</span></p>
  <p class="hint">You can close this tab after copying the token.</p>
  <script>
    function copyToken() {
      navigator.clipboard.writeText('${plaintext}');
      document.getElementById('copied').style.display = 'inline';
      setTimeout(() => { document.getElementById('copied').style.display = 'none'; }, 2000);
    }
  </script>
</body>
</html>`;

  return c.html(html);
});
