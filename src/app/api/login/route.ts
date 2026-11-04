import { isSecureRequest, safeNext, sessionCookie } from "@/server/auth";
import { authenticate } from "@/server/users";

const back = (q: Record<string, string>) => new Response(null, { status: 303, headers: { Location: `/login?${new URLSearchParams(q)}` } });

/**
 * 이메일 로그인. 폼(application/x-www-form-urlencoded)으로 email, password, next를 받는다.
 * 승인된 계정이면 로그인 쿠키를 심고 next로, 아니면 이유와 함께 /login으로 돌려보낸다.
 * 배포 서버 앞단 프록시 뒤에서는 request.url의 호스트가 내부 주소일 수 있어 상대 경로로 보낸다.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  const keep = { ...(next !== "/" ? { next } : {}), ...(email ? { email } : {}) };

  const user = await authenticate(email, password);
  if (!user) {
    await new Promise((r) => setTimeout(r, 800)); // 비밀번호를 빠르게 여러 번 넣어 보는 것을 늦춘다
    return back({ error: "wrong", ...keep });
  }
  if (user.status === "pending") return back({ error: "pending", ...keep });
  if (user.status === "disabled") return back({ error: "disabled", ...keep });

  return new Response(null, { status: 303, headers: { Location: next, "Set-Cookie": await sessionCookie(user, isSecureRequest(request)) } });
}
