// 원본 문서에서 추출한 수업 자료(content/*.json)를 읽는다.
// 원본이 바뀌면 `python scripts/extract_content.py`로 다시 만든다.
import lessonsJson from "../../content/lessons.json";
import rubricJson from "../../content/rubric.json";
import standardJson from "../../content/feedback-standard.json";
import programJson from "../../content/program.json";
import type { Feedback, FeedbackStandard, Lesson, Program, RubricItem } from "@/lib/types";

export const lessons = lessonsJson as Lesson[];
export const rubric = rubricJson as RubricItem[];
export const feedbackStandard = standardJson as FeedbackStandard;
export const program = programJson as Program;

export function getLesson(no: number): Lesson | undefined {
  return lessons.find((l) => l.no === no);
}

export function scoreOf(fb: Feedback, id: string): number | null {
  return fb.criteria[id]?.score ?? null;
}

/**
 * 루브릭 1~5점을 100점 기준 총점으로 바꾼다.
 * 판단 불가 항목은 빼고, 채점한 항목의 배점만으로 다시 100점에 맞춘다.
 */
export function totalScore(fb: Feedback): number {
  let earned = 0;
  let possible = 0;
  for (const r of rubric) {
    const sc = scoreOf(fb, r.id);
    if (sc === null) continue;
    earned += (r.weight * sc) / 5;
    possible += r.weight;
  }
  return possible === 0 ? 0 : Math.round((earned / possible) * 100);
}
