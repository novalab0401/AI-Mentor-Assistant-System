import type { NextRequest } from "next/server";
import { getLesson } from "@/server/content";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/lessons/[no]">) {
  const { no } = await ctx.params;
  const lesson = getLesson(Number(no));
  if (!lesson) return Response.json({ error: "차시를 찾을 수 없어요." }, { status: 404 });
  return Response.json(lesson);
}
