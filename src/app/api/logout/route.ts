import { clearSessionCookie, isSecureRequest } from "@/server/auth";

export async function POST(request: Request) {
  return new Response(null, { status: 303, headers: { Location: "/login", "Set-Cookie": clearSessionCookie(isSecureRequest(request)) } });
}
