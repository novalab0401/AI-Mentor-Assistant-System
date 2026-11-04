import { lessons } from "@/server/content";

// 차시 목록 (상세 단계는 빼고 요약만)
export async function GET() {
  return Response.json(
    lessons.map(({ steps, ...rest }) => ({ ...rest, stepCount: steps.length })),
  );
}
