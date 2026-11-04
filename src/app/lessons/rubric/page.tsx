import { DocTabs } from "@/components/DocTabs";
import { Icon } from "@/components/Icon";
import { rubric } from "@/server/content";

export default function RubricPage() {
  return (
    <>
      <DocTabs active="/lessons/rubric" />
      <p className="mt-8 text-[14px] text-sub">
        모든 수업에 쓰는 강사 행동 기준 13개예요. 항목마다 1점에서 5점까지 수준이 있고, 배점을 합하면 100점이에요.
      </p>
      <ol className="mt-6">
        {rubric.map((r, i) => (
          <li key={r.id} className="border-t border-line py-7">
            <details className="group" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-baseline gap-5">
                <span className="tnum w-8 text-[15px] font-light text-ter">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 text-[16px] text-ink group-hover:text-brand">
                  {r.name}
                  {r.critical && (
                    <span className="ml-2.5 inline-flex items-center gap-1 align-[-2px] text-[12.5px] font-medium text-alert">
                      <Icon name="shield" size={14} />
                      필수
                    </span>
                  )}
                </span>
                <span className="tnum text-[13.5px] text-sub">{r.weight}점</span>
              </summary>
              <ol className="ml-[52px] mt-5 space-y-3">
                {r.levels.map((lv, n) => (
                  <li key={n} className="grid grid-cols-[44px_1fr] text-[14px] leading-relaxed">
                    <span className="tnum font-medium text-brand">{n + 1}점</span>
                    <span className="text-body">{lv}</span>
                  </li>
                ))}
              </ol>
            </details>
          </li>
        ))}
      </ol>
    </>
  );
}
