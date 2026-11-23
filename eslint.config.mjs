import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 따로 빌드한 폴더(테스트용 .next-test, 개발 서버를 켠 채 빌드하는 .next-check 등)와 테스트 결과물
    ".next-*/**",
    "test-results/**",
    "playwright-report/**",
    // 개인 도구 설정(git 제외)
    ".agents/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
