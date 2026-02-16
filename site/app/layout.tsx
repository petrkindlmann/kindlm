import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KindLM — Testing for AI agents",
    template: "%s | KindLM",
  },
  description:
    "Regression tests for agentic workflows — tool calls, output quality, and compliance. Defined in YAML, run in CI. Open source.",
  keywords: [
    "AI testing",
    "LLM testing",
    "agent testing",
    "tool call assertions",
    "AI compliance",
    "EU AI Act",
    "prompt regression",
    "LLM evaluation",
  ],
  authors: [{ name: "Petr Kindlmann" }],
  creator: "Petr Kindlmann",
  metadataBase: new URL("https://kindlm.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://kindlm.com",
    siteName: "KindLM",
    title: "KindLM — Testing for AI agents",
    description:
      "Regression tests for agentic workflows — tool calls, output quality, and compliance. Defined in YAML, run in CI.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "KindLM — Testing for AI agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KindLM — Testing for AI agents",
    description:
      "Regression tests for agentic workflows. Defined in YAML, run in CI. Open source.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
