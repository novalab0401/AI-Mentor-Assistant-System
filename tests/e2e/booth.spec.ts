// 부스 운영: 녹음 시작 → 실시간 녹취 → 분석 → 결과지까지 이어지는지
import { expect, test } from "@playwright/test";

test("부스 시연: 녹음 → 분석 → 결과지", async ({ page }) => {
  await page.goto("/booth");
  await page.getByRole("button", { name: "녹음 시작" }).click();
  await expect(page.getByText("실시간 녹취")).toBeVisible();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect(page.getByText("빛의 반사에 대해 알아볼 거예요", { exact: false })).toBeVisible();
  await expect(page.locator(".bt-notes li").first()).toBeVisible();

  await page.getByRole("button", { name: "녹음 끝내고 분석" }).click();
  await expect(page.getByText("AI 분석")).toBeVisible();
  await expect(page.getByRole("heading", { name: /부스 시연 결과지/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".score .big")).toHaveText(/^62/, { timeout: 5_000 });

  // 항목을 누르면 근거 발언이 펼쳐진다
  await page.getByRole("button", { name: /도움을 조절함/ }).click();
  await expect(page.locator(".detail blockquote").first()).toContainText("반대로요");
});
