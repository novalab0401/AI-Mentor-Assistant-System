import Link from "next/link";
import { FieldIcon, Icon } from "@/components/Icon";
import { StageBar } from "@/components/StageBar";
import { getLesson, lessons } from "@/server/content";
import { getProgress } from "@/server/progress";
import { requirePageViewer } from "@/server/viewer";

export default async function Home() {
  const p = await getProgress(await requirePageViewer());
  const next = getLesson(p.nextLessonNo)!;
  const nextSession = p.sessions.find((s) => s.lessonNo === next.no);
  const steps = [
    { label: "지도안 읽기", state: "done" as const },
    { label: "모의수업 녹화", state: nextSession ? ("done" as const) : ("now" as const) },
    { label: "AI 피드백 확인", state: nextSession?.status === "done" ? ("done" as const) : nextSession ? ("now" as const) : ("todo" as const) },
  ];
  const latest = p.latestDone;
  const latestLesson = latest ? getLesson(latest.lessonNo) : undefined;
  const trend = p.scoreTrend;
  const last = trend.at(-1);
  const prev = trend.at(-2);

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">안녕하세요, 강사님</h1>

      {/* 다음 수업: 화면에서 유일하게 강조하는 영역 */}
      <section className="mt-8 grid grid-cols-[1fr_320px] rounded-[20px] bg-brand px-10 py-10 text-white">
        <div>
          <p className="text-[13px] text-brand-soft">
            다음 수업 <span className="ml-2 font-medium text-white">{next.no}차시</span>
          </p>
          <h2 className="mt-3 text-[32px] font-medium leading-tight tracking-[-0.02em]">{next.title}</h2>
          <p className="mt-3 flex items-center gap-2 text-[14px] text-brand-soft">
            <FieldIcon field={next.field} size={17} className="text-white" />
            {next.field}
            <span className="text-white/40">|</span>
            <Icon name="clock" size={16} className="text-white" />
            {next.durationMinutes}분
          </p>
          <div className="mt-6 max-w-[440px]">
            <StageBar steps={next.steps} tone="dark" />
          </div>
          <div className="mt-7 flex items-center gap-7">
            <Link
              href={`/practice/${next.no}`}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-white px-5 text-[14px] font-medium text-brand transition-colors hover:bg-tint"
            >
              <Icon name="mic" size={16} strokeWidth={1.9} />
              모의수업 녹화하기
            </Link>
            <Link href={`/lessons/${next.no}`} className="text-[14px] font-medium text-white hover:underline">
              지도안 보기
            </Link>
          </div>
        </div>
        <ol className="border-l border-white/15 pl-12">
          {steps.map((s, i) => (
            <li key={s.label} className="relative flex items-center gap-4 pb-8 last:pb-0">
              {i < steps.length - 1 && <span className="absolute left-[11.5px] top-7 h-7 w-px bg-white/25" />}
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full ${
                  s.state === "done" ? "bg-white text-brand" : s.state === "now" ? "border-[1.5px] border-white" : "border-[1.5px] border-white/35"
                }`}
              >
                {s.state === "done" && <Icon name="check" size={14} strokeWidth={2.6} />}
                {s.state === "now" && <span className="size-2 rounded-full bg-white" />}
              </span>
              <span className={`text-[15px] ${s.state === "todo" ? "text-brand-soft" : "font-medium"}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-14 grid grid-cols-[1fr_352px] gap-20">
        {/* 최근 AI 피드백 */}
        <section>
          <header className="flex items-baseline justify-between border-b border-line pb-4">
            <h2 className="text-[18px] font-semibold text-ink">최근 AI 피드백</h2>
            <Link href="/feedback" className="text-[13px] text-sub hover:text-ink">
              전체 보기
            </Link>
          </header>
          {latest && latestLesson ? (
            <Link href={`/feedback/${latest.id}`} className="group block">
              <p className="mt-5 text-[13px] text-ter">
                {latestLesson.no}차시 {latestLesson.title}
              </p>
              {latest.feedback!.strengths.slice(0, 1).map((s) => (
                <div key={s.time} className="mt-4 grid grid-cols-[56px_1fr] border-b border-line pb-6">
                  <span className="tnum pt-0.5 text-[13px] text-ter">{s.time}</span>
                  <div>
                    <p className="flex items-center gap-1.5 text-[13px] text-sub">
                      <Icon name="circleCheck" size={15} className="text-brand" />
                      잘한 점
                    </p>
                    <p className="mt-1.5 text-[19px] text-ink group-hover:text-brand">{s.quote ? `“${s.quote}”` : s.text}</p>
                  </div>
                </div>
              ))}
              {latest.feedback!.improvements.slice(0, 1).map((s) => (
                <div key={s.time} className="mt-6 grid grid-cols-[56px_1fr]">
                  <span className="tnum pt-0.5 text-[13px] text-ter">{s.time}</span>
                  <div>
                    <p className="flex items-center gap-1.5 text-[13px] text-sub">
                      <Icon name="trend" size={15} className="text-brand" />
                      바꿔 볼 점
                    </p>
                    <p className="mt-1.5 text-[19px] text-ink group-hover:text-brand">{s.text}</p>
                  </div>
                </div>
              ))}
            </Link>
          ) : (
            <div className="mt-6">
              <p className="text-[15px] text-sub">모의수업을 녹화하면 여기에 피드백이 나와요.</p>
              <Link href="/feedback/demo-3" className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-medium text-brand hover:underline">
                예시 피드백 미리 보기
                <Icon name="arrow" size={15} />
              </Link>
            </div>
          )}

          <div className="mt-14">
            <h2 className="text-[15px] font-semibold text-ink">12차시 진행</h2>
            <ol className="mt-4 grid grid-cols-12 gap-1.5">
              {lessons.map((l) => {
                const isDone = trend.some((t) => t.lessonNo === l.no);
                const isNext = l.no === next.no;
                return (
                  <li key={l.no}>
                    <Link href={`/lessons/${l.no}`} className="block" title={l.title}>
                      <span className={`block h-1 rounded-full ${isDone ? "bg-brand" : isNext ? "bg-brand-soft" : "bg-line"}`} />
                      <span className={`tnum mt-2 block text-[12px] ${isNext ? "font-medium text-ink" : isDone ? "text-sub" : "text-ter"}`}>{l.no}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* 점수와 역량 */}
        <section>
          <header className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-semibold text-ink">공통 루브릭 점수</h2>
            <Link href="/lessons/rubric" className="text-[13px] text-sub hover:text-ink">
              기준 보기
            </Link>
          </header>
          {last ? (
            <>
              <div className="mt-6 flex items-end justify-between">
                <p className="tnum text-[64px] font-medium leading-none tracking-[-0.04em] text-ink">
                  {last.score}
                  <span className="ml-2 text-[16px] font-normal tracking-normal text-ter">/ 100</span>
                </p>
                {prev && (
                  <p className="tnum pb-2 text-[15px] font-medium text-brand">
                    {last.score - prev.score >= 0 ? "+" : ""}
                    {last.score - prev.score}
                  </p>
                )}
              </div>
              <Sparkline points={trend} />
            </>
          ) : (
            <p className="mt-6 text-[15px] text-sub">첫 모의수업 피드백이 나오면 13개 기준 점수가 여기에 쌓여요.</p>
          )}

          {p.focus.length > 0 && (
            <div className="mt-10">
              <h3 className="text-[15px] font-semibold text-ink">집중할 역량</h3>
              <ul className="mt-5 space-y-6">
                {p.focus.map((f) => (
                  <li key={f.id}>
                    <div className="flex items-baseline justify-between gap-4 text-[14px]">
                      <span className="text-ink">
                        {f.name}
                        {f.critical && (
                          <span className="ml-2 inline-flex items-center gap-1 align-[-2px] text-[12.5px] font-medium text-alert">
                            <Icon name="shield" size={14} />
                            필수
                          </span>
                        )}
                      </span>
                      <span className="tnum shrink-0 font-medium text-ink">{f.score} / 5</span>
                    </div>
                    <div className="mt-2.5 h-[3px] rounded-full bg-line">
                      <div className={`h-full rounded-full ${f.critical && f.score < 4 ? "bg-alert" : "bg-brand"}`} style={{ width: `${f.score * 20}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Sparkline({ points }: { points: { lessonNo: number; score: number }[] }) {
  const w = 352;
  const h = 56;
  const min = Math.min(...points.map((p) => p.score)) - 4;
  const max = Math.max(...points.map((p) => p.score)) + 4;
  const xy = points.map((p, i) => [points.length === 1 ? w / 2 : 6 + (i * (w - 12)) / (points.length - 1), h - ((p.score - min) / (max - min)) * h]);
  return (
    <figure className="mt-6">
      <svg viewBox={`0 0 ${w} ${h + 8}`} className="w-full overflow-visible" role="img" aria-label="차시별 루브릭 점수 추이">
        <line x1="0" x2={w} y1={h + 8} y2={h + 8} stroke="var(--color-line)" />
        <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--color-brand)" strokeWidth="1.8" strokeLinejoin="round" />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === xy.length - 1 ? 4.5 : 3} fill={i === xy.length - 1 ? "#fff" : "var(--color-brand)"} stroke="var(--color-brand)" strokeWidth={i === xy.length - 1 ? 1.8 : 0} />
        ))}
      </svg>
      <figcaption className="tnum mt-3 flex justify-between text-[12px] text-ter">
        {points.map((p) => (
          <span key={p.lessonNo}>
            {p.lessonNo}차시 {p.score}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
