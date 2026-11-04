/** 파일 앞부분으로 실제 녹화 파일인지 확인한다. WebM(EBML) 또는 MP4(ftyp)만 받는다. */
export function looksLikeMedia(head: Uint8Array): boolean {
  const ebml = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
  const ftyp = head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70;
  return ebml || ftyp;
}
