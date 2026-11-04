// 로그인 확인. 녹화에는 강사 얼굴·목소리(학생 목소리 포함 가능)가 담기므로 승인된 계정만 들어온다.
//
// - 로그인하면 서명한 쿠키(novalab_session)를 심는다. 값 = 계정 ID.만료시각.서명
//   서명 키는 SESSION_SECRET, 없으면 data/.session-secret을 처음 한 번 만들어 쓴다.
// - 요청마다 계정 기록을 다시 확인하므로, 운영진이 정지하면 바로 못 들어온다.
// - LOCAL_NO_LOGIN=1이면 이 컴퓨터에서 연 요청은 로그인 없이 "로컬 관리자"로 들어온다(개발·테스트용).
//   배포 설정에는 절대 넣지 않는다. 실수로 넣어도 배포 이미지(NOVALAB_DEPLOYED=1)에서는 무시한다.
//   (x-forwarded-* 로는 구분할 수 없다. Next 서버가 로컬 요청에도 이 헤더를 붙인다.)
// 이 파일은 proxy에서도 쓰므로 세션·분석 코드를 import하지 않는다.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { DATA_DIR } from "./dataDir";
import { getUser, type Role, type User } from "./users";

export const SESSION_COOKIE = "novalab_session";
export const SESSION_DAYS = 30;
export const LOGIN_REQUIRED_MESSAGE = "로그인이 필요해요.";

export type Viewer = { id: string; name: string; email: string; role: Role; local?: boolean };

const LOCAL_VIEWER: Viewer = { id: "local", name: "로컬 관리자", email: "local@localhost", role: "admin", local: true };
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

// ---- 서명 키 ----

let secretPromise: Promise<Buffer> | null = null;

async function loadSecret(): Promise<Buffer> {
  if (process.env.SESSION_SECRET) return Buffer.from(process.env.SESSION_SECRET);
  const file = path.join(DATA_DIR, ".session-secret");
  try {
    return Buffer.from((await fs.readFile(file, "utf-8")).trim(), "hex");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const fresh = crypto.randomBytes(32).toString("hex");
  try {
    await fs.writeFile(file, fresh, { encoding: "utf-8", mode: 0o600, flag: "wx" });
    return Buffer.from(fresh, "hex");
  } catch {
    // 동시에 다른 요청이 먼저 만들었으면 그 값을 쓴다
    return Buffer.from((await fs.readFile(file, "utf-8")).trim(), "hex");
  }
}

function secret() {
  secretPromise ??= loadSecret().catch((e) => {
    secretPromise = null;
    throw e;
  });
  return secretPromise;
}

/** 비밀번호가 바뀌면 이전 로그인 쿠키가 무효가 되도록 서명에 섞는 값. */
const passwordTag = (u: User) => crypto.createHash("sha256").update(u.passwordHash).digest("hex").slice(0, 16);

async function sign(payload: string) {
  return crypto.createHmac("sha256", await secret()).update(payload).digest("base64url");
}

function sameText(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---- 쿠키 ----

export async function sessionToken(user: User, now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + SESSION_DAYS * 24 * 3600;
  return `${user.id}.${exp}.${await sign(`${user.id}.${exp}.${passwordTag(user)}`)}`;
}

export async function sessionCookie(user: User, secure: boolean): Promise<string> {
  return [`${SESSION_COOKIE}=${await sessionToken(user)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${SESSION_DAYS * 24 * 3600}`, ...(secure ? ["Secure"] : [])].join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  return [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0", ...(secure ? ["Secure"] : [])].join("; ");
}

export function isSecureRequest(req: Request) {
  return new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

function cookieFrom(headers: Headers, name: string): string | undefined {
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** 쿠키가 가리키는 승인된 계정. 서명·만료·계정 상태 중 하나라도 어긋나면 null. */
export async function userFromToken(token: string | undefined, now = Date.now()): Promise<User | null> {
  if (!token) return null;
  const [id, expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!id || !sig || !Number.isFinite(exp) || exp * 1000 < now) return null;
  const user = await getUser(id);
  if (!user || user.status !== "active") return null;
  return sameText(sig, await sign(`${id}.${exp}.${passwordTag(user)}`)) ? user : null;
}

function isLocalBypass(headers: Headers) {
  if (process.env.LOCAL_NO_LOGIN !== "1" || process.env.NOVALAB_DEPLOYED === "1") return false;
  const host = (headers.get("host") ?? "").replace(/:\d+$/, "");
  return LOCAL_HOSTS.has(host);
}

/** 지금 요청한 사람. 로그인 안 했으면 null. */
export async function viewerFrom(headers: Headers): Promise<Viewer | null> {
  const user = await userFromToken(cookieFrom(headers, SESSION_COOKIE));
  if (user) return { id: user.id, name: user.name, email: user.email, role: user.role };
  return isLocalBypass(headers) ? LOCAL_VIEWER : null;
}

/** 라우트 핸들러용: 로그인했으면 그 사람, 아니면 401 응답. */
export async function requireViewer(req: Request): Promise<Viewer | Response> {
  return (await viewerFrom(req.headers)) ?? Response.json({ error: LOGIN_REQUIRED_MESSAGE }, { status: 401 });
}

/** 이 사람이 이 녹화를 볼 수 있는지. 운영진은 전부, 강사는 본인 것만. 예시 세션은 모두에게 보인다. */
export function canSee(viewer: Viewer, s: { ownerId?: string; demo?: boolean }) {
  return Boolean(s.demo) || viewer.role === "admin" || s.ownerId === viewer.id;
}

/** 다른 사이트로 보내지 않게 이 사이트 안의 경로만 받는다. */
export function safeNext(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return /^\/(?![/\\])/.test(s) ? s : "/";
}
