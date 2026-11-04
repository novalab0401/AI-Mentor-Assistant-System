import type { NextRequest } from "next/server";
import { requireViewer } from "@/server/auth";
import { AccountError, ADMIN_ACTIONS, applyAdminAction, type AdminAction } from "@/server/users";

const back = (q: Record<string, string> = {}) =>
  new Response(null, { status: 303, headers: { Location: `/admin/users${Object.keys(q).length ? `?${new URLSearchParams(q)}` : ""}` } });

/** 운영진의 계정 관리(승인·정지·다시 사용·운영진 지정/해제). 강사 관리 화면의 폼에서 부른다. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const viewer = await requireViewer(req);
  if (viewer instanceof Response) return viewer;
  if (viewer.role !== "admin") return Response.json({ error: "운영진만 할 수 있어요." }, { status: 403 });
  const { id } = await ctx.params;
  const action = String((await req.formData()).get("action") ?? "") as AdminAction;
  if (!ADMIN_ACTIONS.includes(action)) return back({ error: "unknown" });
  try {
    await applyAdminAction(viewer.id, id, action);
    return back();
  } catch (e) {
    if (e instanceof AccountError) return back({ error: e.code });
    throw e;
  }
}
