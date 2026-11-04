import { redirect } from "next/navigation";
import { getProgress } from "@/server/progress";
import { requirePageViewer } from "@/server/viewer";

// 차시별 지도안: 목록과 상세를 한 화면에 둔다(lessons/[no]). 처음에는 다음 수업 차시를 연다.
export default async function LessonsPage() {
  const p = await getProgress(await requirePageViewer());
  redirect(`/lessons/${p.nextLessonNo}`);
}
