// 녹취 + 지도안 + 공통 루브릭 → 근거 기반 피드백.
// 1) 초안 작성 → 2) 검토 체크리스트 8개 확인 → 통과 못 한 항목이 있으면 3) 한 번 고쳐 쓰고 4) 다시 확인한다.
// 모델이 든 근거 발언은 녹취와 대조해 실제로 있는 것만 남긴다(groundQuote).
import type { CriterionResult, Feedback, Lesson } from "@/lib/types";
import { feedbackStandard, rubric } from "../content";
import { aiConfig, AnalysisError, openaiFetch } from "./openai";
import { groundQuote, mmss, transcriptText, validTime, type Segment } from "./transcript";

// ---------------- 프롬프트 ----------------

/** mock: 강사 혼자 녹화한 모의수업(기본). live: 학생이 있는 실제 수업 녹음. */
export type LessonMode = "mock" | "live";

const SITUATION: Record<LessonMode, string> = {
  mock: `[상황]
- 모의수업은 보통 강사 혼자 학생 없이 녹화한다. 강사가 학생 대답을 상상하며 되받는 말(예: "보라색이요?", "좋아요.")은 실제 학생 반응이 아니다.
- 학생 반응이 있어야 판단할 수 있는 항목(c_adjust 이해 증거에 따른 조정, c_follow 피드백 뒤 확인 등)은 실제 학생 발언이 녹취에 없으면 score를 null로 두고, reason에 왜 판단할 수 없는지 쓴다.
- 녹취는 음성 인식 결과라 오탈자가 있을 수 있다. 발음이 비슷해 잘못 받아 적힌 것으로 보이는 단어(예: buoyancy→"fluency", water→"order", 부력→"부럭")는 강사가 그렇게 말했다고 보지 않고, 내용 정확성 감점이나 개선점의 근거로 쓰지 않는다. 몸짓·표정·화면·판서·시범은 녹취에 없으므로 했다고도, 안 했다고도 단정하지 않는다.`,
  live: `[상황]
- 학생들이 실제로 참여한 수업을 교실에서 녹음한 것이다. 학생 발언은 실제 학생 반응이므로 c_adjust·c_follow 같은 항목의 근거로 쓸 수 있다.
- 녹취의 "참석자 N"은 음성 인식이 목소리로 자동 구분한 화자 표시라 틀릴 수 있다. 누가 강사이고 누가 학생인지는 말의 내용(지시·설명·질문 vs 활동 중 대화)으로 판단하고, 확실하지 않으면 단정하지 않는다.
- 교실 소음 속 녹음이라 인식이 안 된 구간이 많고, 활동 시간에는 발언 사이 간격이 길다. 녹취가 비어 있는 구간에 무엇을 했는지는 단정하지 않는다. 녹취가 시작되기 전 구간(도입 등)은 판단할 수 없다고 본다.
- 강사의 행동(질문·안내·피드백·안전 지도)을 평가하는 근거로는 강사 발언만 쓴다. 학생이 한 말(예: 학생끼리 "why is it leaning?")을 강사의 질문으로 세지 않는다. 학생 발언은 참여·수행·반응의 근거로만 쓴다.
- 수업이 한국어가 아닐 수 있다(예: 영어). quote는 녹취 원문 언어 그대로 옮기고, 나머지 피드백은 한국어 해요체로 쓴다.
- 녹취는 음성 인식 결과라 오탈자가 있을 수 있다. 발음이 비슷해 잘못 받아 적힌 것으로 보이는 단어(예: buoyancy→"fluency", water→"order", 부력→"부럭")는 강사가 그렇게 말했다고 보지 않고, 내용 정확성 감점이나 개선점의 근거로 쓰지 않는다. 몸짓·표정·화면·판서·시범은 녹취에 없으므로 했다고도, 안 했다고도 단정하지 않는다.`,
};

