import { describe, expect, it } from "vitest";
import { rubric, scoreOf, totalScore } from "@/server/content";
import { DEMO_SESSIONS } from "@/server/demo-sessions";
import type { CriterionResult, Feedback } from "@/lib/types";

function feedbackWith(scores: Record<string, number | null>): Feedback {
  const criteria: Record<string, CriterionResult> = {};
  for (const r of rubric) criteria[r.id] = { score: scores[r.id] ?? null, reason: "", evidence: [], nextAction: "" };
  return { basis: "", review: { status: "draft", checklistPassed: 0 }, criteria, strengths: [], improvements: [], closing: "" };
}

describe("totalScore", () => {
  it("13개 항목이 모두 5점이면 100점", () => {
    expect(totalScore(feedbackWith(Object.fromEntries(rubric.map((r) => [r.id, 5]))))).toBe(100);
  });

  it("모두 1점이면 20점", () => {
    expect(totalScore(feedbackWith(Object.fromEntries(rubric.map((r) => [r.id, 1]))))).toBe(20);
  });

  it("판단 불가 항목은 빼고 남은 배점으로 100점에 맞춘다", () => {
    // 안전수칙(12점)만 판단 불가, 나머지는 모두 4점 → 80점
    const scores = Object.fromEntries(rubric.map((r) => [r.id, r.id === "c_safety" ? null : 4]));
    expect(totalScore(feedbackWith(scores))).toBe(80);
  });

  it("전부 판단 불가면 0점", () => {
    expect(totalScore(feedbackWith({}))).toBe(0);
  });

  it("scoreOf는 없는 항목을 판단 불가(null)로 본다", () => {
    expect(scoreOf(feedbackWith({ c_goal: 3 }), "c_goal")).toBe(3);
    expect(scoreOf(feedbackWith({}), "c_goal")).toBeNull();
  });

  it("3차시 예시 피드백 총점은 76점", () => {
    const fb = DEMO_SESSIONS.find((s) => s.id === "demo-3")!.feedback!;
    expect(totalScore(fb)).toBe(76);
  });
});
