import { describe, expect, it } from "vitest";
import { parseRange } from "@/server/range";
import { looksLikeMedia } from "@/server/media";

describe("parseRange (파일 크기 10000)", () => {
  const size = 10_000;
  it.each([
    ["bytes=0-99", { start: 0, end: 99 }],
    ["bytes=9900-", { start: 9900, end: 9999 }],
    ["bytes=-500", { start: 9500, end: 9999 }], // 마지막 500바이트
    ["bytes=-20000", { start: 0, end: 9999 }], // 파일보다 길면 처음부터
    ["bytes=9000-99999", { start: 9000, end: 9999 }], // 끝은 파일 끝으로 자름
  ])("%s", (header, expected) => {
    expect(parseRange(header, size)).toEqual(expected);
  });

  it.each(["bytes=20000-", "bytes=5-2", "bytes=-0"])("%s 는 범위 밖(416)", (header) => {
    expect(parseRange(header, size)).toBe("invalid");
  });

  it.each([null, "garbage", "bytes=-", "bytes=0-1,5-9", "items=0-9"])("%s 는 무시하고 전체 전송", (header) => {
    expect(parseRange(header, size)).toBeNull();
  });
});

describe("looksLikeMedia", () => {
  it("WebM(EBML) 시작 바이트를 받는다", () => {
    expect(looksLikeMedia(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]))).toBe(true);
  });
  it("MP4(ftyp)를 받는다", () => {
    expect(looksLikeMedia(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]))).toBe(true);
  });
  it("그 밖의 파일은 거절한다", () => {
    expect(looksLikeMedia(new TextEncoder().encode("<html>hello"))).toBe(false);
    expect(looksLikeMedia(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]))).toBe(false); // %PDF
  });
});
