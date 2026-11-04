import { Icon } from "./Icon";
import { SeekButton } from "./SessionVideo";
import type { CriterionResult, RubricItem } from "@/lib/types";

/** 루브릭 한 항목의 근거 블록: 지금 수준, 다음 목표, 이유, 실제 발언, 지도안 대조, 해 볼 것. */
export function CriterionDetail({ item, result, open, seekable }: { item: RubricItem; result: CriterionResult; open: boolean; seekable: boolean }) {
  const sc = result.score;
  const warn = item.critical && sc !== null && sc < 4;
  return (
    <details id={item.id} open={open} className="group scroll-mt-8 border-t border-line">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-5">
        <span className="flex-1 text-[16px] text-ink group-hover:text-brand">
          {item.name}
          {item.critical && (
            <span className="ml-2 inline-flex items-center gap-1 align-[-2px] text-[12.5px] font-medium text-alert">
              <Icon name="shield" size={14} />
              필수
            </span>
          )}
        </span>
        {sc === null ? (
          <span className="text-[14px] text-sub">판단 불가</span>
        ) : (
          <span className={`tnum text-[15px] font-medium ${warn ? "text-alert" : "text-ink"}`}>
            {sc}
            <span className="font-normal text-ter"> / 5</span>
          </span>
        )}
        <Icon name="chevron" size={16} className="text-ter transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-5 pb-8 pl-0.5">
        {sc !== null && (
          <dl className="grid grid-cols-[108px_1fr] gap-x-4 gap-y-2.5 text-[14px] leading-relaxed">
            <dt className="text-sub">지금 ({sc}점)</dt>
            <dd className="text-body">{item.levels[sc - 1]}</dd>
            {sc < 5 && (
              <>
                <dt className="font-medium text-brand">다음 목표 ({sc + 1}점)</dt>
                <dd className="text-ink">{item.levels[sc]}</dd>
              </>
            )}
          </dl>
        )}

        <p className="max-w-[640px] text-[14.5px] leading-[1.8] text-ink">{result.reason}</p>

        {result.evidence.length > 0 && (
          <ul className="space-y-2">
            {result.evidence.map((e) => (
              <li key={e.time + e.quote} className="grid grid-cols-[52px_1fr] text-[14px] leading-relaxed">
                <SeekButton time={e.time} enabled={seekable} />
                <q className="text-body before:content-['“'] after:content-['”']">{e.quote}</q>
              </li>
            ))}
          </ul>
        )}

        {result.planCheck && (
          <div className="rounded-xl border border-line px-5 py-4 text-[14px] leading-relaxed">
            <p className="flex items-center gap-1.5 text-[12.5px] text-sub">
              <Icon name="doc" size={14} />
              지도안 대조 · {result.planCheck.step}
            </p>
            <dl className="mt-2.5 grid grid-cols-[52px_1fr] gap-y-1.5">
              <dt className="text-ter">계획</dt>
              <dd className="text-body">{result.planCheck.planned}</dd>
              <dt className="text-ter">실제</dt>
              <dd className="text-ink">{result.planCheck.observed}</dd>
            </dl>
          </div>
        )}

        <div className="flex gap-3 text-[14.5px] leading-[1.75]">
          <Icon name="target" size={17} className="mt-[3px] shrink-0 text-brand" />
          <p>
            <span className="font-medium text-ink">다음 수업에서 해 볼 것 </span>
            <span className="text-ink">{result.nextAction}</span>
          </p>
        </div>
      </div>
    </details>
  );
}
