// AI 피드백 품질 평가. 실제 OpenAI API를 부르므로 비용이 든다(한 번에 수십 원 수준).
// 실행: npm run eval:ai              (.env.local의 OPENAI_MODEL)
//       EVAL_MODELS=gpt-4o-mini,gpt-5.4-mini npm run eval:ai   (여러 모델 비교)
// 결과 전체는 test-results/eval/에 모델별 JSON으로 남는다.
//
// 녹취는 지어낸 대본을 음성 합성해 옮긴 가짜 데이터다(fixtures/*.script.txt).
// 대본은 일부러 약점을 넣었다: 안전 안내는 "장갑 끼고 하세요, 아시죠?" 한 마디, 발표는 자원자만, 학생 발언 없음.
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import type { Feedback } from "@/lib/types";

// .env.local을 읽는다(Next가 아니라 vitest로 돌기 때문)
for (const line of readFileSync(path.join(__dirname, "../../.env.local"), "utf-8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
}

type Fixture = { lessonNo: number; durationSec: number; timed: boolean; segments: { start: number; end: number; text: string }[] };
const fixture = JSON.parse(readFileSync(path.join(__dirname, "fixtures/lesson3-weak-safety.json"), "utf-8")) as Fixture;
const models = (process.env.EVAL_MODELS ?? process.env.OPENAI_MODEL ?? "").split(",").map((m) => m.trim()).filter(Boolean);
const outDir = path.join(__dirname, "../../test-results/eval");

describe.skipIf(!process.env.OPENAI_API_KEY || models.length === 0)("AI 피드백: 3차시, 안전 안내가 약한 모의수업", () => {
  for (const model of models) {
    describe(model, () => {
      let fb: Feedback;
      it("피드백을 만든다", async () => {
        process.env.OPENAI_MODEL = model;
        const { writeFeedback } = await import("@/server/analysis/feedback");
        const { getLesson, totalScore } = await import("@/server/content");
        const t0 = Date.now();
        fb = await writeFeedback({ lesson: getLesson(fixture.lessonNo)!, segments: fixture.segments, durationSec: fixture.durationSec, timed: fixture.timed, onStage: async () => {} });
        mkdirSync(outDir, { recursive: true });
        writeFileSync(path.join(outDir, `${model}.json`), JSON.stringify({ seconds: (Date.now() - t0) / 1000, total: totalScore(fb), feedback: fb }, null, 1));
      });

      it("안전 안내가 한 마디뿐이면 안전 항목은 3점 이하", () => {
        expect(fb.criteria.c_safety.score).not.toBeNull();
        expect(fb.criteria.c_safety.score!).toBeLessThanOrEqual(3);
      });
      it("안전이 4점 미만이면 개선점 첫 번째로 다룬다", () => {
        expect(fb.improvements[0]?.text ?? "").toMatch(/안전|장갑|보호/);
      });
      it("학생 발언이 없으면 학생 반응이 필요한 항목은 판단 불가", () => {
        expect(fb.criteria.c_adjust.score).toBeNull();
        expect(fb.criteria.c_follow.score).toBeNull();
      });
      it("자원자만 발표시키면 참여 배분은 3점 이하(또는 판단 불가)", () => {
        expect(fb.criteria.c_participation.score ?? 0).toBeLessThanOrEqual(3);
      });
      it("모든 점수는 녹취로 확인된 근거가 있다", () => {
        for (const [id, c] of Object.entries(fb.criteria)) if (c.score !== null) expect(c.evidence.length, id).toBeGreaterThan(0);
      });
      it("해요체로 쓴다", () => {
        const text = [...Object.values(fb.criteria).flatMap((c) => [c.reason, c.nextAction]), ...fb.improvements.flatMap((x) => [x.text, x.suggestion]), fb.closing].join(" ");
        expect(text.match(/습니다|합니다/g)?.length ?? 0).toBeLessThanOrEqual(2);
      });
      it("다음 행동에 실제로 할 말(큰따옴표)을 넣는다", () => {
        const scored = Object.values(fb.criteria).filter((c) => c.score !== null);
        const withLine = scored.filter((c) => /["“”]/.test(c.nextAction));
        expect(withLine.length / scored.length).toBeGreaterThanOrEqual(0.6);
      });
    });
  }
});
