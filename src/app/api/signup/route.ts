import { isSecureRequest, sessionCookie } from "@/server/auth";
import { AccountError, registerUser, SIGNUP_ERRORS, type SignupError } from "@/server/users";

const go = (location: string, cookie?: string) =>
  new Response(null, { status: 303, headers: { Location: location, ...(cookie ? { "Set-Cookie": cookie } : {}) } });

/**
 * 가입 신청. 폼으로 name, email, password, password2를 받는다.
 * 보통은 승인 대기로 만들고 로그인 화면에 안내를 띄운다. 운영진 이메일(ADMIN_EMAILS)이면 바로 로그인시킨다.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "");
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const fail = (error: SignupError) => go(`/signup?${new URLSearchParams({ error, name, email })}`);

  if (password !== String(form.get("password2") ?? "")) return fail("mismatch");
  try {
    const user = await registerUser({ name, email, password });
    if (user.status === "active") return go("/", await sessionCookie(user, isSecureRequest(request)));
    return go(`/login?${new URLSearchParams({ signed: "1", email: user.email })}`);
  } catch (e) {
    if (e instanceof AccountError && e.code in SIGNUP_ERRORS) return fail(e.code as SignupError);
    throw e;
  }
}
