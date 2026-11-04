import type { PracticeSession } from "@/lib/types";
import Link from "next/link";
import { getLesson, totalScore } from "@/server/content";
import { listSessions } from "@/server/sessions";
import { listUsers } from "@/server/users";
import { requirePageViewer } from "@/server/viewer";

const STATUS_LABEL: Record<PracticeSession["status"], string> = { saved: "분석 전", analyzing: "분석 중", failed: "분석 실패", done: "" };

const dateFmt = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" });

export default async function FeedbackList() {
  const viewer = await requirePageViewer();
  const sessions = await listSessions(viewer);
  // 운영진은 모든 강사의 녹화를 보므로 누가 올렸는지 함께 보여 준다
  const isAdmin = viewer.role === "admin";
  const names = isAdmin ? new Map((await listUsers()).map((u) => [u.id, u.name])) : null;
  const ownerName = (id?: string) => (id === viewer.id ? "나" : (id && names?.get(id)) || "알 수 없음");
  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">AI 피드백</h1>
      <p className="mt-2 text-[14px] text-sub">
        {isAdmin ? "모든 강사의 모의수업 녹화와 피드백이에요." : "모의수업 녹화마다 공통 루브릭 점수와 피드백이 쌓여요."}
      </p>

      {sessions.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-[15px] text-ink">아직 녹화한 모의수업이 없어요.</p>
          <Link href="/practice" className="mt-4 inline-block text-[14px] font-medium text-brand hover:underline">
            모의수업 녹화하러 가기
          </Link>
        </div>
      ) : (
        <table className="mt-8 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[12.5px] text-ter">
              <th className="py-3 font-medium">수업</th>
              {isAdmin && <th className="w-[140px] py-3 font-medium">강사</th>}
              <th className="w-[160px] py-3 font-medium">녹화일</th>
              <th className="w-[100px] py-3 font-medium">길이</th>
              <th className="w-[120px] py-3 text-right font-medium">점수</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const l = getLesson(s.lessonNo);
              return (
                <tr key={s.id} className="group border-b border-line">
                  <td className="py-4">
                    <Link href={`/feedback/${s.id}`} className="text-[15px] text-ink group-hover:text-brand">
                      <span className="tnum mr-3 text-ter">{s.lessonNo}차시</span>
                      {l?.title}
                    </Link>
                    {s.demo && <span className="ml-3 text-[12.5px] text-ter">예시</span>}
                  </td>
                  {isAdmin && <td className="py-4 text-[13.5px] text-body">{s.demo ? "-" : ownerName(s.ownerId)}</td>}
                  <td className="py-4 text-[13.5px] text-body">{dateFmt.format(new Date(s.createdAt))}</td>
                  <td className="tnum py-4 text-[13.5px] text-body">{Math.round(s.durationSec / 60)}분</td>
                  <td className="tnum py-4 text-right text-[15px]">
                    {s.status === "done" && s.feedback ? <span className="font-medium text-ink">{totalScore(s.feedback)}</span> : <span className={`text-[13.5px] ${s.status === "failed" ? "text-alert" : "text-sub"}`}>{STATUS_LABEL[s.status]}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
