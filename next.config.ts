import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components는 아직 쓰지 않는다(이전 캐싱 모델). 데이터가 늘면 다시 검토.
  cacheComponents: false,
  // 개발 서버가 .next를 쓰는 중에도 따로 빌드할 수 있게(테스트·배포 확인용) 폴더를 바꿀 수 있다
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // ffmpeg 실행 파일 경로를 패키지 위치 기준으로 찾으므로 번들하지 않는다
  serverExternalPackages: ["ffmpeg-static"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
