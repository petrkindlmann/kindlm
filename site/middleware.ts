import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";

  // Rewrite docs.kindlm.com/* → /docs/*
  if (hostname.startsWith("docs.")) {
    const url = request.nextUrl.clone();
    const path = url.pathname;

    // docs.kindlm.com/ → /docs
    if (path === "/") {
      url.pathname = "/docs";
      return NextResponse.rewrite(url);
    }

    // docs.kindlm.com/foo → /docs/foo (unless already under /docs)
    if (!path.startsWith("/docs")) {
      url.pathname = `/docs${path}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
