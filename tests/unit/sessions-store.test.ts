// 서버 녹화 저장소: 기록 실패 시 파일 정리, 기록 없는 파일 정리.
// 실제 data/ 대신 임시 폴더를 쓴다(NOVALAB_DATA_DIR).
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

let dir = "";

async function loadStore() {
  dir = mkdtempSync(path.join(os.tmpdir(), "novalab-test-"));
  process.env.NOVALAB_DATA_DIR = dir;
  vi.resetModules(); // 모듈이 저장 폴더를 처음 불러올 때 정하므로 매번 새로 불러온다
  return import("@/server/sessions");
}

function webmStream(bytes = 4096) {
  const b = new Uint8Array(bytes).fill(7);
  b.set([0x1a, 0x45, 0xdf, 0xa3]);
  return new Blob([b]).stream();
}

const recordings = () => readdirSync(path.join(dir, "recordings"));

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.NOVALAB_DATA_DIR;
});

describe("세션 기록 저장 실패", () => {
  it("기록을 못 쓰면 옮긴 녹화 파일을 지우고, 고친 뒤 다시 올리면 파일은 하나만 남는다", async () => {
    const store = await loadStore();
    // sessions.json 자리에 폴더를 만들어 기록 쓰기를 일부러 실패시킨다
    mkdirSync(path.join(dir, "sessions.json"), { recursive: true });

    await expect(store.createSession({ lessonNo: 4, durationSec: 10, mimeType: "video/webm", body: webmStream(), maxBytes: 1e6, ownerId: "u1" })).rejects.toThrow();
    expect(recordings()).toEqual([]); // 남은 .webm·.part 없음

    rmSync(path.join(dir, "sessions.json"), { recursive: true });
    const key = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const first = await store.createSession({ lessonNo: 4, durationSec: 10, mimeType: "video/webm", body: webmStream(), maxBytes: 1e6, uploadKey: key, ownerId: "u1" });
    const again = await store.createSession({ lessonNo: 4, durationSec: 10, mimeType: "video/webm", body: webmStream(), maxBytes: 1e6, uploadKey: key, ownerId: "u1" });
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.session.id).toBe(first.session.id);
    expect(recordings()).toEqual([`${first.session.id}.webm`]);
  });
});

describe("기록 없는 녹화 파일 정리", () => {
  it("10분 넘게 기록 없이 남은 파일만 지운다", async () => {
    const store = await loadStore();
    const rec = path.join(dir, "recordings");
    mkdirSync(rec, { recursive: true });
    const kept = "11111111-1111-4111-8111-111111111111";
    writeFileSync(path.join(dir, "sessions.json"), JSON.stringify([{ id: kept, lessonNo: 1, createdAt: "2026-10-01T00:00:00Z", durationSec: 1, mimeType: "video/webm", status: "saved" }]));
    const old = Date.now() / 1000 - 3600;
    for (const name of [`${kept}.webm`, "old-orphan.webm", "new-orphan.webm"]) writeFileSync(path.join(rec, name), "x");
    utimesSync(path.join(rec, `${kept}.webm`), old, old);
    utimesSync(path.join(rec, "old-orphan.webm"), old, old);

    expect(await store.reconcileOrphans()).toEqual(["old-orphan.webm"]);
    expect(recordings().sort()).toEqual([`${kept}.webm`, "new-orphan.webm"].sort());
  });
});

describe("녹화 소유권", () => {
  const instructorA = { id: "a", name: "가짜 강사 A", email: "a@example.com", role: "instructor" as const };
  const instructorB = { id: "b", name: "가짜 강사 B", email: "b@example.com", role: "instructor" as const };
  const admin = { id: "z", name: "가짜 운영진", email: "z@example.com", role: "admin" as const };
  type V = typeof instructorA | typeof admin;

  it("강사는 본인 녹화만, 운영진은 모두 본다. 운영진의 진도(own)는 본인 것만", async () => {
    const store = await loadStore();
    const mine = await store.createSession({ lessonNo: 1, durationSec: 5, mimeType: "video/webm", body: webmStream(), maxBytes: 1e6, ownerId: "a" });
    const theirs = await store.createSession({ lessonNo: 2, durationSec: 5, mimeType: "video/webm", body: webmStream(), maxBytes: 1e6, ownerId: "b" });
    const ids = async (v: V, scope?: "own" | "visible") =>
      (await store.listSessions(v, scope))
        .filter((s) => !s.demo)
        .map((s) => s.id)
        .sort();

    expect(await ids(instructorA)).toEqual([mine.session.id]);
    expect(await ids(instructorB)).toEqual([theirs.session.id]);
    expect(await ids(admin)).toEqual([mine.session.id, theirs.session.id].sort());
    expect(await ids(admin, "own")).toEqual([]);

    expect(await store.getSession(theirs.session.id, instructorA)).toBeUndefined();
    expect((await store.getSession(theirs.session.id, admin))?.id).toBe(theirs.session.id);
  });

  it("같은 업로드 키라도 다른 강사의 녹화로 합쳐지지 않는다", async () => {
    const store = await loadStore();
    const key = "cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const a = await store.createSession({ lessonNo: 1, durationSec: 5, mimeType: "video/webm", body: webmStream(), maxBytes: 1e6, uploadKey: key, ownerId: "a" });
    const b = await store.createSession({ lessonNo: 1, durationSec: 5, mimeType: "video/webm", body: webmStream(), maxBytes: 1e6, uploadKey: key, ownerId: "b" });
    expect(b.created).toBe(true);
    expect(b.session.id).not.toBe(a.session.id);
  });
});
