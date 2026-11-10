// 클로바노트로 받아 적은 실제 수업 녹취(txt)를 Nova Lab 피드백으로 분석한다.
//
// 실행: npx vite-node --config vitest.config.ts scripts/analyze-clova.ts -- <녹취.txt> [--redact 이름1,이름2] [--dry]
// --dry: OpenAI로 보내지 않고 변환 결과(지도안·녹취)만 출력한다.
//
// - txt 앞부분: "참석자 N mm:ss" 다음 줄들이 발언. "clovanote.naver.com" 줄에서 녹취가 끝난다.
// - txt 뒷부분(선택): 노션식 지도안(핵심 개념, 학습 목표, 준비물, 수업 시나리오 "A분~B분").
// - 녹취 텍스트만 OpenAI 채점 모델로 보낸다(음성은 보내지 않는다). 보내기 전에 --redact 이름과 머리말(작성자)을 지운다.
// - 결과는 data/external/(git 제외)에 JSON과 읽기용 Markdown으로 남는다. 실제 수업 기록이므로 저장소에 넣지 않는다.
import { promises as fs } from "fs";
import path from "path";
import type { Feedback, Lesson, LessonStep } from "@/lib/types";
import { DATA_DIR } from "@/server/dataDir";
import { rubric } from "@/server/content";
import { writeFeedback } from "@/server/analysis/feedback";
import { mmss, type Segment } from "@/server/analysis/transcript";

type Parsed = { segments: Segment[]; durationSec: number; plan: string };

/** 클로바노트 txt → 발언 목록, 길이, 뒤에 붙은 지도안 원문. */
export function parseClova(raw: string, redact: string[]): Parsed {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const [body, plan = ""] = text.split(/\n\s*clovanote\.naver\.com\s*\n/);
  const dur = /(\d+)분\s*(\d+)초/.exec(body.slice(0, 300));
  const durationSec = dur ? Number(dur[1]) * 60 + Number(dur[2]) : 0;

  const scrub = (s: string) => redact.reduce((acc, name) => acc.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "[이름]"), s);
  const blocks: { start: number; speaker: string; text: string }[] = [];
  const re = /^(참석자\s*\d+)\s+(\d{1,2}):(\d{2})\s*$/;
  let cur: (typeof blocks)[number] | null = null;
  for (const line of body.split("\n")) {
    const m = re.exec(line.trim());
    if (m) {
      cur = { start: Number(m[2]) * 60 + Number(m[3]), speaker: m[1].replace(/\s+/g, " "), text: "" };
      blocks.push(cur);
    } else if (cur && line.trim()) {
      cur.text += (cur.text ? " " : "") + line.trim();
    }
  }
  const segments = blocks
    .filter((b) => b.text)
    .map((b, i, all) => {
      const next = all[i + 1]?.start ?? durationSec;
      return { start: b.start, end: Math.max(b.start + 1, Math.min(next, b.start + 30)), text: `${b.speaker}: ${scrub(b.text)}` };
    });
  return { segments, durationSec: durationSec || (segments.at(-1)?.end ?? 0), plan };
}

