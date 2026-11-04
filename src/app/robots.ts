import type { MetadataRoute } from "next";

// 강사 전용 내부 도구라 검색엔진·AI 크롤러가 수집하지 않게 한다.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
