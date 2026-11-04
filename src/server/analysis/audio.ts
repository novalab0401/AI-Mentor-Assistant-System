// 녹화(영상+음성)에서 음성만 뽑아 작은 파일로 만든다.
// Whisper는 한 번에 25MB까지 받으므로 16kHz 모노 Opus 24kbps(1분에 약 0.2MB)로 줄이고 20분씩 나눈다.
import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { AnalysisError } from "./openai";

const SEGMENT_SEC = 20 * 60;

function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require("ffmpeg-static") as string | null;
  if (!p) throw new AnalysisError("음성 추출 도구(ffmpeg)를 찾지 못했어요. npm install을 다시 실행해 주세요.");
  return p;
}

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath(), args, { timeout: 10 * 60 * 1000, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (err, _out, stderr) => {
      if (!err) return resolve();
      if (/matches no streams|does not contain any stream|Output file does not contain/i.test(stderr)) {
        reject(new AnalysisError("녹화에 음성이 없어요. 마이크를 켜고 다시 녹화해 주세요."));
        return;
      }
      console.error(`[analysis] ffmpeg 실패: ${stderr.split("\n").slice(-6).join(" | ")}`);
      reject(new AnalysisError("녹화에서 음성을 뽑지 못했어요. 녹화 파일이 손상됐을 수 있어요."));
    });
  });
}

export type AudioPart = { file: string; offsetSec: number };

/** workDir에 음성 조각들을 만들고 시작 시각과 함께 돌려준다. */
export async function extractAudio(input: string, workDir: string): Promise<AudioPart[]> {
  await fs.rm(workDir, { recursive: true, force: true });
  await fs.mkdir(workDir, { recursive: true });
  const list = path.join(workDir, "parts.csv");
  await run([
    "-hide_banner", "-nostdin", "-y",
    "-i", input,
    "-map", "0:a:0", "-vn",
    "-ac", "1", "-ar", "16000",
    "-c:a", "libopus", "-b:a", "24k", "-application", "voip",
    "-f", "segment", "-segment_time", String(SEGMENT_SEC), "-reset_timestamps", "1",
    "-segment_list", list, "-segment_list_type", "csv",
    path.join(workDir, "part_%03d.ogg"),
  ]);
  // parts.csv: 파일이름,시작초,끝초
  const rows = (await fs.readFile(list, "utf-8")).trim().split(/\r?\n/).filter(Boolean);
  const parts = rows.map((r) => {
    const [name, start] = r.split(",");
    return { file: path.join(workDir, name), offsetSec: Number(start) || 0 };
  });
  if (parts.length === 0) throw new AnalysisError("녹화에 음성이 없어요. 마이크를 켜고 다시 녹화해 주세요.");
  return parts;
}
