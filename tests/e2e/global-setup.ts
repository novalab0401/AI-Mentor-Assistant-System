import { rmSync } from "fs";

// 매번 빈 테스트 데이터 폴더에서 시작한다.
export default function globalSetup() {
  rmSync("test-data", { recursive: true, force: true });
}
