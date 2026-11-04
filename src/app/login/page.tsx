import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, Field, Notice } from "@/components/AuthShell";
import { safeNext } from "@/server/auth";
import { currentViewer } from "@/server/viewer";

export const metadata = { title: "로그인 · Nova Lab" };

const ERRORS: Record<string, string> = {
  wrong: "이메일 또는 비밀번호가 맞지 않아요.",
  pending: "아직 운영진 승인 전이에요. 승인되면 로그인할 수 있어요.",
  disabled: "사용이 정지된 계정이에요. 운영진에게 문의해 주세요.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = safeNext(sp.next);
  const viewer = await currentViewer();
  if (viewer && !viewer.local) redirect(next);
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const email = typeof sp.email === "string" ? sp.email : "";

  return (
    <AuthShell title="Nova Lab 로그인" desc="가입한 이메일과 비밀번호를 입력해 주세요.">
      {sp.signed === "1" && <Notice tone="info">가입 신청을 받았어요. 운영진이 승인하면 로그인할 수 있어요.</Notice>}
      {error && <Notice tone="alert">{error}</Notice>}
      <form action="/api/login" method="post" className="mt-2">
        <input type="hidden" name="next" value={next} />
        <Field id="email" label="이메일" type="email" autoComplete="email" defaultValue={email} autoFocus={!email} />
        <Field id="password" label="비밀번호" type="password" autoComplete="current-password" autoFocus={Boolean(email)} />
        <button type="submit" className="mt-6 h-11 w-full rounded-xl bg-brand text-[14.5px] font-medium text-white hover:bg-brand-dark">
          로그인
        </button>
      </form>
      <p className="mt-6 text-center text-[13.5px] text-sub">
        처음이신가요?{" "}
        <Link href="/signup" className="font-medium text-brand hover:underline">
          가입 신청
        </Link>
      </p>
    </AuthShell>
  );
}