/** 노션식 지도안 텍스트 → Lesson. 없는 칸은 비워 둔다. */
export function parsePlan(plan: string): Lesson {
  const clean = plan.replace(/<\/?aside>/g, "").replace(/\*\*/g, "");
  const title = /^#\s*(.+)$/m.exec(clean)?.[1].trim() || "제목 없는 수업";
  const section = (name: string) => {
    const m = new RegExp(`${name}[^\\n]*\\n+-{3,}\\n([\\s\\S]*?)(?=\\n\\S[^\\n]*\\n+-{3,}\\n|$)`).exec(clean);
    return m ? m[1] : "";
  };
  const bullets = (s: string) => s.split("\n").map((l) => /^\s*-\s+(.+)$/.exec(l)?.[1].trim()).filter((x): x is string => Boolean(x));

  const scenario = section("수업 시나리오");
  const steps: LessonStep[] = [];
  let step: LessonStep | null = null;
  for (const line of scenario.split("\n")) {
    const m = /^\s*(\d+)\s*분\s*~\s*(\d+)\s*분/.exec(line);
    if (m) {
      const minutes = Number(m[2]) - Number(m[1]);
      step = { stage: `${m[1]}~${m[2]}분`, stageMinutes: minutes, topic: "", minutes, teacher: [], student: [], materials: "", notes: [] };
      steps.push(step);
      continue;
    }
    const b = /^\s*-\s+(.+)$/.exec(line)?.[1].trim();
    if (b && step) {
      step.teacher.push(b);
      step.topic ||= b.replace(/[“”"]/g, "").slice(0, 40);
    }
  }
  const total = steps.reduce((a, s) => a + (s.minutes ?? 0), 0);
  return {
    no: 0,
    title,
    field: "과학",
    unit: "",
    method: "실험·만들기 활동",
    target: "초등",
    goals: bullets(section("학습 목표")),
    materials: { teacher: bullets(section("준비물")).join(", "), student: "" },
    durationMinutes: total || 60,
    steps,
    summary: bullets(section("핵심 개념")).join(" / "),
  };
}

function toMarkdown(lesson: Lesson, fb: Feedback, segs: number): string {
  const total = rubric.reduce((a, r) => {
    const s = fb.criteria[r.id]?.score;
    return s == null ? a : a + (s / 5) * r.weight;
  }, 0);
  const lines = [
    `# ${lesson.title} — AI 수업 피드백 (참고용)`,
    "",
    `> ${fb.basis}`,
    `> 검토 체크리스트 ${fb.review.checklistPassed}/8 통과 · 녹취 ${segs}문장`,
    "",
    `**판단 가능한 항목 기준 점수: ${Math.round(total)}점** (판단 불가 항목은 0점으로 빠져 있어요)`,
    "",
    "## 잘한 점",
    ...fb.strengths.map((s) => `- [${s.time}] ${s.text}${s.quote ? `\n  > ${s.quote}` : ""}`),
    "",
    "## 고칠 점 (영향 큰 순)",
    ...fb.improvements.map((s, i) => `${i + 1}. [${s.time}] ${s.text}\n   - 다음엔: ${s.suggestion}`),
    "",
    "## 항목별",
    "| 항목 | 점수 | 이유 |",
    "|---|---|---|",
    ...rubric.map((r) => {
      const c = fb.criteria[r.id];
      return `| ${r.name}${r.critical ? " (필수)" : ""} | ${c?.score ?? "판단 불가"} | ${(c?.reason ?? "").replace(/\|/g, "/").replace(/\n/g, " ")} |`;
    }),
    "",
    "## 항목별 다음 행동과 근거",
    ...rubric.flatMap((r) => {
      const c = fb.criteria[r.id];
      if (!c) return [];
      return [`### ${r.name} — ${c.score ?? "판단 불가"}`, ...c.evidence.map((e) => `- [${e.time}] "${e.quote}"`), c.nextAction ? `- **다음 행동**: ${c.nextAction}` : "", ""];
    }),
    "## 마무리",
    fb.closing,
    "",
    "## AI 자체 검토",
    ...(fb.review.notes ?? []).map((n) => `- ${n.passed ? "통과" : "미통과"} · ${n.name}: ${n.comment}`),
  ];
  return lines.join("\n");
}

async function main() {
  // 키·모델은 .env.local에서 읽는다(이미 설정된 환경 변수가 먼저)
  try {
    process.loadEnvFile(".env.local");
  } catch {}
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--redact");
  if (!file) throw new Error("녹취 txt 경로를 주세요.");
  const ri = args.indexOf("--redact");
  const redact = ri >= 0 ? args[ri + 1].split(",").map((s) => s.trim()).filter(Boolean) : [];

  const { segments, durationSec, plan } = parseClova(await fs.readFile(file, "utf-8"), redact);
  const lesson = parsePlan(plan);
  console.log(`녹취 ${segments.length}문장, ${mmss(durationSec)} · 지도안 「${lesson.title}」 단계 ${lesson.steps.length}개 · 목표 ${lesson.goals.length}개`);
  if (segments.length < 5) throw new Error("녹취 문장이 너무 적어요. 클로바노트 형식이 맞는지 확인해 주세요.");
  if (args.includes("--dry")) {
    // OpenAI로 보내지 않고 변환 결과만 확인한다
    console.log(JSON.stringify(lesson, null, 2));
    for (const seg of segments) console.log(`[${mmss(seg.start)}-${mmss(seg.end)}] ${seg.text}`);
    return;
  }

  const started = Date.now();
  const fb = await writeFeedback({
    lesson,
    segments,
    durationSec,
    timed: true,
    mode: "live",
    transcriptSource: "클로바노트 녹취",
    onStage: async (s) => console.log(`- ${s === "score" ? "채점" : "검토"} 중… (${Math.round((Date.now() - started) / 1000)}초)`),
  });

  const outDir = path.join(DATA_DIR, "external");
  await fs.mkdir(outDir, { recursive: true });
  const base = path.join(outDir, `${new Date().toISOString().slice(0, 10)}-${lesson.title.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40)}`);
  await fs.writeFile(`${base}.json`, JSON.stringify({ lesson, durationSec, feedback: fb }, null, 2), "utf-8");
  await fs.writeFile(`${base}.md`, toMarkdown(lesson, fb, segments.length), "utf-8");
  console.log(`완료 (${Math.round((Date.now() - started) / 1000)}초)\n${base}.md`);
}

if (!process.env.VITEST) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
