// 강사·운영진 계정 저장소. data/users.json(git 제외, 배포에서는 영구 디스크)에 둔다.
//
// - 누구나 가입 신청할 수 있지만, 운영진이 승인하기 전(pending)에는 로그인할 수 없다.
// - ADMIN_EMAILS(쉼표 구분)에 적힌 이메일로 가입하면 바로 운영진(admin)이 된다. 첫 운영진을 만드는 방법이다.
// - 비밀번호는 scrypt로 바꿔 저장하고 원문은 어디에도 남기지 않는다.
// 이 파일은 proxy에서도 읽으므로 세션·분석 코드를 import하지 않는다.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { DATA_DIR } from "./dataDir";

export type Role = "admin" | "instructor";
export type UserStatus = "pending" | "active" | "disabled";

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // scrypt$salt$hash (hex)
  role: Role;
  status: UserStatus;
  createdAt: string;
  approvedAt?: string;
};

const USERS_FILE = () => path.join(DATA_DIR, "users.json");

export const MIN_PASSWORD = 8;

/** 가입 화면에 띄울 수 있는 오류. 주소창에는 코드만 넣고 문구는 여기서 고른다(임의 문구를 띄우지 못하게). */
export const SIGNUP_ERRORS = {
  mismatch: "두 비밀번호가 서로 달라요.",
  email: "이메일 형식이 올바르지 않아요.",
  name: "이름을 입력해 주세요.",
  short: `비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요.`,
  long: "비밀번호가 너무 길어요.",
  exists: "이미 가입한 이메일이에요. 로그인해 주세요.",
} as const;
export type SignupError = keyof typeof SIGNUP_ERRORS;

/** 강사 관리 화면에 띄울 수 있는 오류(가입 오류와 같은 이유로 코드로 주고받는다). */
export const ADMIN_ERRORS = {
  not_found: "계정을 찾을 수 없어요.",
  self: "본인의 운영진 권한은 직접 해제하거나 정지할 수 없어요.",
  last_admin: "운영진이 한 명은 남아 있어야 해요.",
  not_active: "승인된 계정만 운영진으로 지정할 수 있어요.",
  unknown: "알 수 없는 작업이에요.",
} as const;
export type AdminError = keyof typeof ADMIN_ERRORS;

export class AccountError extends Error {
  constructor(
    message: string,
    public code: SignupError | AdminError,
  ) {
    super(message);
  }
}
const signupError = (code: SignupError) => new AccountError(SIGNUP_ERRORS[code], code);
const adminError = (code: AdminError) => new AccountError(ADMIN_ERRORS[code], code);

// ---- 비밀번호 ----

const SCRYPT_KEYLEN = 32;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize("NFKC"), salt, SCRYPT_KEYLEN, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${(await scrypt(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, saltHex, hashHex] = stored.split("$");
  if (kind !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// 없는 이메일로 로그인해도 같은 시간이 걸리게 비교할 가짜 해시
let dummyHash: Promise<string> | null = null;

// ---- 저장 ----

// 읽을 때마다 파일을 다시 열지 않도록, 바뀐 시각이 같으면 이전에 읽은 목록을 쓴다(proxy가 요청마다 읽는다).
let cache: { mtimeMs: number; file: string; list: User[] } | null = null;

async function readUsers(): Promise<User[]> {
  const file = USERS_FILE();
  let st;
  try {
    st = await fs.stat(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  if (cache && cache.file === file && cache.mtimeMs === st.mtimeMs) return cache.list;
  // 파일이 깨졌으면 빈 목록으로 덮어쓰지 않도록 오류를 그대로 올린다.
  const list = JSON.parse(await fs.readFile(file, "utf-8")) as User[];
  cache = { mtimeMs: st.mtimeMs, file, list };
  return list;
}

async function writeUsers(list: User[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = USERS_FILE();
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf-8");
  await fs.rename(tmp, file);
  cache = null;
}

let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- 조회 ----

export async function listUsers(): Promise<User[]> {
  return [...(await readUsers())].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getUser(id: string): Promise<User | undefined> {
  return (await readUsers()).find((u) => u.id === id);
}

// ---- 가입·로그인 ----

/** 가입 신청. ADMIN_EMAILS에 있으면 바로 운영진으로, 아니면 승인 대기로 만든다. */
export async function registerUser(input: { email: string; name: string; password: string }): Promise<User> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim().slice(0, 40);
  if (!EMAIL_RE.test(email) || email.length > 200) throw signupError("email");
  if (!name) throw signupError("name");
  if (input.password.length < MIN_PASSWORD) throw signupError("short");
  if (input.password.length > 200) throw signupError("long");
  const passwordHash = await hashPassword(input.password);

  return withLock(async () => {
    const list = await readUsers();
    if (list.some((u) => u.email === email)) throw signupError("exists");
    const isAdmin = adminEmails().has(email);
    const now = new Date().toISOString();
    const user: User = {
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash,
      role: isAdmin ? "admin" : "instructor",
      status: isAdmin ? "active" : "pending",
      createdAt: now,
      ...(isAdmin ? { approvedAt: now } : {}),
    };
    await writeUsers([...list, user]);
    return user;
  });
}

/** 이메일·비밀번호가 맞으면 그 계정(상태와 상관없이), 아니면 null. */
export async function authenticate(email: string, password: string): Promise<User | null> {
  const user = (await readUsers()).find((u) => u.email === normalizeEmail(email));
  if (!user) {
    dummyHash ??= hashPassword("not-a-real-password");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  return (await verifyPassword(password, user.passwordHash)) ? user : null;
}

// ---- 운영진 작업 ----

export type AdminAction = "approve" | "disable" | "enable" | "make_admin" | "remove_admin";
export const ADMIN_ACTIONS: AdminAction[] = ["approve", "disable", "enable", "make_admin", "remove_admin"];

/** 운영진이 계정 상태·권한을 바꾼다. 마지막 운영진이 사라지는 변경은 막는다. */
export async function applyAdminAction(actorId: string, targetId: string, action: AdminAction): Promise<User> {
  return withLock(async () => {
    const list = await readUsers();
    const i = list.findIndex((u) => u.id === targetId);
    if (i < 0) throw adminError("not_found");
    const u = { ...list[i] };
    const losesAdmin = u.role === "admin" && u.status === "active" && (action === "disable" || action === "remove_admin");
    if (losesAdmin && targetId === actorId) throw adminError("self");
    if (losesAdmin && list.filter((x) => x.role === "admin" && x.status === "active").length <= 1)
      throw adminError("last_admin");

    switch (action) {
      case "approve":
      case "enable":
        u.status = "active";
        u.approvedAt ??= new Date().toISOString();
        break;
      case "disable":
        u.status = "disabled";
        break;
      case "make_admin":
        if (u.status !== "active") throw adminError("not_active");
        u.role = "admin";
        break;
      case "remove_admin":
        u.role = "instructor";
        break;
    }
    list[i] = u;
    await writeUsers(list);
    return u;
  });
}
