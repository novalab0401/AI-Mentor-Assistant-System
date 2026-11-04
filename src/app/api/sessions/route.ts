import type { NextRequest } from "next/server";
import { getLesson } from "@/server/content";
import { requireViewer } from "@/server/auth";
import { createSession, listSessions, UploadRejected, type UploadRejection } from "@/server/sessions";

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  return Response.json(await listSessions(viewer), { headers: { "Cache-Control": "private, no-store" } });
}

const MAX_BYTES = 1024 * 1024 * 1024; // 녹화 1개 최대 1GB (60분 녹화 여유분)

const REJECT: Record<UploadRejection, [number, string]> = {
  too_large: [413, "녹화 파일이 1GB를 넘어요."],
  empty: [400, "녹화 파일이 비어 있어요."],
  not_media: [415, "녹화 파일 형식이 아니에요. 이 사이트에서 녹화한 영상만 올릴 수 있어요."],
  quota: [507, "녹화 보관 공간이 가득 찼어요. 관리자에게 오래된 녹화 정리를 요청해 주세요."],
  disk: [507, "서버 저장 공간이 부족해요. 녹화는 이 브라우저에 임시 저장돼 있으니 잠시 뒤 다시 제출해 주세요."],
  busy: [429, "다른 녹화를 올리는 중이에요. 잠시 뒤 다시 제출해 주세요."],
  in_progress: [409, "이 녹화를 이미 올리고 있어요. 다른 탭에서 제출 중인지 확인해 주세요."],
};

/**
 * 브라우저에서 녹화한 모의수업을 받는다.
 * 본문 = 녹화 파일 그대로 (Content-Type: video/* 또는 audio/*), 쿼리 = lessonNo, durationSec, uploadKey
 * uploadKey(UUID)가 같으면 다시 올려도 세션을 새로 만들지 않고 이미 있는 세션을 돌려준다(200).
 * multipart를 쓰지 않는 이유: formData()는 본문 전체를 메모리에 올린 뒤에야 크기를 알 수 있다.
 */
export async function POST(request: NextRequest) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const lessonNo = Number(request.nextUrl.searchParams.get("lessonNo"));
  const durationSec = Math.max(0, Math.round(Number(request.nextUrl.searchParams.get("durationSec")) || 0));
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  const rawKey = request.nextUrl.searchParams.get("uploadKey");
  if (rawKey !== null && !/^[0-9a-f-]{36}$/.test(rawKey)) return Response.json({ error: "업로드 키 형식이 올바르지 않아요." }, { status: 400 });

  if (!getLesson(lessonNo)) return Response.json({ error: "차시 번호가 올바르지 않아요." }, { status: 400 });
  if (!type.startsWith("video/") && !type.startsWith("audio/"))
    return Response.json({ error: "영상 또는 음성 파일만 올릴 수 있어요." }, { status: 415 });

  // 크기를 미리 밝힌 요청은 받기 전에 거절한다. 실제 제한은 받으면서 센 바이트 수로 건다.
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BYTES) return Response.json({ error: REJECT.too_large[1] }, { status: 413 });
  if (!request.body) return Response.json({ error: REJECT.empty[1] }, { status: 400 });

  try {
    const { session, created } = await createSession({ lessonNo, durationSec, mimeType: type, body: request.body, maxBytes: MAX_BYTES, uploadKey: rawKey ?? undefined, ownerId: viewer.id });
    return Response.json(session, { status: created ? 201 : 200 });
  } catch (e) {
    if (e instanceof UploadRejected) {
      const [status, error] = REJECT[e.reason];
      return Response.json({ error }, { status });
    }
    throw e;
  }
}