function systemPrompt(mode: LessonMode = "mock"): string {
  const principles = feedbackStandard.principles
    .map((p) => [`${p.no}. ${p.title}: ${p.summary}`, ...p.points.map((x) => `   - ${x}`), p.example ? `   ${p.exampleLabel}: ${p.example.replace(/\n/g, "\n   ")}` : ""].filter(Boolean).join("\n"))
    .join("\n");
  const levels = rubric
    .map((r) => [`- ${r.id} | ${r.name} | 배점 ${r.weight}${r.critical ? " | 필수(안전)" : ""}`, ...r.levels.map((l, i) => `    ${i + 1}점: ${l}`)].join("\n"))
    .join("\n");
  const what = mode === "live" ? "실제 수업" : "모의수업";
  return `너는 초등 STEM 방과후 수업(진로탐험대) 강사의 ${what}을 평가하는 수업 코치다.
강사의 ${what} 녹취와 해당 지도안을 보고, 공통 루브릭 13개 항목으로 채점하고 근거 기반 피드백을 쓴다.

${SITUATION[mode]}

[피드백 원칙]
${principles}

[공통 루브릭: 항목별 1~5점 기준]
${levels}

[채점 방법]
- 항목마다 1점부터 5점까지 기준 문장과 녹취 근거를 차례로 비교해, 근거가 조건을 모두 충족하는 가장 높은 수준을 고른다.
- 4점·5점은 그 수준 기준 문장의 조건이 녹취에서 직접 확인될 때만 준다. 확인되지 않으면 그 아래 수준이다. 무난해 보인다는 이유로 4점을 주지 않는다.
- 예: 안전 안내가 "장갑 끼고 하세요" 한 마디뿐이고 확인·점검 발언이 없으면, 안전 항목은 안내만 있고 점검이 없는 수준(2~3점)이다.
- 지도안 단계·유의점에 적힌 행동이 녹취에 없으면 그 차이를 reason이나 planCheck에 쓴다.
- 녹취에서 용어가 틀려 보이면, 감점하기 전에 먼저 음성 인식 오류인지 따진다. 발음이 비슷한 올바른 용어가 있고 문맥상 그 뜻이 분명하면(예: "This is called fluency"는 부력 설명 문맥이라 buoyancy, "The order pushes objects upward"는 water) 강사가 올바르게 말한 것으로 보고, 내용 정확성 감점·개선점·잘못된 용어 지적에 쓰지 않는다. 오인식인지 확실하지 않으면 그 발언으로는 판단하지 않는다.
- 강사가 한 일(질문·설명·안내·피드백·확인·안전 지도)의 근거 quote는 강사의 발언이어야 한다. quote마다 앞의 화자 표시와 말투를 보고, 학생이 한 말이면 강사 행동의 근거로 쓰지 않는다.

[작성 규칙]
- criteria에는 13개 항목을 모두 한 번씩 넣는다.
- score는 1~5 정수 또는 null(판단 불가). 근거 없이 점수를 주지 않는다.
- evidence는 그 항목의 판단을 직접 뒷받침하는 발언만 1~2개. 관련 없는 문장으로 개수를 채우지 않는다. quote는 녹취 문장을 글자 그대로 옮기고(고치거나 요약하지 않는다) time은 그 문장 앞의 [mm:ss].
- reason은 무엇을 보고 왜 그 점수인지, 한 단계 위 수준이 되려면 무엇이 빠졌는지 2~3문장. 루브릭 문구를 그대로 반복하지 않는다.
- planCheck는 지도안의 계획과 실제 진행을 비교할 수 있을 때만 쓰고, 아니면 null. step은 "단계 · 주제 (분)" 형식.
- nextAction은 이 차시 수업의 구체적인 장면에서 바로 할 행동 하나와, 강사가 실제로 할 말을 큰따옴표로. "~을 강조해 보세요" 같은 막연한 말은 쓰지 않는다.
  좋은 예: 재료를 나눠 주기 전에 장갑 낀 손을 들어 보이고 "장갑 낀 손 들어 볼까요?"로 착용을 확인한 뒤 배부하세요.
- strengths는 2~3개, 실제 장면(시각, 녹취 인용)에 근거해 무엇이 왜 학습에 도움이 되는지.
- improvements는 학습에 미치는 영향이 큰 순서로 최대 3개. 필수(안전) 항목이 4점 미만이면 가장 먼저. text는 관찰된 행동과 교육적 이유, suggestion은 대안 행동과 실제로 할 말. 판단 불가 항목은 개선점으로 쓰지 않는다.
- closing은 이미 보인 강점과 다음 수업에서 시도할 행동을 연결하는 1~2문장.
- 모든 문장은 해요체로 쓴다("~했어요", "~해 보세요"). "~습니다"체를 쓰지 않는다. 강사를 3인칭("강사가")으로 부르지 않고 직접 말하듯 쓴다.
- 사람(능력·태도)이 아니라 바꿀 수 있는 행동을 말한다.`;
}

