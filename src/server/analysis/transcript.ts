// 녹취(시각이 붙은 문장 목록)를 다루는 순수 함수들. 외부 호출이 없어 단위 테스트로 확인한다.
import type { Evidence } from "@/lib/types";

/** 녹취 한 문장. start·end는 녹화 시작부터의 초. */
export type Segment = { start: number; end: number; text: string };

export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${String(m).padStart(2, "0")}:${r}`;
}

/** "mm:ss" 또는 "h:mm:ss"를 초로. 형식이 틀리면 null. */
export function parseTime(t: string): number | null {
  const m = /^\s*(?:(\d+):)?(\d{1,3}):(\d{2})\s*$/.exec(t ?? "");
  if (!m) return null;
  const [h, mi, s] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
  if (s >= 60) return null;
  return h * 3600 + mi * 60 + s;
}

/** 모델에 넘길 녹취 본문. 한 줄에 "[mm:ss] 문장". */
export function transcriptText(segs: Segment[]): string {
  return segs.map((s) => `[${mmss(s.start)}] ${s.text.trim()}`).join("\n");
}

const norm = (s: string) => s.replace(/[\s\p{P}\p{S}]/gu, "").toLowerCase();

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** 인용문의 글자쌍 중 녹취 구간에 있는 비율(0~1). 인용이 구간 안에 거의 그대로 있으면 1에 가깝다. */
function coverage(quote: string, text: string): number {
  if (text.includes(quote)) return 1;
  const q = bigrams(quote);
  const t = bigrams(text);
  let total = 0;
  let hit = 0;
  for (const [g, n] of q) {
    total += n;
    hit += Math.min(n, t.get(g) ?? 0);
  }
  return total === 0 ? 0 : hit / total;
}

const MIN_COVERAGE = 0.6;
const MAX_QUOTE = 90;

/**
 * 모델이 든 근거 발언이 실제 녹취에 있는지 확인한다.
 * 이어진 1~2문장 중 가장 잘 맞는 곳을 찾아, 시각은 녹취의 실제 시각으로 바로잡는다.
 * 인용이 녹취와 글자 그대로 같지 않으면 녹취 문장으로 바꾼다. 맞는 곳이 없으면 null(근거로 쓰지 않음).
 */
export function groundQuote(quote: string, claimedTime: string, segs: Segment[]): Evidence | null {
  const q = norm(quote);
  if (q.length < 4 || segs.length === 0) return null;
  const claimed = parseTime(claimedTime);
  const single = segs.map((s) => coverage(q, norm(s.text)));
  let best: { cov: number; dist: number; start: number; text: string } | null = null;
  for (let i = 0; i < segs.length; i++) {
    for (let w = 1; w <= 2 && i + w <= segs.length; w++) {
      const window = segs.slice(i, i + w);
      const text = window.map((s) => s.text.trim()).join(" ");
      const cov = w === 1 ? single[i] : coverage(q, norm(text));
      // 두 문장 구간은 인용이 실제로 두 문장에 걸칠 때만 쓴다(한 문장으로 충분하면 그 문장의 시각을 쓴다)
      if (w === 2 && cov <= Math.max(single[i], single[i + 1]) + 0.05) continue;
      const dist = claimed === null ? 0 : Math.abs(window[0].start - claimed);
      // 더 잘 맞는 곳, 같으면 모델이 말한 시각에 가까운 곳
      if (!best || cov > best.cov + 1e-9 || (Math.abs(cov - best.cov) < 1e-9 && dist < best.dist)) best = { cov, dist, start: window[0].start, text };
    }
  }
  if (!best || best.cov < MIN_COVERAGE) return null;
  const exact = norm(best.text).includes(q);
  const shown = exact ? quote.trim() : best.text.length > MAX_QUOTE ? `${best.text.slice(0, MAX_QUOTE)}…` : best.text;
  return { time: mmss(best.start), quote: shown };
}

/** 녹취 길이 안의 올바른 시각이면 "mm:ss"로 다듬어 돌려주고, 아니면 null. */
export function validTime(t: string, durationSec: number): string | null {
  const sec = parseTime(t);
  if (sec === null || sec > durationSec + 5) return null;
  return mmss(sec);
}
