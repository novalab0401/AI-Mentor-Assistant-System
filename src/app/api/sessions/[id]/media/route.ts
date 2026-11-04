import type { NextRequest } from "next/server";
import { promises as fs, createReadStream } from "fs";
import { Readable } from "stream";
import { requireViewer } from "@/server/auth";
import { parseRange } from "@/server/range";
import { getSession, recordingPath } from "@/server/sessions";

// 녹화 영상 재생. 탐색(seek)이 되도록 Range 요청을 지원한다.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/sessions/[id]/media">) {
  const viewer = await requireViewer(req);
  if (viewer instanceof Response) return viewer;
  const { id } = await ctx.params;
  const session = await getSession(id, viewer);
  const file = recordingPath(id);
  if (!session || !file) return new Response("Not found", { status: 404 });

  let size: number;
  try {
    size = (await fs.stat(file)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const base = {
    "Content-Type": session.mimeType.split(";")[0] || "video/webm",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  };
  const range = parseRange(req.headers.get("range"), size);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
  }
  if (range) {
    const stream = Readable.toWeb(createReadStream(file, { start: range.start, end: range.end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...base, "Content-Length": String(range.end - range.start + 1), "Content-Range": `bytes ${range.start}-${range.end}/${size}` },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...base, "Content-Length": String(size) } });
}
