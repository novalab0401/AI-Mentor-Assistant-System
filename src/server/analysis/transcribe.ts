// 음성 조각을 OpenAI 음성 인식(Whisper)으로 글로 옮긴다.
// whisper-1은 문장별 시각을 주므로 근거 발언에 시각을 붙일 수 있다.
// gpt-4o-transcribe 계열은 시각을 주지 않아 조각 하나가 한 문장이 된다.
import { promises as fs } from "fs";
import path from "path";
import type { AudioPart } from "./audio";
import { aiConfig, AnalysisError, openaiFetch } from "./openai";
import type { Segment } from "./transcript";

type VerboseSegment = { start: number; end: number; text: string; no_speech_prob?: number; compression_ratio?: number };
type VerboseResult = { text: string; segments?: VerboseSegment[] };

/** 말소리가 아닐 가능성이 큰 문장(무음 구간에서 지어낸 문장 등)인지. */
function isNoise(s: VerboseSegment) {
  return (s.no_speech_prob ?? 0) > 0.6 || (s.compression_ratio ?? 0) > 2.4 || s.text.trim().length === 0;
}

export async function transcribe(parts: AudioPart[], hint: string): Promise<{ segments: Segment[]; timed: boolean }> {
  const { transcribeModel } = aiConfig();
  const timed = transcribeModel.startsWith("whisper");
  const segments: Segment[] = [];
  for (const part of parts) {
    const form = new FormData();
    const bytes = await fs.readFile(part.file);
    if (bytes.byteLength > 24 * 1024 * 1024) throw new AnalysisError("음성 조각이 너무 커서 인식할 수 없어요.");
    form.append("file", new Blob([bytes], { type: "audio/ogg" }), path.basename(part.file));
    form.append("model", transcribeModel);
    form.append("language", "ko");
    form.append("prompt", hint); // 수업 용어를 알려 주면 인식이 정확해진다
    if (timed) {
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "segment");
    } else {
      form.append("response_format", "json");
    }
    const res = (await openaiFetch("/audio/transcriptions", { body: form, timeoutMs: 10 * 60 * 1000 })) as VerboseResult;
    if (timed && res.segments) {
      for (const s of res.segments) {
        if (isNoise(s)) continue;
        segments.push({ start: part.offsetSec + s.start, end: part.offsetSec + s.end, text: s.text.trim() });
      }
    } else if (res.text?.trim()) {
      segments.push({ start: part.offsetSec, end: part.offsetSec, text: res.text.trim() });
    }
  }
  const chars = segments.reduce((n, s) => n + s.text.replace(/\s/g, "").length, 0);
  if (chars < 30) throw new AnalysisError("녹화에서 알아들을 수 있는 말소리가 거의 없어요. 마이크 상태를 확인하고 다시 녹화해 주세요.");
  return { segments, timed };
}
