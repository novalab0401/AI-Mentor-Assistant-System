// 가짜 카메라·마이크로 실제 녹화 흐름을 시험한다: 임시 저장, 복구, 이동 확인, 탭 잠금.
import { expect, test, type Page } from "@playwright/test";

async function openRecorder(page: Page, lessonNo = 4, { audioOnly = false } = {}) {
  page.on("dialog", (d) => d.accept()); // 이동 확인·지우기 확인은 모두 '예'
  await page.goto(`/practice/${lessonNo}`);
  const start = page.getByRole("button", { name: "녹화 시작" });
  const open = page.getByRole("button", { name: /카메라·마이크 켜기|마이크 켜기/ });
  if (audioOnly) await page.getByLabel("음성만 녹화").check();
  await open.click();
  try {
    await expect(start).toBeVisible({ timeout: 5000 });
  } catch {
    // 테스트용 Chrome의 가짜 카메라는 가끔 장치 목록에서 사라진다(마이크는 남는다).
    // 이 경우 음성만 녹화로 바꿔 시험을 이어가고, 결과에 표시한다.
    test.info().annotations.push({ type: "note", description: "가짜 카메라를 못 찾아 음성만 녹화로 시험함" });
    await page.getByLabel("음성만 녹화").check();
    await page.getByRole("button", { name: "마이크 켜기" }).click();
    await expect(start).toBeVisible();
  }
}

async function record(page: Page, ms: number) {
  await page.getByRole("button", { name: "녹화 시작" }).click();
  await expect(page.getByRole("button", { name: "녹화 끝내기" })).toBeVisible();
  await page.waitForTimeout(ms);
}

async function reviewBlobSize(page: Page) {
  await expect(page.locator("video[controls]")).toBeVisible();
  return page.evaluate(async () => {
    const v = document.querySelector<HTMLVideoElement>("video[controls]");
    return v ? (await (await fetch(v.src)).blob()).size : -1;
  });
}


async function dumpDrafts(page: Page) {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open("novalab-recorder"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (store: string) => new Promise<unknown[]>((res) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result); });
    const drafts = ((await all("drafts")) as { id: string; lessonNo: number; chunkCount: number; finished: boolean }[]).map((d) => [d.id.slice(0, 6), d.lessonNo, d.chunkCount, d.finished]);
    let locks: unknown = null;
    try { locks = (await navigator.locks.query()).held?.map((l) => l.name?.slice(-6)); } catch (err) { locks = String(err); }
    return JSON.stringify({ drafts, chunks: (await all("chunks")).length, locks });
  });
}

async function waitForSavedChunks(page: Page, min = 1) {
  await expect
    .poll(async () => JSON.parse(await dumpDrafts(page)).chunks as number, { message: "녹화 조각이 임시 저장될 때까지", timeout: 15_000 })
    .toBeGreaterThanOrEqual(min);
}

