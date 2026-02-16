"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  slug: string;
  title: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function DocsSidebar({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed bottom-5 right-5 z-50 bg-stone-900 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg"
        aria-label="Toggle docs navigation"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? (
            <path d="M5 5l10 10M15 5L5 15" />
          ) : (
            <path d="M3 5h14M3 10h14M3 15h14" />
          )}
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-40
          w-64 h-screen overflow-y-auto
          bg-stone-50 border-r border-stone-200
          pt-16 pb-8 px-4
          transition-transform duration-200 ease-out
          lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="pt-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-3 mb-2">
                {group.label}
              </p>
              {group.items.map((item) => {
                const href = `/docs/${item.slug}`;
                const active = pathname === href;
                return (
                  <Link
                    key={item.slug}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`docs-nav-link ${active ? "active" : ""}`}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-8 pt-4 border-t border-stone-200 px-3">
          <a
            href="https://github.com/kindlm/kindlm"
            target="_blank"
            rel="noopener"
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            GitHub ↗
          </a>
        </div>
      </aside>
    </>
  );
}
