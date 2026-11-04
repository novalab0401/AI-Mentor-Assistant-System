import type { NextRequest } from "next/server";
import { requireViewer } from "@/server/auth";
import { getSession } from "@/server/sessions";
import { aiConfigProblem } from "@/server/analysis/openai";
import { startAnalysis, type StartResult } from "@/server/analysis/pipeline";

const RESULT: Record<StartResult, [number, string]> = {
  started: [202, "분석을 시작했어요."],
  not_found: [404, "세션을 찾을 수 없어요."],
  demo: [400, "예시 세션은 분석할 수 없어요."],
  no_recording: [404, "녹화 파일을 찾을 수 없어요."],
  done: [409, "이미 분석을 마친 녹화예요."],
  running: [409, "이 녹화를 이미 분석하고 있어요."],
  busy: [429, "다른 녹화를 분석하는 중이에요. 끝난 뒤 다시 시도해 주세요."],
  not_configured: [503, "AI 분석 설정이 없어요."],
};

/**
 * 녹화의 AI 분석을 시작한다. 분석은 서버에서 계속 돌고, 진행 상황은 GET /api/sessions/[id]의 status·analysis로 본다.
 * 녹화 음성이 OpenAI로 전송되므로 사용자가 화면에서 직접 눌렀을 때만 부른다.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/sessions/[id]/analyze">) {
  const viewer = await requireViewer(req);
  if (viewer instanceof Response) return viewer;
  const { id } = await ctx.params;
  // 볼 수 없는 녹화는 없는 것과 똑같이 다룬다
  const result = (await getSession(id, viewer)) ? await startAnalysis(id) : "not_found";
  const [status, message] = RESULT[result];
  const detail = result === "not_configured" ? ` ${aiConfigProblem()}` : "";
  return Response.json(result === "started" ? { ok: true } : { error: message + detail }, { status });
}
