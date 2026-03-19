import type { Webhook, Run } from "../types.js";
import { isSlackUrl, formatSlackPayload } from "./slack-format.js";

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    runId: string;
    projectId: string;
    suiteId: string;
    status: string;
    passRate: number | null;
    testCount: number;
  };
}

const WEBHOOK_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 1_000;

async function sign(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deliverWebhook(
  webhook: Webhook,
  event: string,
  body: string,
): Promise<void> {
  const signature = await sign(webhook.secret, body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-KindLM-Signature": signature,
    "X-KindLM-Event": event,
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS);
    }

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });

      if (response.ok) return;

      // eslint-disable-next-line no-console
      console.error(
        `Webhook ${webhook.id} delivery failed: HTTP ${response.status} (attempt ${attempt + 1})`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `Webhook ${webhook.id} delivery error: ${msg} (attempt ${attempt + 1})`,
      );
    }
  }
}

export async function dispatchWebhooks(
  webhooks: Webhook[],
  event: string,
  run: Run,
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data: {
      runId: run.id,
      projectId: run.projectId,
      suiteId: run.suiteId,
      status: run.status,
      passRate: run.passRate,
      testCount: run.testCount,
    },
  };

  const rawBody = JSON.stringify(payload);

  await Promise.allSettled(
    webhooks.map((webhook) => {
      const body = isSlackUrl(webhook.url)
        ? JSON.stringify(formatSlackPayload(event, payload.data as unknown as Record<string, unknown>))
        : rawBody;
      return deliverWebhook(webhook, event, body);
    }),
  );
}