function lessonPrompt(lesson: Lesson, segs: Segment[], durationSec: number, timed: boolean, mode: LessonMode = "mock"): string {
  let at = 0;
  const steps = lesson.steps
    .map((s) => {
      const start = at;
      at += s.minutes ?? 0;
      const lines = [`- [${start}분~] ${s.stage} · ${s.topic} (${s.minutes ?? "?"}분)`];
      if (s.teacher.length) lines.push(`    강사: ${s.teacher.join(" / ")}`);
      if (s.student.length) lines.push(`    학생: ${s.student.join(" / ")}`);
      if (s.notes.length) lines.push(`    유의점: ${s.notes.join(" / ")}`);
      return lines.join("\n");
    })
    .join("\n");
  return `[${lessonLabel(lesson)} 지도안]
제목: ${lesson.title}
분야: ${lesson.field} / 대상: ${lesson.target} / 수업 시간: ${lesson.durationMinutes}분
교수 방법: ${lesson.method}
학습 목표:
${lesson.goals.map((g) => `- ${g}`).join("\n")}
준비물(강사): ${lesson.materials.teacher}
진행 단계:
${steps}

[${mode === "live" ? "실제 수업" : "모의수업"} 녹취] 녹화 길이 ${mmss(durationSec)}${timed ? "" : " (시각 정보 없음: 조각 시작 시각만 있음)"}
${transcriptText(segs)}`;
}

// ---------------- 응답 형식(JSON Schema) ----------------

const str = { type: "string" };
const evidenceSchema = { type: "object", additionalProperties: false, required: ["time", "quote"], properties: { time: str, quote: str } };
const draftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["criteria", "strengths", "improvements", "closing"],
  properties: {
    criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "score", "reason", "evidence", "planCheck", "nextAction"],
        properties: {
          id: { type: "string", enum: rubric.map((r) => r.id) },
          score: { type: ["integer", "null"] },
          reason: str,
          evidence: { type: "array", items: evidenceSchema },
          planCheck: {
            anyOf: [{ type: "object", additionalProperties: false, required: ["step", "planned", "observed"], properties: { step: str, planned: str, observed: str } }, { type: "null" }],
          },
          nextAction: str,
        },
      },
    },
    strengths: { type: "array", items: { type: "object", additionalProperties: false, required: ["time", "quote", "text"], properties: { time: str, quote: str, text: str } } },
    improvements: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["time", "quote", "text", "suggestion"], properties: { time: str, quote: str, text: str, suggestion: str } },
    },
    closing: str,
  },
};

export type Draft = {
  criteria: { id: string; score: number | null; reason: string; evidence: { time: string; quote: string }[]; planCheck: { step: string; planned: string; observed: string } | null; nextAction: string }[];
  strengths: { time: string; quote: string; text: string }[];
  improvements: { time: string; quote: string; text: string; suggestion: string }[];
  closing: string;
};

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "passed", "comment"],
        properties: { name: { type: "string", enum: feedbackStandard.checklist.map((c) => c.name) }, passed: { type: "boolean" }, comment: str },
      },
    },
  },
};

export type Review = { items: { name: string; passed: boolean; comment: string }[] };

const isReasoningModel = (m: string) => /^(gpt-5|o\d)/.test(m) && !m.includes("chat");

