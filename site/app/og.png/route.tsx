import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafaf9",
          fontFamily: "system-ui",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            maxWidth: 800,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#6366f1",
              marginBottom: 16,
            }}
          >
            Testing for AI agents
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "#0c0a09",
              textAlign: "center",
              letterSpacing: "-0.035em",
              lineHeight: 1.15,
            }}
          >
            Know what your agent will do before your users do
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 18,
              color: "#57534e",
              textAlign: "center",
            }}
          >
            Tool call assertions · LLM-as-judge · Drift detection · Compliance
          </div>
          <div
            style={{
              marginTop: 32,
              background: "#1c1917",
              borderRadius: 10,
              padding: "12px 24px",
              color: "#d6d3d1",
              fontSize: 16,
            }}
          >
            npm i -g @kindlm/cli
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 14,
              color: "#a8a29e",
            }}
          >
            kindlm.com · Open source · MIT
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
