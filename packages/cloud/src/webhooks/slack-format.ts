/**
 * Formats webhook payloads as Slack Block Kit messages for hooks.slack.com URLs.
 */

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text: string }>;
}

export function isSlackUrl(url: string): boolean {
  return url.includes("hooks.slack.com");
}

export function formatSlackPayload(
  event: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const status = (data.status as string) ?? "unknown";
  const passRate = data.passRate as number | null;
  const testCount = (data.testCount as number) ?? 0;
  const projectId = (data.projectId as string) ?? "—";
  const suiteId = (data.suiteId as string) ?? "—";
  const runId = (data.runId as string) ?? "—";

  const statusEmoji = status === "completed" ? ":white_check_mark:" : ":x:";
  const passRateText =
    passRate !== null && passRate !== undefined
      ? `${(passRate * 100).toFixed(1)}%`
      : "N/A";

  const headerText = `${statusEmoji} ${formatEventName(event)}`;

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: formatEventName(event),
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Status:*\n${statusEmoji} ${status}` },
        { type: "mrkdwn", text: `*Pass Rate:*\n${passRateText}` },
        { type: "mrkdwn", text: `*Tests:*\n${testCount}` },
        { type: "mrkdwn", text: `*Project:*\n${projectId}` },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Suite: ${suiteId} | Run: ${runId}`,
        },
      ],
    },
  ];

  return {
    text: headerText,
    blocks,
  };
}

function formatEventName(event: string): string {
  // "run.completed" -> "Run Completed"
  return event
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
