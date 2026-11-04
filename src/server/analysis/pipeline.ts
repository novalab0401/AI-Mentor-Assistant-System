// 녹화 하나를 분석한다: 음성 추출 → 음성 인식 → 채점 → 검토.
// 요청에 바로 응답하고 분석은 서버에서 계속 돈다(직접 띄운 Node 서버 기준). 진행 상황은 세션 기록의 analysis에 남긴다.
// 녹취는 data/transcripts/에 저장해, 채점에서 실패하면 다시 시도할 때 음성 인식을 건너뛴다.
import { promises as fs } from "fs";
import path from "path";
import type { AnalysisStage, PracticeSession } from "@/lib/types";
import { getLesson } from "../content";
import { DATA_DIR, getSessionById, recordingPath, updateSession } from "../sessions";
import { extractAudio } from "./audio";
import { writeFeedback } from "./feedback";
import { aiConfig, aiConfigProblem, AnalysisError } from "./openai";
import { isAnalysisRunning, markRunning, markStopped, MAX_CONCURRENT_ANALYSES, runningCount } from "./registry";
import type { Segment } from "./transcript";
import { transcribe } from "./transcribe";

export type StartResult = "started" | "not_found" | "demo" | "no_recording" | "done" | "running" | "busy" | "not_configured";

const transcriptFile = (id: string) => path.join(DATA_DIR, "transcripts", `${id}.json`);
const workDir = (id: string) => path.join(DATA_DIR, "work", id);

type StoredTranscript = { model: string; timed: boolean; segments: Segment[] };

export async function startAnalysis(id: string): Promise<StartResult> {
  if (aiConfigProblem()) return "not_configured";
  const s = await getSessionById(id);
  if (!s) return "not_found";
  if (s.demo) return "demo";
  if (s.status === "done") return "done";
  if (isAnalysisRunning(id)) return "running";
  if (runningCount() >= MAX_CONCURRENT_ANALYSES) return "busy";
  const file = recordingPath(id);
  if (!file || !(await fs.stat(file).catch(() => null))) return "no_recording";

  markRunning(id);
  await updateSession(id, (x) => ({ ...x, status: "analyzing", analysis: { stage: "audio", startedAt: new Date().toISOString() } }));
  void run(s, file).finally(() => markStopped(id));
  return "started";
}

async function setStage(id: string, stage: AnalysisStage) {
  await updateSession(id, (x) => ({ ...x, analysis: { ...x.analysis!, stage } }));
}

async function run(s: PracticeSession, file: string) {
  const id = s.id;
  try {
    const lesson = getLesson(s.lessonNo);
    if (!lesson) throw new AnalysisError("차시 정보를 찾지 못했어요.");

    let transcript = await readTranscript(id);
    if (!transcript) {
      const parts = await extractAudio(file, workDir(id));
      await setStage(id, "transcribe");
      const hint = `${lesson.title}. ${lesson.goals.join(" ")}`.slice(0, 400);
      const { segments, timed } = await transcribe(parts, hint);
      transcript = { model: aiConfig().transcribeModel, timed, segments };
      await fs.mkdir(path.dirname(transcriptFile(id)), { recursive: true });
      await fs.writeFile(transcriptFile(id), JSON.stringify(transcript), "utf-8");
      await fs.rm(workDir(id), { recursive: true, force: true });
    }

    const last = transcript.segments.at(-1);
    const durationSec = Math.max(s.durationSec, last ? Math.ceil(last.end) : 0);
    const feedback = await writeFeedback({
      lesson,
      segments: transcript.segments,
      durationSec,
      timed: transcript.timed,
      onStage: (stage) => setStage(id, stage),
    });
    await updateSession(id, (x) => ({ ...x, status: "done", feedback, analysis: { ...x.analysis!, finishedAt: new Date().toISOString(), error: undefined } }));
  } catch (e) {
    const message = e instanceof AnalysisError ? e.message : "분석 중 알 수 없는 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";
    if (!(e instanceof AnalysisError)) console.error("[analysis] 예상하지 못한 오류", e);
    await fs.rm(workDir(id), { recursive: true, force: true }).catch(() => {});
    await updateSession(id, (x) => ({ ...x, status: "failed", analysis: { ...x.analysis!, finishedAt: new Date().toISOString(), error: message } })).catch(() => {});
  }
}

async function readTranscript(id: string): Promise<StoredTranscript | null> {
  try {
    const t = JSON.parse(await fs.readFile(transcriptFile(id), "utf-8")) as StoredTranscript;
    // 음성 인식 모델을 바꿨으면 다시 인식한다
    return t.model === aiConfig().transcribeModel && t.segments?.length ? t : null;
  } catch {
    return null;
  }
}
