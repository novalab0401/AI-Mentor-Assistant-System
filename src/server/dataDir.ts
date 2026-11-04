import path from "path";

// 녹화·세션·계정 기록을 두는 폴더(git 제외). 배포에서는 영구 디스크(/workspace/data)를 쓴다.
// 테스트는 NOVALAB_DATA_DIR로 별도 폴더를 써서 실제 기록과 섞이지 않게 한다.
export const DATA_DIR = process.env.NOVALAB_DATA_DIR ? path.resolve(process.env.NOVALAB_DATA_DIR) : path.join(process.cwd(), "data");
