// 부스 시연(레이저 챌린지 3분 수업)의 AI 피드백을 미리 만들어 둔다. 부스 화면은 이 결과를 "실시간으로 분석하는 것처럼" 보여 준다.
//
// 실행: npx vite-node --config vitest.config.ts scripts/booth-feedback.ts [-- --regen]
// 1) AI 원본: content/booth/laser-demo.json(시연 대본을 시각별로 옮긴 연출 녹취)을 실제 채점 파이프라인에 넣은 결과
//    → laser-demo-feedback.raw.json. 이미 있으면 다시 만들지 않는다(--regen이면 다시 만든다).
// 2) 사람 수정: laser-demo-curation.json의 점수·문구를 원본 위에 덮는다(대본이 의도한 초보 강사 모습에 맞춤).
// 3) 고친 결과를 같은 AI 검토 체크리스트로 다시 확인하고, 근거 발언을 녹취와 대조해 laser-demo-feedback.json으로 저장한다.
import { promises as fs } from "fs";
import path from "path";
import type { Feedback, Lesson } from "@/lib/types";
import { reviewEditedDraft, toFeedback, writeFeedback, type Draft } from "@/server/analysis/feedback";
import { aiConfig } from "@/server/analysis/openai";
import type { Segment } from "@/server/analysis/transcript";

export type BoothDemo = {
  id: string;
  title: string;
  subtitle: string;
  durationSec: number;
  teacher: string;
  audience: string;
  game: string;
  goals: string[];
  scenes: { no: number; title: string; start: number; end: number; plan: string[] }[];
  lines: { t: number; who: string; text: string }[];
  events: { t: number; kind: string; text: string }[];
  notes: { t: number; tone: "good" | "warn" | "info"; area: string; text: string }[];
};

export function boothLesson(d: BoothDemo): Lesson {
  return {
    no: 0,
    title: `${d.title} (${d.subtitle})`,
    field: "과학",
    unit: "빛의 반사",
    method: "게임 체험: 강사 시범 → 관람객 직접 조작 → 미션 → 정리",
    target: `전시 부스 ${d.audience}`,
    goals: d.goals,
    materials: { teacher: "레이저 챌린지 게임 화면, 웹캠 손 인식", student: "" },
    durationMinutes: d.durationSec / 60,
    steps: d.scenes.map((s, i) => ({
      stage: `장면 ${s.no}`,
      stageMinutes: null,
      topic: s.title,
      minutes: Math.round(((s.end - s.start) / 60) * 100) / 100,
      teacher: s.plan,
      student: [],
      materials: "",
      notes:
        i === 0
          ? ["화면 속 가상 레이저 게임이라 실제 실험 도구·안전 위험이 없다. 실습 안전 항목은 판단할 근거가 없으면 판단 불가로 둔다.", `게임: ${d.game}`]
          : [],
    })),
    summary: d.goals.join(" / "),
  };
}

/** 발언과 게임 기록을 시각순으로 섞은 녹취. 게임 기록은 "[게임 기록]"으로 표시해 발언과 구분한다. */
export function boothSegments(d: BoothDemo): Segment[] {
  const items = [...d.lines.map((l) => ({ t: l.t, text: `${l.who}: ${l.text}` })), ...d.events.map((e) => ({ t: e.t, text: `[게임 기록] ${e.text}` }))].sort((a, b) => a.t - b.t);
  return items.map((x, i) => ({ start: x.t, end: Math.max(x.t + 1, items[i + 1]?.t ?? d.durationSec), text: x.text }));
}

type Curation = {
  criteria: Record<string, Partial<Draft["criteria"][number]>>;
  strengths: Draft["strengths"];
  improvements: (Draft["improvements"][number] & { when: string; title: string })[];
  closing: string;
};

/** 화면에 보일 피드백을 초안 형식으로 되돌린다(검토·근거 대조를 다시 하기 위해). */
function toDraft(raw: Feedback, cur: Curation): Draft {
  return {
    criteria: Object.entries(raw.criteria).map(([id, c]) => ({
      id,
      score: c.score,
      reason: c.reason,
      evidence: c.evidence.map((e) => ({ time: e.time, quote: e.quote })),
      planCheck: c.planCheck ?? null,
      nextAction: c.nextAction,
      ...cur.criteria[id],
    })),
    strengths: cur.strengths,
    improvements: cur.improvements.map(({ time, quote, text, suggestion }) => ({ time, quote, text, suggestion })),
    closing: cur.closing,
  };
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
  const dir = path.join(process.cwd(), "content", "booth");
  const read = async <T>(name: string) => JSON.parse(await fs.readFile(path.join(dir, name), "utf-8")) as T;
  const demo = await read<BoothDemo>("laser-demo.json");
  const lesson = boothLesson(demo);
  const segments = boothSegments(demo);
  const ctx = { lesson, segments, durationSec: demo.durationSec, timed: true, mode: "live" as const, transcriptSource: "부스 시연 대본" };
  const started = Date.now();
  const sec = () => Math.round((Date.now() - started) / 1000);

  const rawFile = path.join(dir, "laser-demo-feedback.raw.json");
  const hasRaw = await fs.stat(rawFile).then(() => true, () => false);
  if (!hasRaw || process.argv.includes("--regen")) {
    const raw = await writeFeedback({ ...ctx, onStage: async (s) => console.log(`- AI 원본 ${s === "score" ? "채점" : "검토"} 중… (${sec()}초)`) });
    await fs.writeFile(rawFile, `${JSON.stringify(raw, null, 2)}\n`, "utf-8");
  }
  const raw = await read<Feedback>("laser-demo-feedback.raw.json");
  const cur = await read<Curation>("laser-demo-curation.json");

  console.log(`- 수정본 AI 검토 중… (${sec()}초)`);
  const draft = toDraft(raw, cur);
  const review = await reviewEditedDraft({ ...ctx, draft });
  const feedback = toFeedback(draft, review, ctx);

  // 고친 근거가 녹취와 맞지 않아 버려졌으면 알려 준다
  for (const [id, c] of Object.entries(cur.criteria)) {
    const want = c.evidence?.length ?? 0;
    const got = feedback.criteria[id]?.evidence.length ?? 0;
    if (got < want) console.warn(`! ${id}: 근거 ${want}개 중 ${got}개만 녹취와 맞았어요`);
  }
  const out = {
    feedback,
    next: cur.improvements.map((i) => ({ when: i.when, title: i.title, say: i.suggestion })),
    curated: Object.keys(cur.criteria),
    model: aiConfig().model,
  };
  await fs.writeFile(path.join(dir, "laser-demo-feedback.json"), `${JSON.stringify(out, null, 2)}\n`, "utf-8");
  console.log(`완료 (${sec()}초) · 검토 ${feedback.review.checklistPassed}/8 → content/booth/laser-demo-feedback.json`);
  for (const n of feedback.review.notes ?? []) if (!n.passed) console.log(`  X ${n.name}: ${n.comment}`);
}

if (!process.env.VITEST) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
