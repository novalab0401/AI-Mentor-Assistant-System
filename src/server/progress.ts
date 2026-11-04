import type { PracticeSession } from "@/lib/types";
import { lessons, rubric, scoreOf, totalScore } from "./content";
import type { Viewer } from "./auth";
import { listSessions } from "./sessions";

export type Progress = {
  sessions: PracticeSession[];
  done: PracticeSession[]; // 피드백 완료, 차시순
  nextLessonNo: number;
  latestDone?: PracticeSession;
  scoreTrend: { lessonNo: number; score: number }[];
  focus: { id: string; name: string; score: number; critical: boolean }[];
};

/** 이 사람 본인의 연습 진도. 운영진도 본인 연습 기록만 센다. */
export async function getProgress(viewer: Viewer): Promise<Progress> {
  // 예시 세션은 화면 확인용 가짜 데이터라 진도·점수·역량 계산에서 뺀다.
  const sessions = (await listSessions(viewer, "own")).filter((s) => !s.demo);
  const done = sessions.filter((s) => s.status === "done" && s.feedback).sort((a, b) => a.lessonNo - b.lessonNo);

  // 차시별 마지막 완료 세션 기준 점수
  const byLesson = new Map<number, PracticeSession>();
  for (const s of [...done].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) byLesson.set(s.lessonNo, s);
  const scoreTrend = [...byLesson.values()]
    .sort((a, b) => a.lessonNo - b.lessonNo)
    .map((s) => ({ lessonNo: s.lessonNo, score: totalScore(s.feedback!) }));

  const maxDone = Math.max(0, ...byLesson.keys());
  const nextLessonNo = Math.min(lessons.length, maxDone + 1);
  const latestDone = [...done].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  // 집중할 역량: 필수 항목 중 4점 미만을 먼저, 그다음 점수 낮은 순
  const focus = latestDone
    ? rubric
        .map((r) => ({ id: r.id, name: r.name, score: scoreOf(latestDone.feedback!, r.id), critical: r.critical }))
        .filter((f): f is { id: string; name: string; score: number; critical: boolean } => f.score !== null)
        .sort((a, b) => Number(b.critical && b.score < 4) - Number(a.critical && a.score < 4) || a.score - b.score)
        .slice(0, 3)
    : [];

  return { sessions, done, nextLessonNo, latestDone, scoreTrend, focus };
}
