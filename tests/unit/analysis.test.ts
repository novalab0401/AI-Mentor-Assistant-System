// AI 분석 결과 후처리: 근거 발언을 녹취와 대조하고, 근거 없는 점수를 판단 불가로 돌리는지.
// 녹취는 지어낸 예시 문장이다.
import { describe, expect, it } from "vitest";
import { groundQuote, mmss, parseTime, validTime, type Segment } from "@/server/analysis/transcript";
import { toFeedback } from "@/server/analysis/feedback";
import { getLesson, rubric } from "@/server/content";

const segs: Segment[] = [
  { start: 5, end: 9, text: "안녕하세요, 오늘은 색깔로 용액을 알아내 볼 거예요." },
  { start: 395, end: 399, text: "장갑 끼고 하세요, 아시죠?" },
  { start: 1450, end: 1455, text: "어떤 색을 보고 그렇게 생각했어?" },
  { start: 1456, end: 1460, text: "기준표랑 비교해 보세요." },
];

describe("시각 형식", () => {
  it("초를 mm:ss·h:mm:ss로, 거꾸로도 바꾼다", () => {
    expect(mmss(395)).toBe("06:35");
    expect(mmss(3725)).toBe("1:02:05");
    expect(parseTime("06:35")).toBe(395);
    expect(parseTime("1:02:05")).toBe(3725);
    expect(parseTime("6:75")).toBeNull();
    expect(parseTime("어제")).toBeNull();
  });
  it("녹화 길이를 넘는 시각은 버린다", () => {
    expect(validTime("10:00", 3600)).toBe("10:00");
    expect(validTime("70:00", 3600)).toBeNull();
  });
});

describe("근거 발언 대조", () => {
  it("글자 그대로 있으면 인용은 두고 시각만 실제 장면으로 바로잡는다", () => {
    expect(groundQuote("장갑 끼고 하세요", "03:00", segs)).toEqual({ time: "06:35", quote: "장갑 끼고 하세요" });
  });
  it("조금 다르게 옮긴 인용은 녹취 문장으로 바꾼다", () => {
    expect(groundQuote("어떤 색깔을 보고 그렇게 생각했어요?", "24:10", segs)).toEqual({ time: "24:10", quote: "어떤 색을 보고 그렇게 생각했어?" });
  });
  it("두 문장에 걸친 인용도 찾는다", () => {
    expect(groundQuote("그렇게 생각했어? 기준표랑 비교해 보세요", "24:10", segs)?.time).toBe("24:10");
  });
  it("녹취에 없는 발언은 근거로 쓰지 않는다", () => {
    expect(groundQuote("보안경을 모두 썼는지 확인해 볼까요?", "10:00", segs)).toBeNull();
    expect(groundQuote("네", "00:05", segs)).toBeNull(); // 너무 짧은 인용
  });
});

describe("피드백 정리", () => {
  const lesson = getLesson(3)!;
  const base = { strengths: [], improvements: [], closing: "좋았어요." };
  const review = { items: [{ name: "x", passed: true, comment: "" }] };

  it("근거가 하나도 확인되지 않은 점수는 판단 불가로 돌리고, 빠진 항목도 판단 불가로 채운다", () => {
    const fb = toFeedback(
      {
        ...base,
        criteria: [
          { id: "c_safety", score: 3, reason: "말로만 안내했어요.", evidence: [{ time: "06:35", quote: "장갑 끼고 하세요, 아시죠?" }], planCheck: null, nextAction: "시범을 보여 주세요." },
          { id: "c_goal", score: 5, reason: "목표를 잘 말했어요.", evidence: [{ time: "01:00", quote: "오늘의 학습목표는 근거를 들어 말하기예요" }], planCheck: null, nextAction: "" },
          { id: "c_question", score: 9, reason: "질문을 했어요.", evidence: [{ time: "24:10", quote: "어떤 색을 보고 그렇게 생각했어?" }], planCheck: null, nextAction: "" },
        ],
      },
      review,
      { lesson, segments: segs, durationSec: 3600, timed: true },
    );
    expect(Object.keys(fb.criteria).sort()).toEqual(rubric.map((r) => r.id).sort());
    expect(fb.criteria.c_safety).toMatchObject({ score: 3, evidence: [{ time: "06:35" }] });
    expect(fb.criteria.c_goal.score).toBeNull(); // 녹취에 없는 인용뿐
    expect(fb.criteria.c_goal.reason).toContain("근거 발언을 확인하지 못해");
    expect(fb.criteria.c_question.score).toBe(5); // 1~5로 자른다
    expect(fb.criteria.c_accuracy.score).toBeNull(); // 모델이 빠뜨린 항목
  });

  it("강점·개선점 시각을 녹취에 맞추고, 개선점은 3개까지만 둔다", () => {
    const imp = { time: "06:00", quote: "장갑 끼고 하세요", text: "말로만 안내했어요.", suggestion: "시범을 보여 주세요." };
    const fb = toFeedback(
      {
        criteria: [],
        strengths: [
          { time: "20:00", quote: "어떤 색을 보고 그렇게 생각했어?", text: "근거를 묻는 질문이에요." },
          { time: "99:00", quote: "녹취에 없는 말", text: "시각도 틀렸어요." },
        ],
        improvements: [imp, imp, imp, imp],
        closing: "다음에도 해 보세요.",
      },
      review,
      { lesson, segments: segs, durationSec: 3600, timed: true },
    );
    expect(fb.strengths).toEqual([{ time: "24:10", quote: "어떤 색을 보고 그렇게 생각했어?", text: "근거를 묻는 질문이에요." }]);
    expect(fb.improvements).toHaveLength(3);
    expect(fb.improvements[0].time).toBe("06:35");
  });
});
