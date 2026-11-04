import type { NextRequest } from "next/server";
import { requireViewer } from "@/server/auth";
import { getSession } from "@/server/sessions";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const viewer = await requireViewer(req);
  if (viewer instanceof Response) return viewer;
  const { id } = await ctx.params;
  const session = await getSession(id, viewer);
  if (!session) return Response.json({ error: "세션을 찾을 수 없어요." }, { status: 404 });
  return Response.json(session);
}
