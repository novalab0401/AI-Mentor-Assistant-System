import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_REQUIRED_MESSAGE, viewerFrom } from "@/server/auth";

// 로그인 확인(src/server/auth.ts). 로그인 안 했으면 페이지는 로그인 화면으로, API는 401로 돌려보낸다.
//
// /api/sessions 는 여기서 빼고 라우트 안에서 같은 확인을 한다.
// proxy를 거치는 요청은 Next가 본문을 메모리에 복사하는데 기본 10MB까지만 복사하고 나머지는 잘린다.
// 녹화 업로드(수백 MB)가 잘려 깨진 파일로 저장되지 않게 하려는 것이다.
const PUBLIC_PATHS = new Set(["/login", "/signup", "/api/login", "/api/signup", "/api/logout"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (await viewerFrom(request.headers)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: LOGIN_REQUIRED_MESSAGE }, { status: 401 });
  // proxy의 redirect는 전체 주소가 필요하다. 배포 서버 앞단 프록시가 넘겨 준 원래 주소(x-forwarded-*)를 우선 쓴다.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const url = new URL("/login", `${proto}://${host}`);
  if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: ["/((?!api/sessions|_next/static|_next/image|favicon.ico|robots.txt|nova-lab-mark.svg).*)"],
};
