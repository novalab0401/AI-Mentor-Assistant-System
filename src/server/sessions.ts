// 모의수업 녹화 세션 저장소.
// 지금은 로컬 파일(data/, git 제외)에 저장한다. 배포 단계에서 Supabase(DB + Storage)로 바꾼다.
// 녹화에는 강사의 얼굴과 목소리가 담기므로 data/ 밖에 두지 않는다.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { PracticeSession } from "@/lib/types";
import { DEMO_SESSIONS } from "./demo-sessions";
import { looksLikeMedia } from "./media";
import { isAnalysisRunning } from "./analysis/registry";
import { canSee, type Viewer } from "./auth";

import { DATA_DIR } from "./dataDir";

export { DATA_DIR };
const REC_DIR = path.join(DATA_DIR, "recordings");
const DB_FILE = path.join(DATA_DIR, "sessions.json");

async function readStored(): Promise<PracticeSession[]> {
  let raw: string;
  try {
    raw = await fs.readFile(DB_FILE, "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; // 아직 녹화가 없음
    throw e;
  }
  // 파일이 깨졌으면 빈 목록으로 덮어쓰지 않도록 오류를 그대로 올린다.
  const list = JSON.parse(raw) as PracticeSession[];
  // 예전 기록의 "analyzing"(분석 정보 없음)은 실제로는 저장만 된 상태다
  return list.map((x) => (x.status === "analyzing" && !x.analysis ? { ...x, status: "saved" } : x));
}

/** 분석 중으로 기록돼 있지만 실제로 돌고 있지 않으면(서버 재시작 등) 실패로 보여 준다. */
function withLiveStatus(s: PracticeSession): PracticeSession {
  if (s.status !== "analyzing" || isAnalysisRunning(s.id)) return s;
  return { ...s, status: "failed", analysis: { ...s.analysis!, error: "서버가 다시 시작돼서 분석이 멈췄어요. 다시 시도해 주세요." } };
}

/** 임시 파일에 쓴 뒤 이름을 바꿔, 읽는 쪽이 반쯤 쓴 파일을 보지 않게 한다. */
async function writeStored(list: PracticeSession[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf-8");
  await fs.rename(tmp, DB_FILE);
}

// 세션 기록의 읽기-수정-쓰기를 한 번에 하나씩만 실행한다(단일 서버 프로세스 기준).
// 여러 서버로 늘리면 DB(Supabase) 트랜잭션으로 바꾼다.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

/** 최신순 전체 세션 (예시 세션 포함). 권한 확인을 하지 않으므로 화면·API에서는 listSessions를 쓴다. */
export async function listAllSessions(): Promise<PracticeSession[]> {
  await reconcileOnce();
  const all = [...(await readStored()).map(withLiveStatus), ...DEMO_SESSIONS];
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 권한 확인 없이 ID로 찾는다(분석 파이프라인용). 화면·API에서는 getSession을 쓴다. */
export async function getSessionById(id: string): Promise<PracticeSession | undefined> {
  return (await listAllSessions()).find((s) => s.id === id);
}

/**
 * 이 사람이 볼 수 있는 세션. scope "own"은 본인 녹화(+예시)만이고, 운영진도 본인 연습 기록만 본다(홈·진도용).
 * "visible"은 운영진이면 모든 강사의 녹화, 강사면 본인 것.
 */
export async function listSessions(viewer: Viewer, scope: "own" | "visible" = "visible"): Promise<PracticeSession[]> {
  const all = await listAllSessions();
  return all.filter((s) => (scope === "own" ? s.demo || s.ownerId === viewer.id : canSee(viewer, s)));
}

/** 이 사람이 볼 수 있으면 그 세션, 아니면 undefined(없는 것과 똑같이 다뤄 다른 강사의 녹화 ID가 있는지도 드러내지 않는다). */
export async function getSession(id: string, viewer: Viewer): Promise<PracticeSession | undefined> {
  const s = await getSessionById(id);
  return s && canSee(viewer, s) ? s : undefined;
}

/** 세션 기록 하나를 고친다. 없으면 null. */
export async function updateSession(id: string, fn: (s: PracticeSession) => PracticeSession): Promise<PracticeSession | null> {
  return withLock(async () => {
    const list = await readStored();
    const i = list.findIndex((s) => s.id === id);
    if (i < 0) return null;
    list[i] = fn(list[i]);
    await writeStored(list);
    return list[i];
  });
}

export type UploadRejection = "too_large" | "empty" | "not_media" | "quota" | "disk" | "busy" | "in_progress";

/** 업로드를 받지 않는 이유. 라우트가 상태 코드와 문구로 바꾼다. */
export class UploadRejected extends Error {
  constructor(public reason: UploadRejection) {
    super(reason);
  }
}

// 저장 한도. 로그인이 생기면 사용자별 한도로 바꾼다.
const GB = 1024 ** 3;
const QUOTA_BYTES = (Number(process.env.RECORDINGS_QUOTA_GB) || 20) * GB; // 녹화 전체 보관 한도
const FREE_RESERVE_BYTES = 2 * GB; // 디스크에 항상 남겨 둘 여유
const MAX_CONCURRENT_UPLOADS = 2;
const STALE_PART_MS = 60 * 60 * 1000; // 1시간 넘은 받다 만 파일은 지운다

let activeUploads = 0;
const uploadingKeys = new Set<string>(); // 지금 받고 있는 업로드 키

async function recordingsBytes(): Promise<number> {
  let total = 0;
  for (const name of await fs.readdir(REC_DIR).catch(() => [] as string[])) {
    const st = await fs.stat(path.join(REC_DIR, name)).catch(() => null);
    if (st?.isFile()) total += st.size;
  }
  return total;
}

const ORPHAN_AGE_MS = 10 * 60 * 1000; // 기록 직전의 정상 업로드와 겹치지 않게 10분 지난 것만

/**
 * 어떤 세션 기록에도 없는 녹화 파일을 지운다.
 * 영상 파일을 옮긴 뒤 기록을 확정하기 전에 서버가 꺼지면 이런 파일이 남는다.
 */
export async function reconcileOrphans(now = Date.now()): Promise<string[]> {
  const known = new Set((await readStored()).map((s) => `${s.id}.webm`));
  const removed: string[] = [];
  for (const name of await fs.readdir(REC_DIR).catch(() => [] as string[])) {
    if (!name.endsWith(".webm") || known.has(name)) continue;
    const full = path.join(REC_DIR, name);
    const st = await fs.stat(full).catch(() => null);
    if (st && now - st.mtimeMs > ORPHAN_AGE_MS) {
      await fs.rm(full, { force: true });
      removed.push(name);
    }
  }
  return removed;
}

// 서버가 켜진 뒤 처음 녹화를 다룰 때 한 번만 정리한다
let reconciled: Promise<unknown> | null = null;
function reconcileOnce() {
  reconciled ??= withLock(() => reconcileOrphans()).catch(() => {});
  return reconciled;
}

/** 서버가 꺼졌거나 연결이 끊겨 남은 .part 파일을 정리한다. */
async function cleanStaleParts() {
  const now = Date.now();
  for (const name of await fs.readdir(REC_DIR).catch(() => [] as string[])) {
    if (!name.endsWith(".part")) continue;
    const full = path.join(REC_DIR, name);
    const st = await fs.stat(full).catch(() => null);
    if (st && now - st.mtimeMs > STALE_PART_MS) await fs.rm(full, { force: true });
  }
}

/**
 * 업로드 본문을 메모리에 다 올리지 않고 디스크에 조금씩 받아 적는다.
 * 받기 전에 동시 업로드 수, 보관 한도, 디스크 여유를 확인하고,
 * 받는 중에는 파일 형식과 크기를 확인해 어긋나면 바로 중단하고 임시 파일을 지운다.
 */
export async function createSession(input: {
  lessonNo: number;
  durationSec: number;
  mimeType: string;
  body: ReadableStream<Uint8Array>;
  maxBytes: number;
  uploadKey?: string;
  ownerId: string;
}): Promise<{ session: PracticeSession; created: boolean }> {
  const key = input.uploadKey;
  const sameUpload = (s: PracticeSession) => s.uploadKey === key && s.ownerId === input.ownerId;
  // 같은 키로 이미 저장됐으면(응답을 못 받고 다시 올린 경우 등) 새로 저장하지 않고 그 세션을 돌려준다
  if (key) {
    const existing = (await readStored()).find(sameUpload);
    if (existing) {
      await input.body.cancel().catch(() => {});
      return { session: existing, created: false };
    }
    if (uploadingKeys.has(key)) throw new UploadRejected("in_progress");
  }
  if (activeUploads >= MAX_CONCURRENT_UPLOADS) throw new UploadRejected("busy");
  activeUploads++;
  if (key) uploadingKeys.add(key);
  try {
    await fs.mkdir(REC_DIR, { recursive: true });
    await reconcileOnce();
    await cleanStaleParts();

    // 이번 업로드가 최대 크기여도 한도와 여유 공간을 넘지 않는지 미리 본다
    if ((await recordingsBytes()) + input.maxBytes > QUOTA_BYTES) throw new UploadRejected("quota");
    const disk = await fs.statfs(REC_DIR).catch(() => null);
    if (disk && disk.bavail * disk.bsize < input.maxBytes + FREE_RESERVE_BYTES) throw new UploadRejected("disk");

    const id = crypto.randomUUID();
    const finalPath = path.join(REC_DIR, `${id}.webm`);
    const partPath = `${finalPath}.part`;
    const handle = await fs.open(partPath, "w");
    const reader = input.body.getReader();
    let received = 0;
    let head = new Uint8Array(0);
    let checked = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > input.maxBytes) throw new UploadRejected("too_large");
        if (!checked) {
          const merged = new Uint8Array(head.length + value.byteLength);
          merged.set(head);
          merged.set(value, head.length);
          head = merged.subarray(0, 16);
          if (head.length >= 8) {
            if (!looksLikeMedia(head)) throw new UploadRejected("not_media");
            checked = true;
          }
        }
        await handle.write(value);
      }
      if (received === 0) throw new UploadRejected("empty");
      if (!checked) throw new UploadRejected("not_media");
    } catch (e) {
      await reader.cancel().catch(() => {});
      await handle.close();
      await fs.rm(partPath, { force: true });
      throw e;
    }
    await handle.close();
    await fs.rename(partPath, finalPath);

    const session: PracticeSession = {
      id,
      lessonNo: input.lessonNo,
      createdAt: new Date().toISOString(),
      durationSec: input.durationSec,
      mimeType: input.mimeType,
      status: "saved",
      ownerId: input.ownerId,
      ...(key ? { uploadKey: key } : {}),
    };
    // 기록할 때 한 번 더 확인한다(그 사이 같은 키가 저장됐으면 방금 받은 파일은 버린다)
    let result: { session: PracticeSession; created: boolean };
    try {
      result = await withLock(async () => {
        const list = await readStored();
        const dup = key ? list.find(sameUpload) : undefined;
        if (dup) return { session: dup, created: false };
        await writeStored([session, ...list]);
        return { session, created: true };
      });
    } catch (e) {
      // 기록에 실패하면 어떤 세션에도 속하지 않는 파일이 되므로 지운다(보관 한도만 차지하지 않게)
      await fs.rm(finalPath, { force: true });
      throw e;
    }
    if (!result.created) await fs.rm(finalPath, { force: true });
    return result;
  } finally {
    activeUploads--;
    if (key) uploadingKeys.delete(key);
  }
}

export function recordingPath(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null; // 경로 조작 방지
  return path.join(REC_DIR, `${id}.webm`);
}
