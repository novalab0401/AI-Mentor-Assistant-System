import { DocTabs } from "@/components/DocTabs";
import { feedbackStandard } from "@/server/content";

export default function FeedbackStandardPage() {
  const { principles, checklist } = feedbackStandard;
  return (
    <>
      <DocTabs active="/lessons/feedback-standard" />
      <p className="mt-8 text-[14px] text-sub">AI가 피드백을 쓸 때 지키는 원칙 9개와, 확정 전에 모두 통과해야 하는 체크리스트 8개예요.</p>

      <div className="mt-6 grid grid-cols-[1fr_300px] gap-16">
        <ol>
          {principles.map((p) => (
            <li key={p.no} className="border-t border-line py-8">
              <h2 className="flex items-baseline gap-4 text-[17px] text-ink">
                <span className="tnum text-[15px] font-light text-ter">{p.no}</span>
                <span className="font-medium">{p.title}</span>
              </h2>
              <div className="ml-[30px]">
                <p className="mt-2 text-[14px] text-sub">{p.summary}</p>
                {p.points.length > 0 && (
                  <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-body">
                    {p.points.map((pt) => (
                      <li key={pt} className="relative pl-4 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-2 before:bg-ter">
                        {pt}
                      </li>
                    ))}
                  </ul>
                )}
                {p.example && (
                  <div className="mt-5 border-l border-brand-soft pl-4">
                    <p className="text-[12.5px] text-ter">{p.exampleLabel}</p>
                    <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-ink">{p.example}</p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>

        <aside className="sticky top-12 self-start">
          <h2 className="text-[15px] font-semibold text-ink">최종 검토 체크리스트</h2>
          <ol className="mt-4 space-y-4">
            {checklist.map((c, i) => (
              <li key={c.name} className="grid grid-cols-[22px_1fr] text-[14px]">
                <span className="tnum text-ter">{i + 1}</span>
                <div>
                  <p className="text-ink">{c.name}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-sub">{c.question}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
