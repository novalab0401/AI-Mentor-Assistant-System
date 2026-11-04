// 제출 전 녹화를 브라우저(IndexedDB)에 임시 저장한다.
// 화면 이동·새로고침·탭 종료로 녹화가 사라지지 않게 하는 용도다.
// 녹화마다 고유 ID를 써서 탭끼리 조각이 섞이지 않게 하고, 같은 차시는 한 탭만 녹화하도록 잠금(lease)을 건다.
// 임시 녹화는 자동으로 지우지 않는다. 제출에 성공했거나 사용자가 직접 지운 녹화만 지운다.
// 녹화는 이 브라우저에만 남고, 제출에 성공하면 지운다.

export type DraftMeta = {
  id: string; // 녹화마다 고유
  lessonNo: number;
  startedAt: string; // ISO
  durationSec: number;
  mimeType: string;
  chunkCount: number;
  finished: boolean; // 녹화 끝내기까지 갔는지
};

const DB_NAME = "novalab-recorder";
const VERSION = 2; // v2: 녹화별 고유 ID + 차시 색인

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1은 차시별 고정 ID라 구조가 달라서 새로 만든다
      for (const name of [...db.objectStoreNames]) db.deleteObjectStore(name);
      const drafts = db.createObjectStore("drafts", { keyPath: "id" });
      drafts.createIndex("byLesson", "lessonNo");
      const chunks = db.createObjectStore("chunks", { keyPath: ["draftId", "seq"] });
      chunks.createIndex("byDraft", "draftId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removeDrafts(db: IDBDatabase, ids: string[]) {
  if (ids.length === 0) return;
  const tx = db.transaction(["drafts", "chunks"], "readwrite");
  const chunks = tx.objectStore("chunks");
  for (const id of ids) {
    tx.objectStore("drafts").delete(id);
    const keys = await request(chunks.index("byDraft").getAllKeys(IDBKeyRange.only(id)));
    for (const k of keys) chunks.delete(k);
  }
  await done(tx);
}

async function draftsOf(db: IDBDatabase, lessonNo: number): Promise<DraftMeta[]> {
  return (await request(db.transaction("drafts").objectStore("drafts").index("byLesson").getAll(IDBKeyRange.only(lessonNo)))) as DraftMeta[];
}

export type Release = () => void;

/** Web Locks로 이름 붙은 잠금을 얻는다. 다른 탭이 쥐고 있으면 null. 지원하지 않는 브라우저에서는 잠금 없이 진행한다. */
function acquire(name: string): Promise<Release | null> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return Promise.resolve(() => {});
  return new Promise((resolve) => {
    navigator.locks
      .request(name, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return;
        }
        // 해제 함수를 부를 때까지 잠금을 쥐고 있는다
        return new Promise<void>((release) => resolve(() => release()));
      })
      .catch(() => resolve(() => {}));
  });
}

const DRAFT_LOCK = "novalab-draft-";

/** 같은 차시를 한 탭에서만 녹화하도록 잠근다. 녹화를 멈추면 푼다. */
export function acquireLease(lessonNo: number): Promise<Release | null> {
  return acquire(`novalab-recording-lesson-${lessonNo}`);
}

/**
 * 임시 녹화 하나를 이 탭이 쓴다고 잠근다. 녹화 → 다시 보기 → 제출(또는 지우기)이 끝날 때까지 쥔다.
 * 다른 탭이 녹화 중이거나 다시 보는 중인 녹화를 복구·제출·삭제하지 못하게 하려는 것이다.
 */
export function acquireDraftLock(id: string): Promise<Release | null> {
  return acquire(DRAFT_LOCK + id);
}

/** 지금 다른 탭(또는 이 탭)이 쥐고 있는 임시 녹화 ID들. */
export async function lockedDraftIds(): Promise<Set<string>> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return new Set();
  const { held = [] } = await navigator.locks.query();
  return new Set(held.map((l) => l.name ?? "").filter((n) => n.startsWith(DRAFT_LOCK)).map((n) => n.slice(DRAFT_LOCK.length)));
}

/**
 * 새 녹화를 시작한다. 다른 임시 녹화는 지우지 않는다.
 * id는 부르는 쪽이 먼저 만들어 잠근 뒤 넘긴다(목록에 보이기 전에 잠금이 걸려 있게).
 */
export async function startDraft(id: string, lessonNo: number, mimeType: string): Promise<DraftMeta> {
  const db = await open();
  const meta: DraftMeta = { id, lessonNo, startedAt: new Date().toISOString(), durationSec: 0, mimeType, chunkCount: 0, finished: false };
  const tx = db.transaction("drafts", "readwrite");
  tx.objectStore("drafts").put(meta);
  await done(tx);
  db.close();
  return meta;
}

/** 임시 녹화 하나의 최신 정보. 이미 제출됐거나 지워졌으면 null. */
export async function getDraft(id: string): Promise<DraftMeta | null> {
  const db = await open();
  const meta = (await request(db.transaction("drafts").objectStore("drafts").get(id))) as DraftMeta | undefined;
  db.close();
  return meta && meta.chunkCount > 0 ? meta : null;
}

/** 녹화 조각 하나를 저장하고 길이를 갱신한다. */
export async function appendChunk(meta: DraftMeta, seq: number, data: Blob, durationSec: number, finished = false) {
  const db = await open();
  const tx = db.transaction(["chunks", "drafts"], "readwrite");
  if (data.size > 0) {
    tx.objectStore("chunks").put({ draftId: meta.id, seq, data });
    meta.chunkCount = Math.max(meta.chunkCount, seq + 1);
  }
  meta.durationSec = durationSec;
  meta.finished = meta.finished || finished;
  tx.objectStore("drafts").put(meta);
  await done(tx);
  db.close();
}

/**
 * 이 차시의 제출 안 한 녹화들(최신순).
 * 조각이 없는 녹화는 빼되, 다른 탭이 지금 녹화 중인 것(includeIds)은 넣는다. 막 시작한 녹화도 '쓰는 중'으로 보이게.
 */
export async function getDrafts(lessonNo: number, includeIds: Set<string> = new Set()): Promise<DraftMeta[]> {
  const db = await open();
  const list = (await draftsOf(db, lessonNo)).filter((d) => d.chunkCount > 0 || includeIds.has(d.id));
  db.close();
  return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** 저장된 조각을 순서대로 이어 붙여 영상 파일로 만든다. */
export async function loadDraftBlob(meta: DraftMeta): Promise<Blob> {
  const db = await open();
  const rows = (await request(db.transaction("chunks").objectStore("chunks").index("byDraft").getAll(IDBKeyRange.only(meta.id)))) as {
    seq: number;
    data: Blob;
  }[];
  db.close();
  rows.sort((a, b) => a.seq - b.seq);
  return new Blob(
    rows.map((r) => r.data),
    { type: meta.mimeType || "video/webm" },
  );
}

export async function deleteDraft(id: string) {
  const db = await open();
  await removeDrafts(db, [id]);
  db.close();
}
