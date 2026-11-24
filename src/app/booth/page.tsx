import { BoothStudio } from "@/components/booth/BoothStudio";
import { boothDemo, boothResult } from "@/server/booth";
import { feedbackStandard, rubric } from "@/server/content";
import { requirePageViewer } from "@/server/viewer";
import "./booth.css";

export const metadata = { title: "부스 운영 · Nova Lab" };

// 전시 부스 체험 수업: 녹음 불러오기 → 음성 분석·장면 관찰 → 채점·검토 → AI 수업 코칭 리포트.
export default async function BoothPage() {
  await requirePageViewer();
  return <BoothStudio demo={boothDemo} result={boothResult} rubric={rubric} checklist={feedbackStandard.checklist.map((c) => c.name)} />;
}
