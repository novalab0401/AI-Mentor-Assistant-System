import Link from "next/link";
import { FieldIcon, Icon } from "./Icon";
import type { Lesson } from "@/lib/types";

/** 지도안 화면 왼쪽의 차시 목록. 분야별로 묶고, 지금 보는 차시·다음 수업·피드백 완료를 표시한다. */
export function LessonRail({ lessons, current, nextNo, done }: { lessons: Lesson[]; current: number; nextNo: number; done: number[] }) {
  const groups: { field: string; items: Lesson[] }[] = [];
  for (const l of lessons) {
    const g = groups.at(-1);
    if (g && g.field === l.field) g.items.push(l);
    else groups.push({ field: l.field, items: [l] });
  }

  return (
    <nav aria-label="차시 목록" className="sticky top-8 max-h-[calc(100vh-4rem)] self-start overflow-y-auto pb-4 pr-1">
      {groups.map((g) => (
        <section key={g.field} className="mb-4 last:mb-0">
          <h2 className="flex items-center gap-2 px-3 pb-1.5 text-[12.5px] text-sub">
            <FieldIcon field={g.field} size={14} className="text-ter" />
            {g.field}
          </h2>
          <ol>
            {g.items.map((l) => {
              const on = l.no === current;
              return (
                <li key={l.no}>
                  <Link
                    href={`/lessons/${l.no}`}
                    aria-current={on ? "page" : undefined}
                    scroll={false}
                    className={`grid grid-cols-[28px_1fr_16px] items-start gap-1 rounded-lg px-3 py-2 text-[13.5px] leading-snug transition-colors ${
                      on ? "bg-tint text-brand" : "text-body hover:bg-side"
                    }`}
                  >
                    <span className={`tnum pt-px ${on ? "text-brand" : "text-ter"}`}>{String(l.no).padStart(2, "0")}</span>
                    <span className={on ? "font-medium" : ""}>
                      {l.title}
                      {l.no === nextNo && <span className="ml-1.5 whitespace-nowrap text-[12px] font-medium text-brand">다음 수업</span>}
                    </span>
                    {done.includes(l.no) && <Icon name="circleCheck" size={15} className="mt-0.5 text-brand" />}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <p className="mt-4 px-3 text-[12px] text-ter">← → 키로 차시를 넘길 수 있어요</p>
    </nav>
  );
}
