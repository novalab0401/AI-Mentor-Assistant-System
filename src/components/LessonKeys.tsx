"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ←/→ 키로 이전·다음 차시로 넘긴다. 입력 칸에 있거나 수정 키를 누른 경우는 무시한다.
 * 이동할 차시는 누른 순간의 주소에서 계산한다. 새 화면이 그려지기 전에 키를 연달아 눌러도
 * 이전 화면 기준으로 계산하지 않게 하려는 것이다.
 */
export function LessonKeys({ total }: { total: number }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      if (!step) return;
      const m = /^\/lessons\/(\d+)$/.exec(window.location.pathname);
      if (!m) return;
      const to = Number(m[1]) + step;
      if (to < 1 || to > total) return;
      e.preventDefault();
      router.push(`/lessons/${to}`, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, router]);
  return null;
}
