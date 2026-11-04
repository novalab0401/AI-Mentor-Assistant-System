import Link from "next/link";
import { DocTabs } from "@/components/DocTabs";
import { program } from "@/server/content";

export default function ProgramPage() {
  const facts = [
    ["대상", program.target],
    ["운영", `${program.schedule}, ${program.sessions}`],
    ["강의실", program.room],
    ["학생 준비물", program.studentPrep],
  ];
  return (
    <>
      <DocTabs active="/lessons/program" />
      <div className="mt-10 grid grid-cols-[1fr_320px] gap-16">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{program.name}</h2>
          <p className="mt-4 max-w-[640px] text-[15px] leading-[1.8] text-body">{program.intro}</p>

          <h3 className="mt-12 text-[15px] font-semibold text-ink">프로그램 목표</h3>
          <ol className="mt-4 space-y-2.5 text-[15px] text-ink">
            {program.goals.map((g, i) => (
              <li key={g} className="grid grid-cols-[24px_1fr]">
                <span className="tnum text-ter">{i + 1}</span>
                {g}
              </li>
            ))}
          </ol>

          <h3 className="mt-12 text-[15px] font-semibold text-ink">차시 구성</h3>
          <ol className="mt-3">
            {program.curriculum.map((c) => (
              <li key={c.no} className="grid grid-cols-[48px_1fr] border-b border-line py-5">
                <span className="tnum text-[15px] font-light text-ter">{String(c.no).padStart(2, "0")}</span>
                <div>
                  <p className="text-[13px] text-ter">{c.theme}</p>
                  <Link href={`/lessons/${c.no}`} className="mt-1 block text-[15px] text-ink hover:text-brand">
                    {c.title}
                  </Link>
                  <p className="mt-2 max-w-[600px] text-[14px] leading-relaxed text-sub">{c.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className="space-y-10">
          <dl className="space-y-5 text-[14px]">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[12.5px] text-ter">{k}</dt>
                <dd className="mt-1 leading-relaxed text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="text-[12.5px] text-ter">강의 방법</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-body">{program.method}</p>
          </div>
          <div>
            <h3 className="text-[12.5px] text-ter">평가 방법</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-body">{program.evaluation}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
