"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const NAV = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/lessons", label: "수업 지도안", icon: "doc" },
  { href: "/lectures", label: "표준 강의", icon: "video" },
  { href: "/practice", label: "모의수업", icon: "mic" },
  { href: "/feedback", label: "AI 피드백", icon: "spark" },
];

export type SidebarViewer = { name: string; role: "admin" | "instructor"; local?: boolean } | null;

export function Sidebar({ viewer }: { viewer: SidebarViewer }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const nav = viewer?.role === "admin" ? [...NAV, { href: "/admin/users", label: "강사 관리", icon: "users" }] : NAV;

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col bg-side px-3 py-6">
      <Link href="/" className="flex items-center gap-2.5 px-3">
        <Image src="/nova-lab-mark.svg" alt="" width={30} height={30} priority />
        <span className="text-[17px] font-semibold text-ink">Nova Lab</span>
      </Link>
      <div className="mt-8 px-3">
        <p className="text-[13px] font-medium text-ink">STEM 진로 탐험대</p>
        <p className="mt-0.5 text-[12px] text-ter">성남다함께돌봄센터 35호점</p>
      </div>
      <nav className="mt-6 flex flex-col gap-1" aria-label="주 메뉴">
        {nav.map((item) => {
          const on = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors ${
                on ? "border border-line bg-white font-medium text-ink" : "border border-transparent text-body hover:bg-white/70"
              }`}
            >
              <Icon name={item.icon} className={on ? "text-ink" : "text-ter"} />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {viewer && (
        <div className="mt-auto flex items-center gap-2 border-t border-line px-3 pt-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-ink">{viewer.name}</p>
            <p className="text-[12px] text-ter">{viewer.role === "admin" ? "운영진" : "강사"}</p>
          </div>
          {!viewer.local && (
            <form action="/api/logout" method="post">
              <button type="submit" aria-label="로그아웃" title="로그아웃" className="grid size-9 place-items-center rounded-[10px] text-ter hover:bg-white hover:text-ink">
                <Icon name="logout" size={17} />
              </button>
            </form>
          )}
        </div>
      )}
    </aside>
  );
}
