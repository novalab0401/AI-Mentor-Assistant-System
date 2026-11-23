// 부스 운영: 분석 시작 → 녹취 분석 → 채점·검토 → 결과지까지 이어지는지
import { expect, test } from "@playwright/test";

test("부스 시연: 분석 시작 → 녹취 분석 → 결과지", async ({ page }) => {
  await page.goto("/booth");
  await page.getByRole("button", { name: "분석 시작" }).click();
  await expect(page.getByRole("button", { name: "중지" })).toBeVisible();
  await expect(page.locator(".bt-pipe li.now")).toHaveText(/녹취 분석/);

  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("빛의 반사에 대해 알아볼 거예요", { exact: false })).toBeVisible();
  await expect(page.locator(".bt-notes li").first()).toBeVisible();

  // 나머지 녹음을 건너뛰면 채점 단계로 넘어간다
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator(".bt-pipe li.now")).toHaveText(/루브릭 채점/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /부스 시연 결과지/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".score .big")).toHaveText(/^62/, { timeout: 5_000 });

  // 항목을 누르면 1~5점 수준과 근거 발언이 펼쳐지고, 받은 점수 수준이 표시된다
  await page.getByRole("button", { name: /도움을 조절함/ }).click();
  await expect(page.locator(".detail .levels li")).toHaveCount(5);
  await expect(page.locator(".detail .levels li.got")).toContainText("2점");
  await expect(page.locator(".detail blockquote").first()).toContainText("반대로요");
});

test("부스 시연: 중지하면 처음 화면으로", async ({ page }) => {
  await page.goto("/booth");
  await page.getByRole("button", { name: "분석 시작" }).click();
  await page.getByRole("button", { name: "중지" }).click();
  await expect(page.getByRole("button", { name: "분석 시작" })).toBeVisible();
});