test.beforeEach(async ({ page }) => {
  // 테스트마다 브라우저 임시 저장을 비운다
  await page.goto("/");
  await page.evaluate(() => new Promise<void>((r) => { const q = indexedDB.deleteDatabase("novalab-recorder"); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
});

test("녹화 중 사이드바로 이동해도, 돌아오면 복구해서 제출할 수 있다", async ({ page }) => {
  await openRecorder(page);
  await record(page, 3000);

  const dialogs: string[] = [];
  page.on("dialog", (d) => dialogs.push(d.message()));
  await page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name: "홈" }).click();
  await expect(page).toHaveURL("/");
  expect(dialogs.some((m) => m.includes("녹화 중이에요"))).toBe(true);

  await page.goto("/practice/4");
  await expect(page.getByText("제출하지 않은 녹화가 있어요")).toBeVisible();
  await page.getByRole("button", { name: "다시 보고 제출" }).click();
  expect(await reviewBlobSize(page)).toBeGreaterThan(10_000);

  await page.getByRole("button", { name: "제출하고 AI 피드백 받기" }).click();
  await expect(page).toHaveURL(/\/feedback\/[0-9a-f-]{36}$/);
  await expect(page.getByText("녹화가 저장됐어요")).toBeVisible();

  // 제출하면 임시 저장본은 지워진다
  await page.goto("/practice/4");
  await expect(page.getByRole("button", { name: "카메라·마이크 켜기" })).toBeVisible();
  await expect(page.getByText("제출하지 않은 녹화가 있어요")).toHaveCount(0);
});

test("녹화 중 새로고침해도 '중간에 멈춘 녹화'로 복구된다", async ({ page }) => {
  await openRecorder(page, 5, { audioOnly: true });
  await record(page, 1500);
  await waitForSavedChunks(page);
  await page.reload();
  await expect(page.getByText("제출하지 않은 녹화가 있어요")).toBeVisible().catch(async (e) => {
    console.log("DIAG-reload", await dumpDrafts(page));
    throw e;
  });
  await expect(page.getByText("중간에 멈춘 녹화")).toBeVisible();
  await page.getByRole("button", { name: "다시 보고 제출" }).click();
  expect(await reviewBlobSize(page)).toBeGreaterThan(1_000); // 음성만 녹화라 영상보다 작다
});

test("미리 열어 둔 다른 탭에서 새로 녹화해도, 끝내고 제출 안 한 녹화는 지워지지 않는다", async ({ context }) => {
  const b = await context.newPage(); // A가 녹화하기 전에 열어 둔 탭
  await openRecorder(b, 8, { audioOnly: true });
  const a = await context.newPage();
  await openRecorder(a, 8, { audioOnly: true });

  await record(a, 1500);
  await waitForSavedChunks(a);
  await a.getByRole("button", { name: "녹화 끝내기" }).click();
  await expect(a.getByRole("button", { name: "제출하고 AI 피드백 받기" })).toBeVisible();

  await record(b, 1500);
  await waitForSavedChunks(b, 2);
  await b.getByRole("button", { name: "녹화 끝내기" }).click();
  await expect(b.getByRole("button", { name: "제출하고 AI 피드백 받기" })).toBeVisible();

  // A를 새로고침해도 A의 녹화는 남아 있고, B의 녹화와 함께 두 개가 보인다
  await a.reload();
  await expect(a.getByText("제출하지 않은 녹화가 있어요")).toBeVisible();
  await expect(a.getByText("2개")).toBeVisible().catch(async (e) => {
    console.log("DIAG-stale", await dumpDrafts(a));
    throw e;
  });
  await expect(a.getByRole("button", { name: "다시 보고 제출" })).toHaveCount(2);
});

test("같은 차시는 한 탭에서만 녹화되고, 제출은 다른 탭의 임시 저장을 지우지 않는다", async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await openRecorder(a, 6, { audioOnly: true });
  await openRecorder(b, 6, { audioOnly: true });

  await record(a, 1500);
  await b.getByRole("button", { name: "녹화 시작" }).click();
  await expect(b.getByText("다른 탭에서 이 차시를 녹화하고 있어요")).toBeVisible();
  await expect(b.getByRole("button", { name: "녹화 끝내기" })).toHaveCount(0);

  await a.getByRole("button", { name: "녹화 끝내기" }).click();
  await expect(a.getByRole("button", { name: "제출하고 AI 피드백 받기" })).toBeVisible();

  // A가 끝나면 B는 녹화할 수 있다
  await record(b, 1500);
  await b.getByRole("button", { name: "녹화 끝내기" }).click();
  await expect(b.getByRole("button", { name: "제출하고 AI 피드백 받기" })).toBeVisible();

  // A를 제출해도 B의 임시 저장본은 남는다
  await a.getByRole("button", { name: "제출하고 AI 피드백 받기" }).click();
  await expect(a).toHaveURL(/\/feedback\//);
  const c = await context.newPage();
  await c.goto("/practice/6");
  await expect(c.getByText("제출하지 않은 녹화가 있어요")).toBeVisible();
});

test("다른 탭이 녹화 중이거나 다시 보는 중인 녹화는 복구·삭제할 수 없다", async ({ context }) => {
  const a = await context.newPage();
  await openRecorder(a, 11, { audioOnly: true });
  await record(a, 1000);
  await waitForSavedChunks(a); // 조각이 임시 저장될 만큼 녹화 중

  // 녹화 중에 같은 차시를 연 탭: 목록에는 보이지만 '다른 탭에서 쓰는 중'이고 복구·삭제가 막힌다
  const b = await context.newPage();
  b.on("dialog", (d) => d.accept());
  await b.goto("/practice/11");
  await expect(b.getByText("다른 탭에서 쓰는 중")).toBeVisible().catch(async (e) => {
    console.log("DIAG-busy", await dumpDrafts(b));
    throw e;
  });
  await expect(b.getByRole("button", { name: "다시 보고 제출" })).toBeDisabled();
  await expect(b.getByRole("button", { name: "지우기" })).toBeDisabled();

  // A가 녹화를 끝내고 다시 보는 중이어도 계속 막혀 있다(중간 녹화가 먼저 제출되는 것을 막는다)
  await a.getByRole("button", { name: "녹화 끝내기" }).click();
  await expect(a.getByRole("button", { name: "제출하고 AI 피드백 받기" })).toBeVisible();
  await b.reload();
  await expect(b.getByText("다른 탭에서 쓰는 중")).toBeVisible();
  await expect(b.getByRole("button", { name: "다시 보고 제출" })).toBeDisabled();

  // A가 제출하면 그 녹화는 사라지고, B에서도 더 이상 보이지 않는다
  await a.getByRole("button", { name: "제출하고 AI 피드백 받기" }).click();
  await expect(a).toHaveURL(/\/feedback\//);
  await b.reload();
  await expect(b.getByRole("button", { name: /카메라·마이크 켜기/ })).toBeVisible();
  await expect(b.getByText("제출하지 않은 녹화가 있어요")).toHaveCount(0);
});

// ---- 실행은 됐는데 응답이 유실된 경우 ----
// 첫 제출은 서버까지 그대로 보내 저장되게 하고, 응답만 브라우저에 닿기 전에 끊는다.
async function loseFirstSubmitResponse(page: Page) {
  const committed: { id?: string; uploadKey?: string; httpStatus?: number; raw?: string } = {};
  let dropped = false;
  await page.route(/\/api\/sessions\?/, async (route) => {
    if (route.request().method() !== "POST" || dropped) return route.continue();
    dropped = true;
    try {
      const res = await route.fetch(); // 서버는 실제로 저장한다
      committed.httpStatus = res.status();
      committed.raw = await res.text();
      committed.uploadKey = new URL(route.request().url()).searchParams.get("uploadKey") ?? undefined;
      Object.assign(committed, JSON.parse(committed.raw));
    } catch (e) {
      committed.raw = `route.fetch failed: ${(e as Error).message}`;
    }
    await route.abort("connectionreset"); // 응답 유실
  });
  return committed;
}

async function sessionsWithKey(page: Page, key: string) {
  const all = (await (await page.request.get("/api/sessions")).json()) as { id: string; uploadKey?: string }[];
  return all.filter((s) => s.uploadKey === key);
}

test("응답이 유실된 뒤 같은 화면에서 다시 제출해도 세션은 하나다", async ({ page }) => {
  await openRecorder(page, 9, { audioOnly: true });
  await record(page, 2000);
  await page.getByRole("button", { name: "녹화 끝내기" }).click();

  const committed = await loseFirstSubmitResponse(page);
  await page.getByRole("button", { name: "제출하고 AI 피드백 받기" }).click();
  // 브라우저는 실패로 알고, 녹화는 그대로 남아 다시 제출할 수 있다
  await expect(page.getByText(/다시 제출해 주세요/)).toBeVisible();
  expect(committed.httpStatus, committed.raw).toBe(201);
  expect(committed.id).toBeTruthy();
  expect(committed.uploadKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(await sessionsWithKey(page, committed.uploadKey!)).toHaveLength(1); // 서버에는 이미 저장됨

  await page.getByRole("button", { name: "제출하고 AI 피드백 받기" }).click();
  await expect(page).toHaveURL(`/feedback/${committed.id}`); // 새 세션이 아니라 처음 저장된 세션
  expect(await sessionsWithKey(page, committed.uploadKey!)).toHaveLength(1);

  // 제출이 확인됐으니 임시 녹화도 지워진다
  await page.goto("/practice/9");
  await expect(page.getByRole("button", { name: "카메라·마이크 켜기" })).toBeVisible();
  await expect(page.getByText("제출하지 않은 녹화가 있어요")).toHaveCount(0);
});

test("응답이 유실된 뒤 새로고침하고 복구해서 제출해도 세션은 하나다", async ({ page }) => {
  await openRecorder(page, 10, { audioOnly: true });
  await record(page, 2000);
  await page.getByRole("button", { name: "녹화 끝내기" }).click();

  const committed = await loseFirstSubmitResponse(page);
  await page.getByRole("button", { name: "제출하고 AI 피드백 받기" }).click();
  await expect(page.getByText(/다시 제출해 주세요/)).toBeVisible();

  // 새로고침하면 임시 녹화가 남아 있다(서버 저장 여부를 브라우저는 모른다)
  await page.unrouteAll();
  await page.reload();
  await expect(page.getByText("제출하지 않은 녹화가 있어요")).toBeVisible();
  await page.getByRole("button", { name: "다시 보고 제출" }).click();
  await expect(page.locator("video[controls]")).toBeVisible();
  await page.getByRole("button", { name: "제출하고 AI 피드백 받기" }).click();

  await expect(page).toHaveURL(`/feedback/${committed.id}`);
  expect(await sessionsWithKey(page, committed.uploadKey!)).toHaveLength(1);
});
