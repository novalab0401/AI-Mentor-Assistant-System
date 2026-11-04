import path from "path";
import { defineConfig } from "vitest/config";

// AI 피드백 평가(유료 API 호출). npm test에는 들어가지 않고 `npm run eval:ai`로만 돈다.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/eval/**/*.eval.ts"], environment: "node", testTimeout: 15 * 60 * 1000, fileParallelism: false },
});
