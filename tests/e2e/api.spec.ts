// 녹화 업로드·재생 API와 접속 제한. 서버는 test-data/에 저장한다(playwright.config.ts).
import http from "http";
import { expect, test } from "@playwright/test";

const webm = (bytes = 20_000) => {
  const b = Buffer.alloc(bytes, 7);
  b.set([0x1a, 0x45, 0xdf, 0xa3]); // WebM 시작 바이트
  return b;
};

test.describe("녹화 업로드", () => {
  test("WebM 파일은 저장되고, 구간 재생(Range)이 된다", async ({ request }) => {
    const res = await request.post("/api/sessions?lessonNo=4&durationSec=60", { headers: { "Content-Type": "video/webm" }, data: webm(10_000) });
    expect(res.status()).toBe(201);
    const { id, status } = await res.json();
    expect(status).toBe("saved");

    const media = `/api/sessions/${id}/media`;
    const first = await request.get(media, { headers: { Range: "bytes=0-99" } });
    expect(first.status()).toBe(206);
    expect(first.headers()["content-range"]).toBe("bytes 0-99/10000");
    expect((await first.body()).length).toBe(100);

    const tail = await request.get(media, { headers: { Range: "bytes=-500" } });
    expect(tail.headers()["content-range"]).toBe("bytes 9500-9999/10000");

    expect((await request.get(media, { headers: { Range: "bytes=20000-" } })).status()).toBe(416);
    expect((await request.get(media)).status()).toBe(200);
  });

  test("10MB가 넘는 녹화도 잘리지 않고 그대로 저장된다", async ({ request }) => {
    // proxy가 본문을 10MB까지만 복사하던 문제의 회귀 시험
    const body = webm(12 * 1024 * 1024);
    body[body.length - 1] = 0x42;
    const res = await request.post("/api/sessions?lessonNo=4", { headers: { "Content-Type": "video/webm" }, data: body });
    expect(res.status()).toBe(201);
    const { id } = await res.json();
    const tail = await request.get(`/api/sessions/${id}/media`, { headers: { Range: "bytes=-1" } });
    expect(tail.headers()["content-range"]).toBe(`bytes ${body.length - 1}-${body.length - 1}/${body.length}`);
    expect((await tail.body())[0]).toBe(0x42);
  });

  test("같은 업로드 키로 다시 올리면 세션을 새로 만들지 않는다", async ({ request }) => {
    const key = "11111111-2222-4333-8444-555555555555";
    const url = `/api/sessions?lessonNo=7&durationSec=30&uploadKey=${key}`;
    const first = await request.post(url, { headers: { "Content-Type": "video/webm" }, data: webm() });
    expect(first.status()).toBe(201);
    const again = await request.post(url, { headers: { "Content-Type": "video/webm" }, data: webm() });
    expect(again.status()).toBe(200);
    expect((await again.json()).id).toBe((await first.json()).id);
    const all = (await (await request.get("/api/sessions")).json()) as { uploadKey?: string }[];
    expect(all.filter((s) => s.uploadKey === key)).toHaveLength(1);

    expect((await request.post("/api/sessions?lessonNo=7&uploadKey=not-a-uuid", { headers: { "Content-Type": "video/webm" }, data: webm() })).status()).toBe(400);
  });

  test("영상이라고 표시만 한 파일은 거절한다", async ({ request }) => {
    const res = await request.post("/api/sessions?lessonNo=4", { headers: { "Content-Type": "video/webm" }, data: Buffer.from("<html>not a video</html>".repeat(100)) });
    expect(res.status()).toBe(415);
  });

  test("영상·음성이 아닌 형식, 빈 파일, 없는 차시는 거절한다", async ({ request }) => {
    expect((await request.post("/api/sessions?lessonNo=4", { headers: { "Content-Type": "text/plain" }, data: webm() })).status()).toBe(415);
    expect((await request.post("/api/sessions?lessonNo=4", { headers: { "Content-Type": "video/webm" }, data: Buffer.alloc(0) })).status()).toBe(400);
    expect((await request.post("/api/sessions?lessonNo=99", { headers: { "Content-Type": "video/webm" }, data: webm() })).status()).toBe(400);
  });

  test("1GB가 넘는다고 밝힌 요청은 받기 전에 거절한다", async ({ baseURL }) => {
    const { port } = new URL(baseURL!);
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        { host: "127.0.0.1", port, method: "POST", path: "/api/sessions?lessonNo=4", headers: { "Content-Type": "video/webm", "Content-Length": 2_000_000_000 } },
        (res) => {
          resolve(res.statusCode ?? 0);
          req.destroy(); // 나머지 본문은 보내지 않고 연결을 닫는다
        },
      );
      req.on("error", reject);
      req.write(webm(16));
      // 본문을 다 보내지 않아도 서버가 먼저 거절해야 한다
    });
    expect(status).toBe(413);
  });

  test("없는 세션 영상은 404", async ({ request }) => {
    expect((await request.get("/api/sessions/00000000-0000-0000-0000-000000000000/media")).status()).toBe(404);
    expect((await request.get("/api/sessions/../../etc/media")).status()).toBe(404);
  });
});

test("로그인 안 한 다른 기기(Host)의 요청은 401, 이 컴퓨터는 로컬 관리자로 통과", async ({ baseURL }) => {
  const { port } = new URL(baseURL!);
  const get = (host: string) =>
    new Promise<number>((resolve, reject) => {
      http.get({ host: "127.0.0.1", port, path: "/api/sessions", headers: { host } }, (res) => resolve(res.statusCode ?? 0)).on("error", reject);
    });
  expect(await get(`192.168.0.10:${port}`)).toBe(401);
  expect(await get(`localhost:${port}`)).toBe(200);
});
