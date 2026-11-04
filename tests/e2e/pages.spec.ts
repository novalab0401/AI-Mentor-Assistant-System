// 화면 흐름: 지도안 차시 전환, 예시 데이터가 진도에 섞이지 않는지, 근거 기반 피드백 화면.
import { expect, test } from "@playwright/test";

test.describe("수업 지도안", () => {
  test("탭을 누르면 다음 수업 차시가 열린다(녹화 기록이 없으면 1차시)", async ({ page }) => {
    await page.goto("/lessons");
    await expect(page).toHaveURL(/\/lessons\/\d+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("과학자와 공학자는 어떻게 문제를 해결할까?");
  });

  test("왼쪽 목록에서 다른 차시를 바로 고를 수 있다", async ({ page }) => {
    await page.goto("/lessons/1");
    const rail = page.getByRole("navigation", { name: "차시 목록" });
    await rail.getByRole("link", { name: /미지의 용액을 밝혀라/ }).click();
    await expect(page).toHaveURL("/lessons/3");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("미지의 용액을 밝혀라");
    await expect(rail.getByRole("link", { name: /미지의 용액을 밝혀라/ })).toHaveAttribute("aria-current", "page");
  });

  test("← → 키와 이전·다음 버튼으로 차시를 넘긴다", async ({ page }) => {
    await page.goto("/lessons/3");
    await page.waitForLoadState("networkidle"); // 키 입력 처리 스크립트가 붙을 때까지
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL("/lessons/4");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("원자력으로 불을 밝혀라");
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL("/lessons/3");
    await page.getByRole("navigation", { name: "이전·다음 차시" }).getByRole("link", { name: /다음 차시/ }).click();
    await expect(page).toHaveURL("/lessons/4");
  });
});

test("예시 피드백은 진도·점수에 들어가지 않는다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("다음 수업")).toBeVisible();
  await expect(page.getByText("과학자와 공학자는 어떻게 문제를 해결할까?").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /예시 피드백 미리 보기/ })).toBeVisible();
});

test("피드백 화면에 항목별 근거가 고칠 항목부터 나온다", async ({ page }) => {
  await page.goto("/feedback/demo-3");
  await expect(page.getByText("AI 평가 · 참고용")).toBeVisible();
  await expect(page.getByRole("heading", { name: "항목별 근거" })).toBeVisible();

  const first = page.locator("details").first();
  await expect(first).toHaveAttribute("open", "");
  await expect(first.locator("summary")).toContainText("실습 안전수칙을 실행하고 점검함");
  await expect(first).toContainText("다음 목표 (4점)");
  await expect(first).toContainText("지도안 대조");

  // 학생 반응이 필요한 항목은 판단 불가
  await expect(page.locator("details", { hasText: "이해 증거에 맞춰 수업을 조정함" }).locator("summary")).toContainText("판단 불가");
});
