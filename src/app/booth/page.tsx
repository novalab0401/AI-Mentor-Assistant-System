import { BoothStudio } from "@/components/booth/BoothStudio";
import { boothDemo, boothResult } from "@/server/booth";
import { feedbackStandard, rubric } from "@/server/content";
import { requirePageViewer } from "@/server/viewer";
import "./booth.css";

export const metadata = { title: "부스 운영 · Nova Lab" };

// 전시 부스 수업 시연: 녹음 → 실시간 녹취·관찰 → 분석 → 결과지.
export default async function BoothPage() {
  await requirePageViewer();
  return <BoothStudio demo={boothDemo} result={boothResult} rubric={rubric} checklist={feedbackStandard.checklist.map((c) => c.name)} />;
}
