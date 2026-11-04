import Link from "next/link";
import { notFound } from "next/navigation";
import { FieldIcon, Icon } from "@/components/Icon";
import { SeekButton, SessionVideo } from "@/components/SessionVideo";
import { CriterionDetail } from "@/components/CriterionDetail";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { aiConfigProblem } from "@/server/analysis/openai";
import { getLesson, rubric, scoreOf, totalScore } from "@/server/content";
import { getSession } from "@/server/sessions";
import { getUser } from "@/server/users";
import { requirePageViewer } from "@/server/viewer";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Seoul" });

export default async function FeedbackDetail(props: PageProps<"/feedback/[id]">) {
  const { id } = await props.params;
  const viewer = await requirePageViewer();
  const s = await getSession(id, viewer);
  if (!s) notFound();
  // 운영진이 다른 강사의 녹화를 볼 때 누구 것인지 보여 준다
  const owner = !s.demo && s.ownerId !== viewer.id ? ((s.ownerId && (await getUser(s.ownerId))?.name) ?? "알 수 없음") : null;
  const lesson = getLesson(s.lessonNo)!;
  const fb = s.feedback;
  const hasVideo = !s.demo;

  // 항목별 근거: 고칠 것이 먼저 오게 정렬하고, 목표에 못 미친 항목만 펼친다.
  const rank = (id: string, critical: boolean) => {
    const sc = fb ? scoreOf(fb, id) : null;
    if (sc === null) return 100; // 판단 불가는 맨 뒤
    return (critical && sc < 4 ? 0 : 10) + sc;
  };
  const ordered = [...rubric].sort((a, b) => rank(a.id, a.critical) - rank(b.id, b.critical));
  const needsWork = (id: string, critical: boolean) => {
    const sc = fb ? scoreOf(fb, id) : null;
    return sc !== null && (sc <= 3 || (critical && sc < 4));
  };

  return (
    <article>
      <Link href="/feedback" className="inline-flex items-center gap-1.5 text-[13px] text-sub hover:text-ink">
        <Icon name="back" size={15} />
        AI 피드백
      </Link>
      <header className="mt-6 flex items-end justify-between gap-8">
        <div>
          <p className="flex items-center gap-2 text-[13px] text-sub">
            <FieldIcon field={lesson.field} size={16} className="text-brand" />
            {lesson.no}차시 모의수업 <span className="ml-2 text-ter">{dateFmt.format(new Date(s.createdAt))}</span>
            {s.demo && <span className="ml-2 text-ter">예시 데이터</span>}
            {owner && <span className="ml-2 text-ter">{owner} 강사</span>}
          </p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink">{lesson.title}</h1>
        </div>
        {fb && (
          <p className="tnum text-[48px] font-medium leading-none tracking-[-0.04em] text-ink">
            {totalScore(fb)}
            <span className="ml-1.5 text-[15px] font-normal tracking-normal text-ter">/ 100</span>
          </p>
        )}
      </header>

      {fb && (
        <div className="mt-6 flex items-start gap-3 border-y border-line py-4 text-[13.5px] leading-relaxed">
          <Icon name="spark" size={17} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-body">
            <span className="font-medium text-ink">AI 평가 · 참고용</span>
            <span className="mx-2 text-ter">|</span>
            {fb.review.status === "reviewed" ? `${fb.review.notes ? "AI 자체 검토" : "검토"} 체크리스트 ${fb.review.checklistPassed}/8 통과` : "검토 전"}
            <span className="mx-2 text-ter">|</span>
            {fb.basis}
          </p>
        </div>
      )}

      <div className="mt-10 grid grid-cols-[1fr_380px] gap-14">
        <div>
          {hasVideo ? (
            <SessionVideo src={`/api/sessions/${s.id}/media`} />
          ) : (
            <div className="grid aspect-video place-items-center rounded-2xl bg-side text-center">
              <div>
                <Icon name="video" size={28} className="mx-auto text-ter" />
                <p className="mt-3 text-[14px] text-sub">예시 세션이라 녹화 영상이 없어요.</p>
              </div>
            </div>
          )}

          {!s.demo && s.status !== "done" && (
            <AnalysisPanel
              sessionId={s.id}
              lessonNo={lesson.no}
              status={s.status}
              stage={s.analysis?.stage}
              error={s.analysis?.error}
              configProblem={aiConfigProblem()}
            />
          )}

          {fb && (
            <section className="mt-10 space-y-10">
              <div>
                <h2 className="flex items-center gap-2 text-[14px] font-medium text-ink"><Icon name="circleCheck" size={17} className="text-brand" />잘한 점</h2>
                {fb.strengths.map((x, i) => (
                  <div key={i} className="mt-4 grid grid-cols-[56px_1fr] border-b border-line pb-6">
                    <SeekButton time={x.time} enabled={hasVideo} />
                    <div>
                      {x.quote && <p className="text-[19px] text-ink">“{x.quote}”</p>}
                      <p className={`${x.quote ? "mt-2 text-[14px] text-body" : "text-[16px] text-ink"} leading-relaxed`}>{x.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h2 className="flex items-center gap-2 text-[14px] font-medium text-ink"><Icon name="trend" size={17} className="text-brand" />바꿔 볼 점</h2>
                {fb.improvements.map((x, i) => (
                  <div key={i} className="mt-4 grid grid-cols-[56px_1fr] border-b border-line pb-6">
                    <SeekButton time={x.time} enabled={hasVideo} />
                    <div>
                      <p className="text-[16px] leading-relaxed text-ink">{x.text}</p>
                      <p className="mt-3 border-l border-brand-soft pl-3.5 text-[14px] leading-relaxed text-body">{x.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h2 className="flex items-center gap-2 text-[14px] font-medium text-ink"><Icon name="target" size={17} className="text-brand" />다음 수업을 위해</h2>
                <p className="mt-3 text-[16px] leading-relaxed text-ink">{fb.closing}</p>
              </div>
            </section>
          )}

          {fb && (
            <section className="mt-16">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">항목별 근거</h2>
              <p className="mb-5 mt-2 text-[14px] text-sub">
                고칠 항목부터 보여 줘요. 시각을 누르면 그 장면으로 이동하고, 근거가 부족한 항목은 점수를 매기지 않았어요.
              </p>
              {ordered.map((r) => {
                const result = fb.criteria[r.id];
                if (!result) return null;
                return <CriterionDetail key={r.id} item={r} result={result} open={needsWork(r.id, r.critical)} seekable={hasVideo} />;
              })}
            </section>
          )}
        </div>

        <aside className="sticky top-12 self-start">
          <h2 className="text-[15px] font-semibold text-ink">공통 루브릭</h2>
          {fb ? (
            <ul className="mt-5 space-y-4">
              {rubric.map((r) => {
                const sc = scoreOf(fb, r.id);
                const warn = r.critical && sc !== null && sc < 4;
                return (
                  <li key={r.id}>
                    <a href={`#${r.id}`} className="group block">
                      <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                        <span className="text-ink group-hover:text-brand">
                          {r.name}
                          {r.critical && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 align-[-2px] text-[12px] font-medium text-alert">
                              <Icon name="shield" size={13} />
                              필수
                            </span>
                          )}
                        </span>
                        <span className="tnum shrink-0 text-sub">{sc === null ? "판단 불가" : `${sc} / 5`}</span>
                      </div>
                      <div className="mt-2 h-[3px] rounded-full bg-line">
                        {sc !== null && <div className={`h-full rounded-full ${warn ? "bg-alert" : "bg-brand"}`} style={{ width: `${sc * 20}%` }} />}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-[14px] text-sub">분석이 끝나면 13개 항목 점수가 나와요.</p>
          )}
          <Link href="/lessons/rubric" className="mt-8 inline-block text-[13px] text-sub hover:text-ink">
            루브릭 기준 자세히 보기
          </Link>
        </aside>
      </div>
    </article>
  );
}
