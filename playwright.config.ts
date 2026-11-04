import { defineConfig } from "@playwright/test";

// 화면·API 테스트. 개발 서버(3000)와 실제 녹화(data/)를 건드리지 않도록
// 따로 빌드한 서버를 3200번에 띄우고, 녹화는 test-data/에 저장한다.
const PORT = 3200;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false, // 업로드 동시 제한·잠금을 시험하므로 순서대로 돌린다
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome", // 설치된 Chrome을 쓴다(브라우저를 따로 받지 않음)
    viewport: { width: 1440, height: 1000 },
    permissions: ["camera", "microphone"],
    launchOptions: {
      // 가짜 카메라·마이크로 녹화를 시험한다
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
    },
  },
  webServer: {
    command: `npm run build && npx next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://localhost:${PORT}/api/rubric`,
    timeout: 240_000,
    reuseExistingServer: false,
    // 켜 둔 개발 서버의 .next와 섞이지 않게 빌드 폴더를 따로 쓴다
    // 화면 테스트는 로그인 없이 로컬 관리자로 돌린다(계정·권한은 단위 테스트에서 확인)
    env: { NOVALAB_DATA_DIR: "test-data", NEXT_DIST_DIR: ".next-test", LOCAL_NO_LOGIN: "1" },
  },
});
