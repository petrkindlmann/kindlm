import type { Token, SamlConfig, SigningKey } from "../../types.js";

function mapToken(row: Record<string, unknown>): Token {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    userId: (row.user_id as string) ?? null,
    name: row.name as string,
    tokenHash: row.token_hash as string,
    scope: row.scope as Token["scope"],
    projectId: (row.project_id as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    lastUsed: (row.last_used as string) ?? null,
    createdAt: row.created_at as string,
    revokedAt: (row.revoked_at as string) ?? null,
  };
}

function mapSigningKey(row: Record<string, unknown>): SigningKey {
  return {
    orgId: row.org_id as string,
    publicKey: row.public_key as string,
    privateKeyEnc: row.private_key_enc as string,
    algorithm: row.algorithm as string,
    createdAt: row.created_at as string,
  };
}

function mapSamlConfig(row: Record<string, unknown>): SamlConfig {
  return {
    orgId: row.org_id as string,
    idpEntityId: row.idp_entity_id as string,
    idpSsoUrl: row.idp_sso_url as string,
    idpCertificate: row.idp_certificate as string,
    spEntityId: row.sp_entity_id as string,
    enabled: (row.enabled as number) === 1,
    createdAt: row.created_at as string,
  };
}

export function getAuthQueries(db: D1Database) {
  // ---- Tokens ----

  async function getTokenByHash(hash: string): Promise<Token | null> {
    const row = await db
      .prepare(
        "SELECT * FROM tokens WHERE token_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > datetime('now'))",
      )
      .bind(hash)
      .first();
    return row ? mapToken(row) : null;
  }

  async function createToken(
    orgId: string,
    name: string,
    tokenHash: string,
    scope: Token["scope"] = "full",
    projectId?: string | null,
    expiresAt?: string | null,
    userId?: string | null,
  ): Promise<Token> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO tokens (id, org_id, user_id, name, token_hash, scope, project_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, orgId, userId ?? null, name, tokenHash, scope, projectId ?? null, expiresAt ?? null, now)
      .run();
    return {
      id,
      orgId,
      userId: userId ?? null,
      name,
      tokenHash,
      scope,
      projectId: projectId ?? null,
      expiresAt: expiresAt ?? null,
      lastUsed: null,
      createdAt: now,
      revokedAt: null,
    };
  }

  async function listTokens(orgId: string): Promise<Token[]> {
    const { results } = await db
      .prepare(
        "SELECT * FROM tokens WHERE org_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 100",
      )
      .bind(orgId)
      .all();
    return results.map(mapToken);
  }

  async function revokeToken(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .prepare(
        "UPDATE tokens SET revoked_at = datetime('now') WHERE id = ? AND org_id = ? AND revoked_at IS NULL",
      )
      .bind(id, orgId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function getTokenById(id: string, orgId: string): Promise<Token | null> {
    const row = await db
      .prepare("SELECT * FROM tokens WHERE id = ? AND org_id = ? AND revoked_at IS NULL")
      .bind(id, orgId)
      .first();
    return row ? mapToken(row) : null;
  }

  async function updateTokenLastUsed(id: string): Promise<void> {
    await db
      .prepare("UPDATE tokens SET last_used = datetime('now') WHERE id = ?")
      .bind(id)
      .run();
  }

  // ---- Signing Keys ----

  async function getSigningKey(orgId: string): Promise<SigningKey | null> {
    const row = await db
      .prepare("SELECT * FROM signing_keys WHERE org_id = ?")
      .bind(orgId)
      .first();
    return row ? mapSigningKey(row) : null;
  }

  async function createSigningKey(
    orgId: string,
    publicKey: string,
    privateKeyEnc: string,
  ): Promise<SigningKey> {
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO signing_keys (org_id, public_key, private_key_enc, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(orgId, publicKey, privateKeyEnc, now)
      .run();
    return { orgId, publicKey, privateKeyEnc, algorithm: "Ed25519", createdAt: now };
  }

  // ---- SAML Config ----

  async function getSamlConfig(orgId: string): Promise<SamlConfig | null> {
    const row = await db
      .prepare("SELECT * FROM saml_configs WHERE org_id = ?")
      .bind(orgId)
      .first();
    return row ? mapSamlConfig(row) : null;
  }

  async function getEnabledSamlConfigs(): Promise<SamlConfig[]> {
    const { results } = await db
      .prepare("SELECT * FROM saml_configs WHERE enabled = 1")
      .all();
    return results.map(mapSamlConfig);
  }

  async function upsertSamlConfig(
    orgId: string,
    config: {
      idpEntityId: string;
      idpSsoUrl: string;
      idpCertificate: string;
      spEntityId: string;
      enabled?: boolean;
    },
  ): Promise<SamlConfig> {
    const existing = await getSamlConfig(orgId);
    const now = new Date().toISOString();

    if (existing) {
      await db
        .prepare(
          "UPDATE saml_configs SET idp_entity_id = ?, idp_sso_url = ?, idp_certificate = ?, sp_entity_id = ?, enabled = ? WHERE org_id = ?",
        )
        .bind(
          config.idpEntityId,
          config.idpSsoUrl,
          config.idpCertificate,
          config.spEntityId,
          config.enabled ? 1 : 0,
          orgId,
        )
        .run();
    } else {
      await db
        .prepare(
          "INSERT INTO saml_configs (org_id, idp_entity_id, idp_sso_url, idp_certificate, sp_entity_id, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          orgId,
          config.idpEntityId,
          config.idpSsoUrl,
          config.idpCertificate,
          config.spEntityId,
          config.enabled ? 1 : 0,
          now,
        )
        .run();
    }

    const result = await getSamlConfig(orgId);
    if (!result) throw new Error("SAML config not found after upsert");
    return result;
  }

  return {
    getTokenByHash,
    createToken,
    listTokens,
    revokeToken,
    getTokenById,
    updateTokenLastUsed,
    getSigningKey,
    createSigningKey,
    getSamlConfig,
    getEnabledSamlConfigs,
    upsertSamlConfig,
  };
}
