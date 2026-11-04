import Link from "next/link";

const TABS = [
  { href: "/lessons", label: "차시별 지도안", count: 12 },
  { href: "/lessons/program", label: "교육 운영 제안서", count: 1 },
  { href: "/lessons/rubric", label: "공통 루브릭", count: 13 },
  { href: "/lessons/feedback-standard", label: "AI 피드백 기준", count: 9 },
];

/** titleAs="p": 화면의 주 제목(h1)이 따로 있을 때(차시 상세) 섹션 이름을 h1로 두지 않는다. */
export function DocTabs({ active, titleAs = "h1" }: { active: string; titleAs?: "h1" | "p" }) {
  const Title = titleAs;
  return (
    <>
      <Title className="text-[28px] font-semibold tracking-[-0.02em] text-ink">수업 지도안</Title>
      <nav className="mt-8 flex gap-9 border-b border-line" aria-label="문서 종류">
        {TABS.map((t) => {
          const on = t.href === active;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`-mb-px border-b-2 pb-3.5 text-[14px] ${on ? "border-ink font-medium text-ink" : "border-transparent text-sub hover:text-ink"}`}
            >
              {t.label}
              <span className="tnum ml-1.5 text-[13px] font-normal text-ter">{t.count}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
