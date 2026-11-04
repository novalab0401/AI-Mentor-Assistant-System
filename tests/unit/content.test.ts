// 원본 문서에서 뽑은 데이터와 예시 피드백이 약속한 구조를 지키는지 확인한다.
// 원본 문서를 바꾸고 extract_content.py를 다시 돌렸을 때 깨진 곳을 바로 알 수 있다.
import { describe, expect, it } from "vitest";
import { feedbackStandard, lessons, program, rubric } from "@/server/content";
import { DEMO_SESSIONS } from "@/server/demo-sessions";

describe("수업 지도안", () => {
  it("12차시이고 번호가 1부터 이어진다", () => {
    expect(lessons.map((l) => l.no)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it.each(lessons.map((l) => [l.no, l] as const))("%i차시: 활동 시간 합이 60분, 학습 목표 3개, 도입→전개→정리", (_, l) => {
    expect(l.steps.reduce((a, s) => a + (s.minutes ?? 0), 0)).toBe(60);
    expect(l.goals).toHaveLength(3);
    const stages = [...new Set(l.steps.map((s) => s.stage))];
    expect(stages).toEqual(["도입", "전개", "정리"]);
    for (const s of l.steps) expect(s.teacher.length).toBeGreaterThan(0);
  });

  it("제안서 차시 구성이 지도안과 같은 순서", () => {
    expect(program.curriculum.map((c) => c.theme)).toEqual(lessons.map((l) => l.field));
  });
});

describe("공통 루브릭과 피드백 기준", () => {
  it("13개 항목, 배점 합 100, 항목마다 1~5점 수준 설명 5개", () => {
    expect(rubric).toHaveLength(13);
    expect(rubric.reduce((a, r) => a + r.weight, 0)).toBe(100);
    for (const r of rubric) expect(r.levels).toHaveLength(5);
  });

  it("필수 항목은 안전수칙 하나(12점)", () => {
    expect(rubric.filter((r) => r.critical).map((r) => [r.id, r.weight])).toEqual([["c_safety", 12]]);
  });

  it("피드백 원칙 9개, 검토 체크리스트 8개", () => {
    expect(feedbackStandard.principles).toHaveLength(9);
    expect(feedbackStandard.checklist).toHaveLength(8);
  });
});

describe("예시 피드백 형식", () => {
  const ids = rubric.map((r) => r.id).sort();
  it.each(DEMO_SESSIONS.map((s) => [s.id, s] as const))("%s", (_, s) => {
    const fb = s.feedback!;
    expect(s.demo).toBe(true);
    expect(Object.keys(fb.criteria).sort()).toEqual(ids); // 13개 항목 모두 있음
    for (const c of Object.values(fb.criteria)) {
      expect(c.score === null || (Number.isInteger(c.score) && c.score >= 1 && c.score <= 5)).toBe(true);
      expect(c.reason.length).toBeGreaterThan(0);
      expect(c.nextAction.length).toBeGreaterThan(0);
      for (const e of c.evidence) expect(e.time).toMatch(/^\d{2}:\d{2}$/);
    }
    expect(fb.improvements.length).toBeLessThanOrEqual(3); // 피드백 기준 5번: 개선점 최대 3개
    expect(fb.review.checklistPassed).toBeLessThanOrEqual(8);
  });

  it("혼자 녹화한 모의수업에서는 학생 반응이 필요한 항목을 판단 불가로 둔다", () => {
    for (const s of DEMO_SESSIONS) {
      expect(s.feedback!.criteria.c_adjust.score).toBeNull();
      expect(s.feedback!.criteria.c_follow.score).toBeNull();
    }
  });
});