async function chat<T>(messages: { role: "system" | "user" | "assistant"; content: string }[], name: string, schema: object): Promise<T> {
  const { model } = aiConfig();
  const res = (await openaiFetch("/chat/completions", {
    json: true,
    timeoutMs: 10 * 60 * 1000,
    body: JSON.stringify({
      model,
      // 추론 모델(gpt-5·o 계열)은 temperature를 바꿀 수 없다
      ...(isReasoningModel(model) ? {} : { temperature: 0.2 }),
      messages,
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    }),
  })) as { choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[] };
  const choice = res.choices?.[0];
  if (choice?.message?.refusal) throw new AnalysisError("AI가 이 녹화의 분석을 거절했어요.");
  if (choice?.finish_reason === "length") throw new AnalysisError("녹화가 너무 길어 AI가 피드백을 끝까지 쓰지 못했어요.");
  try {
    return JSON.parse(choice?.message?.content ?? "") as T;
  } catch {
    throw new AnalysisError("AI 응답을 읽지 못했어요. 다시 시도해 주세요.");
  }
}

// ---------------- 실행 ----------------

export type FeedbackStage = "score" | "review";

export async function writeFeedback(input: {
  lesson: Lesson;
  segments: Segment[];
  durationSec: number;
  timed: boolean;
  onStage: (stage: FeedbackStage) => Promise<void>;
  mode?: LessonMode;
  /** 피드백 근거 문구에 쓸 녹취 출처. 없으면 음성 인식 모델 이름. */
  transcriptSource?: string;
}): Promise<Feedback> {
  const { lesson, segments, durationSec, timed, mode = "mock", transcriptSource } = input;
  const system = systemPrompt(mode);
  const user = lessonPrompt(lesson, segments, durationSec, timed, mode);

  await input.onStage("score");
  let draft = await chat<Draft>([{ role: "system", content: system }, { role: "user", content: user }], "lesson_feedback", draftSchema);

  await input.onStage("review");
  let review = await reviewDraft(draft, user);
  const failed = review.items.filter((i) => !i.passed);
  if (failed.length > 0) {
    draft = await chat<Draft>(
      [
        { role: "system", content: system },
        { role: "user", content: user },
        { role: "assistant", content: JSON.stringify(draft) },
        {
          role: "user",
          content: `검토 체크리스트에서 아래 항목을 통과하지 못했어요. 지적을 반영해 같은 형식으로 피드백 전체를 다시 써 주세요.\n${failed.map((f) => `- ${f.name}: ${f.comment}`).join("\n")}`,
        },
      ],
      "lesson_feedback",
      draftSchema,
    );
    review = await reviewDraft(draft, user);
  }
  return toFeedback(draft, review, { lesson, segments, durationSec, timed, mode, transcriptSource });
}

/** 사람이 고친 피드백(초안 형식)을 같은 검토 체크리스트로 다시 확인한다. 부스 시연 자료처럼 손본 결과를 검증할 때 쓴다. */
export function reviewEditedDraft(input: { lesson: Lesson; segments: Segment[]; durationSec: number; timed: boolean; mode?: LessonMode; draft: Draft }): Promise<Review> {
  return reviewDraft(input.draft, lessonPrompt(input.lesson, input.segments, input.durationSec, input.timed, input.mode));
}

async function reviewDraft(draft: Draft, user: string): Promise<Review> {
  const checklist = feedbackStandard.checklist.map((c) => `- ${c.name}: ${c.question}`).join("\n");
  const review = await chat<Review>(
    [
      {
        role: "system",
        content: `너는 수업 피드백 검토자다. 아래 지도안·녹취를 근거로, AI가 쓴 피드백 초안이 검토 체크리스트 8개를 지키는지 엄격하게 확인한다.
특히 녹취에 없는 발언·학생 반응을 근거로 들었는지, 근거 없이 점수를 줬는지 확인한다. comment에는 통과하지 못한 이유나 확인한 내용을 한 문장으로 쓴다.
[검토 체크리스트]
${checklist}`,
      },
      { role: "user", content: `${user}\n\n[피드백 초안]\n${JSON.stringify(draft)}` },
    ],
    "feedback_review",
    reviewSchema,
  );
  // 빠진 항목은 통과하지 못한 것으로 본다
  const byName = new Map(review.items.map((i) => [i.name, i]));
  return { items: feedbackStandard.checklist.map((c) => byName.get(c.name) ?? { name: c.name, passed: false, comment: "검토 결과가 없어요." }) };
}

