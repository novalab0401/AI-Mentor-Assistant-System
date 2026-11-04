export type ByteRange = { start: number; end: number } | "invalid" | null;

/**
 * Range 헤더를 해석한다. 한 구간만 지원한다.
 *   bytes=100-199  앞에서 100~199
 *   bytes=100-     100부터 끝까지
 *   bytes=-500     마지막 500바이트
 * 형식이 틀렸으면 무시하고(null) 전체를 보내고, 범위가 파일 밖이면 "invalid"(416).
 */
export function parseRange(header: string | null, size: number): ByteRange {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (!Number.isSafeInteger(suffix) || suffix === 0) return "invalid";
    return { start: Math.max(size - suffix, 0), end: size - 1 };
  }
  const start = Number(m[1]);
  const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return "invalid";
  return { start, end };
}
