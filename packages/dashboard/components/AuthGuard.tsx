"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      setChecked(true);
      return;
    }

    const token = getToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setChecked(true);
  }, [pathname]);

  if (!checked) return null;

  return <>{children}</>;
}
