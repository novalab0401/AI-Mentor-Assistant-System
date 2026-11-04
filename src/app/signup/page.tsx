import Link from "next/link";
import { AuthShell, Field, Notice } from "@/components/AuthShell";
import { MIN_PASSWORD, SIGNUP_ERRORS } from "@/server/users";

export const metadata = { title: "가입 신청 · Nova Lab" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const sp = await props.searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const code = str(sp.error);
  const error = code in SIGNUP_ERRORS ? SIGNUP_ERRORS[code as keyof typeof SIGNUP_ERRORS] : "";

  return (
    <AuthShell title="가입 신청" desc="운영진이 승인하면 로그인해서 쓸 수 있어요.">
      {error && <Notice tone="alert">{error}</Notice>}
      <form action="/api/signup" method="post" className="mt-2">
        <Field id="name" label="이름" autoComplete="name" defaultValue={str(sp.name)} autoFocus />
        <Field id="email" label="이메일" type="email" autoComplete="email" defaultValue={str(sp.email)} hint="로그인 아이디로 써요." />
        <Field id="password" label="비밀번호" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} hint={`${MIN_PASSWORD}자 이상`} />
        <Field id="password2" label="비밀번호 확인" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} />
        <p className="mt-6 text-[12.5px] leading-relaxed text-ter">
          모의수업 녹화(얼굴·목소리)는 이 서비스 서버에 저장되고, AI 분석을 시작하면 음성이 OpenAI(미국)로 전송돼요. 녹화는 본인과 운영진만 볼 수 있어요.
        </p>
        <button type="submit" className="mt-4 h-11 w-full rounded-xl bg-brand text-[14.5px] font-medium text-white hover:bg-brand-dark">
          가입 신청하기
        </button>
      </form>
      <p className="mt-6 text-center text-[13.5px] text-sub">
        이미 가입했나요?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
}
