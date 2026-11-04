// 계정과 로그인: 가입 승인, 운영진 권한, 로그인 쿠키. 실제 data/ 대신 임시 폴더를 쓴다. 계정은 모두 가짜.
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

let dir = "";

async function load() {
  dir = mkdtempSync(path.join(os.tmpdir(), "novalab-auth-"));
  process.env.NOVALAB_DATA_DIR = dir;
  vi.resetModules(); // 모듈이 저장 폴더를 처음 불러올 때 정하므로 매번 새로 불러온다
  const users = await import("@/server/users");
  const auth = await import("@/server/auth");
  return { users, auth };
}

const h = (host: string, extra: Record<string, string> = {}) => new Headers({ host, ...extra });
const PW = "fake-password-1";

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  for (const k of ["NOVALAB_DATA_DIR", "ADMIN_EMAILS", "LOCAL_NO_LOGIN", "SESSION_SECRET", "NOVALAB_DEPLOYED"]) delete process.env[k];
});

describe("가입과 승인", () => {
  it("보통 가입은 승인 대기, ADMIN_EMAILS 이메일은 바로 운영진", async () => {
    process.env.ADMIN_EMAILS = "Boss@Example.com";
    const { users } = await load();
    const t = await users.registerUser({ email: "teacher@example.com", name: "가짜 강사", password: PW });
    const b = await users.registerUser({ email: "boss@example.com", name: "가짜 운영진", password: PW });
    expect([t.role, t.status]).toEqual(["instructor", "pending"]);
    expect([b.role, b.status]).toEqual(["admin", "active"]);
    expect(t.passwordHash).not.toContain(PW);
  });

  it("같은 이메일(대소문자 무시)은 다시 가입할 수 없고, 짧은 비밀번호는 거절한다", async () => {
    const { users } = await load();
    await users.registerUser({ email: "t@example.com", name: "가짜", password: PW });
    await expect(users.registerUser({ email: "T@example.com", name: "가짜", password: PW })).rejects.toMatchObject({ code: "exists" });
    await expect(users.registerUser({ email: "u@example.com", name: "가짜", password: "short" })).rejects.toMatchObject({ code: "short" });
  });

  it("비밀번호가 맞아야 계정을 돌려준다", async () => {
    const { users } = await load();
    await users.registerUser({ email: "t@example.com", name: "가짜", password: PW });
    expect(await users.authenticate("T@example.com", PW)).not.toBeNull();
    expect(await users.authenticate("t@example.com", "wrong-password")).toBeNull();
    expect(await users.authenticate("nobody@example.com", PW)).toBeNull();
  });
});

describe("운영진 작업", () => {
  it("승인·운영진 지정이 되고, 본인 권한과 마지막 운영진은 지킨다", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const { users } = await load();
    const boss = await users.registerUser({ email: "boss@example.com", name: "가짜 운영진", password: PW });
    const t = await users.registerUser({ email: "t@example.com", name: "가짜 강사", password: PW });

    await expect(users.applyAdminAction(boss.id, t.id, "make_admin")).rejects.toMatchObject({ code: "not_active" });
    expect((await users.applyAdminAction(boss.id, t.id, "approve")).status).toBe("active");
    await expect(users.applyAdminAction(boss.id, boss.id, "remove_admin")).rejects.toMatchObject({ code: "self" });
    expect((await users.applyAdminAction(boss.id, t.id, "make_admin")).role).toBe("admin");
    // 운영진이 둘이면 다른 운영진이 해제할 수 있다
    expect((await users.applyAdminAction(t.id, boss.id, "remove_admin")).role).toBe("instructor");
    // 이제 t가 마지막 운영진이라 정지할 수 없다
    await expect(users.applyAdminAction(boss.id, t.id, "disable")).rejects.toMatchObject({ code: "last_admin" });
  });
});

describe("로그인 쿠키", () => {
  it("승인된 계정만 쿠키로 들어오고, 정지하면 바로 막힌다", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const { users, auth } = await load();
    const boss = await users.registerUser({ email: "boss@example.com", name: "가짜 운영진", password: PW });
    const t = await users.registerUser({ email: "t@example.com", name: "가짜 강사", password: PW });
    const withCookie = async (u: typeof t) => h("x.example.com", { cookie: `other=1; ${auth.SESSION_COOKIE}=${await auth.sessionToken(u)}` });

    expect(await auth.viewerFrom(await withCookie(t))).toBeNull(); // 승인 전
    await users.applyAdminAction(boss.id, t.id, "approve");
    const approved = (await users.getUser(t.id))!;
    const headers = await withCookie(approved);
    expect((await auth.viewerFrom(headers))?.id).toBe(t.id);

    await users.applyAdminAction(boss.id, t.id, "disable");
    expect(await auth.viewerFrom(headers)).toBeNull();
  });

  it("서명을 바꾸거나 만료되면 거절한다", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const { users, auth } = await load();
    const boss = await users.registerUser({ email: "boss@example.com", name: "가짜", password: PW });
    const token = await auth.sessionToken(boss);
    const [id, exp, sig] = token.split(".");
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(await auth.userFromToken(`${id}.${exp}.${flipped}`)).toBeNull();
    expect(await auth.userFromToken(`${id}.${Number(exp) + 1}.${sig}`)).toBeNull();
    expect(await auth.userFromToken(token, (Number(exp) + 1) * 1000)).toBeNull();
    expect((await auth.userFromToken(token))?.id).toBe(boss.id);
  });

  it("LOCAL_NO_LOGIN은 이 컴퓨터에서 바로 연 요청에만 적용된다", async () => {
    const { auth } = await load();
    expect(await auth.viewerFrom(h("localhost:3000"))).toBeNull(); // 설정이 없으면 로그인 필요
    process.env.LOCAL_NO_LOGIN = "1";
    expect((await auth.viewerFrom(h("127.0.0.1:3000")))?.role).toBe("admin");
    expect(await auth.viewerFrom(h("novalab.example.com"))).toBeNull();
    process.env.NOVALAB_DEPLOYED = "1"; // 배포 이미지에서는 설정이 들어가도 무시
    expect(await auth.viewerFrom(h("127.0.0.1:3000"))).toBeNull();
  });

  it("권한: 운영진은 전부, 강사는 본인 것과 예시만", async () => {
    const { auth } = await load();
    const t = { id: "a", name: "", email: "", role: "instructor" as const };
    const admin = { ...t, id: "z", role: "admin" as const };
    expect(auth.canSee(t, { ownerId: "a" })).toBe(true);
    expect(auth.canSee(t, { ownerId: "b" })).toBe(false);
    expect(auth.canSee(t, {})).toBe(false); // 계정 기능 전 녹화
    expect(auth.canSee(t, { demo: true })).toBe(true);
    expect(auth.canSee(admin, { ownerId: "b" })).toBe(true);
  });

  it("next 경로는 이 사이트 안만 받는다", async () => {
    const { auth } = await load();
    expect(auth.safeNext("/feedback/1?x=1")).toBe("/feedback/1?x=1");
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "", undefined]) expect(auth.safeNext(bad)).toBe("/");
  });
});