const NO_EVIDENCE = "녹취에서 근거 발언을 확인하지 못해 점수를 매기지 않았어요.";

/** 모델 응답을 화면용 피드백으로 바꾼다. 녹취에 없는 근거는 버리고, 근거가 하나도 없는 점수는 판단 불가로 돌린다. */
/** 정식 차시는 "N차시", 그 밖의 지도안(no 0)은 제목으로 부른다. */
const lessonLabel = (l: Lesson) => (l.no > 0 ? `${l.no}차시` : `「${l.title}」`);

export function toFeedback(
  draft: Draft,
  review: Review,
  ctx: { lesson: Lesson; segments: Segment[]; durationSec: number; timed: boolean; mode?: LessonMode; transcriptSource?: string },
): Feedback {
  const { segments, durationSec } = ctx;
  const byId = new Map(draft.criteria.map((c) => [c.id, c]));
  const criteria: Record<string, CriterionResult> = {};
  for (const r of rubric) {
    const c = byId.get(r.id);
    if (!c) {
      criteria[r.id] = { score: null, reason: "AI가 이 항목을 평가하지 않았어요.", evidence: [], nextAction: "" };
      continue;
    }
    const evidence = c.evidence.map((e) => groundQuote(e.quote, e.time, segments)).filter((e) => e !== null);
    const unique = evidence.filter((e, i) => evidence.findIndex((x) => x.time === e.time) === i).slice(0, 3);
    let score = typeof c.score === "number" ? Math.min(5, Math.max(1, Math.round(c.score))) : null;
    let reason = c.reason.trim();
    if (score !== null && unique.length === 0) {
      score = null;
      reason = `${NO_EVIDENCE} (AI 판단: ${reason})`;
    }
    criteria[r.id] = {
      score,
      reason,
      evidence: unique,
      ...(c.planCheck ? { planCheck: c.planCheck } : {}),
      nextAction: c.nextAction.trim(),
    };
  }

  // 시각은 녹취와 대조해 실제 장면 시각으로 맞춘다
  const strengths = draft.strengths
    .map((s) => {
      const g = s.quote ? groundQuote(s.quote, s.time, segments) : null;
      if (g) return { time: g.time, quote: g.quote, text: s.text.trim() };
      const t = validTime(s.time, durationSec);
      return t ? { time: t, text: s.text.trim() } : null;
    })
    .filter((s) => s !== null)
    .slice(0, 3);
  const improvements = draft.improvements
    .map((s) => {
      const t = (s.quote ? groundQuote(s.quote, s.time, segments)?.time : null) ?? validTime(s.time, durationSec);
      return t ? { time: t, text: s.text.trim(), suggestion: s.suggestion.trim() } : null;
    })
    .filter((s) => s !== null)
    .slice(0, 3);

  const passed = review.items.filter((i) => i.passed).length;
  const { model, transcribeModel } = aiConfig();
  return {
    basis: `${ctx.mode === "live" ? "실제 수업 녹음" : "녹화 음성"}을 글로 옮긴 기록(${segments.length}문장, ${ctx.transcriptSource ?? transcribeModel})과 ${lessonLabel(ctx.lesson)} 지도안을 바탕으로 ${model}이 공통 루브릭 13개 기준에 따라 채점했어요. 영상 속 몸짓과 표정은 반영하지 않았어요.${ctx.timed ? "" : " 음성 인식 모델이 시각을 주지 않아 장면 시각이 정확하지 않아요."}`,
    review: { status: "reviewed", checklistPassed: passed, notes: review.items },
    criteria,
    strengths,
    improvements,
    closing: draft.closing.trim(),
  };
}
