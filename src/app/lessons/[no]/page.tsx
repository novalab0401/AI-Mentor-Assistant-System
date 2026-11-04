import Link from "next/link";
import { notFound } from "next/navigation";
import { DocTabs } from "@/components/DocTabs";
import { FieldIcon, Icon } from "@/components/Icon";
import { LessonKeys } from "@/components/LessonKeys";
import { LessonRail } from "@/components/LessonRail";
import { StageBar } from "@/components/StageBar";
import { getLesson, lessons } from "@/server/content";
import { getProgress } from "@/server/progress";
import { requirePageViewer } from "@/server/viewer";

export default async function LessonDetail(props: PageProps<"/lessons/[no]">) {
  const { no } = await props.params;
  const lesson = getLesson(Number(no));
  if (!lesson) notFound();
  const p = await getProgress(await requirePageViewer());
  const prev = getLesson(lesson.no - 1);
  const next = getLesson(lesson.no + 1);

  // 단계(도입·전개·정리)별로 묶는다
  const stages: { name: string; minutes: number | null; items: typeof lesson.steps }[] = [];
  for (const s of lesson.steps) {
    const last = stages.at(-1);
    if (last && last.name === s.stage) last.items.push(s);
    else stages.push({ name: s.stage, minutes: s.stageMinutes, items: [s] });
  }

  return (
    <>
      <DocTabs active="/lessons" titleAs="p" />
      <LessonKeys total={lessons.length} />
      <div className="mt-8 grid grid-cols-[248px_1fr] gap-12">
        <LessonRail lessons={lessons} current={lesson.no} nextNo={p.nextLessonNo} done={p.scoreTrend.map((t) => t.lessonNo)} />
        <article className="min-w-0">
          <header className="flex items-end justify-between gap-8">
            <div>
              <p className="flex items-center gap-2 text-[13px] text-sub">
                <FieldIcon field={lesson.field} size={16} className="text-brand" />
                {lesson.no}차시 <span className="text-ter">{lesson.unit}</span>
              </p>
              <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink">{lesson.title}</h1>
            </div>
            <Link
              href={`/practice/${lesson.no}`}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] bg-brand px-4 text-[13.5px] font-medium text-white hover:bg-brand-dark"
            >
              <Icon name="mic" size={16} />이 차시로 모의수업
            </Link>
          </header>

          <dl className="mt-8 grid grid-cols-[120px_1fr] gap-y-5 border-y border-line py-7 text-[14px]">
            <dt className="flex items-center gap-2 self-start text-sub">
              <Icon name="target" size={16} className="text-ter" />
              학습 목표
            </dt>
            <dd>
              <ol className="space-y-2 text-ink">
                {lesson.goals.map((g, i) => (
                  <li key={g} className="grid grid-cols-[20px_1fr]">
                    <span className="tnum text-ter">{i + 1}</span>
                    {g}
                  </li>
                ))}
              </ol>
            </dd>
            <dt className="flex items-center gap-2 self-start text-sub">
              <Icon name="layers" size={16} className="text-ter" />
              수업 형태
            </dt>
            <dd className="text-ink">{lesson.method}</dd>
            <dt className="flex items-center gap-2 self-start text-sub">
              <Icon name="users" size={16} className="text-ter" />
              대상
            </dt>
            <dd className="text-ink">{lesson.target}</dd>
            <dt className="flex items-center gap-2 self-start text-sub">
              <Icon name="box" size={16} className="text-ter" />
              준비 자료
            </dt>
            <dd className="text-ink">
              {lesson.materials.teacher}
              {lesson.materials.student && <p className="mt-1 text-sub">학생: {lesson.materials.student}</p>}
            </dd>
          </dl>

          <h2 className="mt-14 text-[18px] font-semibold text-ink">수업 흐름</h2>
          <div className="mt-5">
            <StageBar steps={lesson.steps} detail />
          </div>
          <div className="mt-10 space-y-12">
            {stages.map((st) => (
              <section key={st.name}>
                <h3 className="flex items-baseline gap-2 border-b border-ink pb-3 text-[15px] font-semibold text-ink">
                  {st.name}
                  {st.minutes && <span className="tnum text-[13px] font-normal text-ter">{st.minutes}분</span>}
                </h3>
                <div className="grid grid-cols-[160px_1fr_1fr_200px] gap-x-8 border-b border-line py-2.5 text-[12px] text-ter">
                  <span className="flex items-center gap-1.5">
                    <Icon name="clock" size={14} />
                    학습 내용
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="user" size={14} />
                    강사 활동
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="users" size={14} />
                    학생 활동
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="box" size={14} />
                    준비물과 유의점
                  </span>
                </div>
                {st.items.map((s) => (
                  <div key={s.topic} className="grid grid-cols-[160px_1fr_1fr_200px] gap-x-8 border-b border-line py-5 text-[14px] leading-relaxed">
                    <div>
                      <p className="text-ink">{s.topic}</p>
                      {s.minutes && <p className="tnum mt-0.5 text-[12.5px] text-ter">{s.minutes}분</p>}
                    </div>
                    <ul className="space-y-1.5 text-ink">
                      {s.teacher.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    <ul className="space-y-1.5 text-body">
                      {s.student.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    <div className="text-[13px] text-sub">
                      {s.materials && <p className="text-body">{s.materials}</p>}
                      {s.notes.map((n) => (
                        <p key={n} className="mt-1.5">
                          {n}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>

          <nav aria-label="이전·다음 차시" className="mt-14 grid grid-cols-2 gap-4 border-t border-line pt-6">
            {prev ? (
              <Link href={`/lessons/${prev.no}`} scroll={false} className="group">
                <span className="flex items-center gap-1.5 text-[12.5px] text-sub">
                  <Icon name="back" size={14} />
                  이전 차시
                </span>
                <span className="mt-1 block text-[15px] text-ink group-hover:text-brand">
                  {prev.no}차시 {prev.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={`/lessons/${next.no}`} scroll={false} className="group text-right">
                <span className="flex items-center justify-end gap-1.5 text-[12.5px] text-sub">
                  다음 차시
                  <Icon name="arrow" size={14} />
                </span>
                <span className="mt-1 block text-[15px] text-ink group-hover:text-brand">
                  {next.no}차시 {next.title}
                </span>
              </Link>
            )}
          </nav>
        </article>
      </div>
    </>
  );
}
