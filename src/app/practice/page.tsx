import Link from "next/link";
import { FieldLabel, Icon } from "@/components/Icon";
import { lessons } from "@/server/content";
import { getProgress } from "@/server/progress";
import { requirePageViewer } from "@/server/viewer";

export default async function PracticePage() {
  const p = await getProgress(await requirePageViewer());
  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">모의수업</h1>
      <p className="mt-2 text-[14px] text-sub">차시를 고르면 이 사이트에서 바로 녹화해요. 녹화하는 동안 지도안 흐름이 옆에 떠요.</p>
      <ul className="mt-8 border-t border-line">
        {lessons.map((l) => {
          const isNext = l.no === p.nextLessonNo;
          const count = p.sessions.filter((s) => s.lessonNo === l.no).length;
          return (
            <li key={l.no} className={`border-b border-line ${isNext ? "bg-tint" : ""}`}>
              <Link href={`/practice/${l.no}`} className="group grid grid-cols-[72px_1fr_160px_120px_24px] items-center py-4 pl-1 pr-3">
                <span className={`tnum text-[18px] font-light ${isNext ? "text-brand" : "text-ter"}`}>{String(l.no).padStart(2, "0")}</span>
                <span className="text-[15px] text-ink group-hover:text-brand">
                  {l.title}
                  {isNext && <span className="ml-3 text-[12.5px] font-medium text-brand">다음 수업</span>}
                </span>
                <span className="text-[13.5px] text-body">
                  <FieldLabel field={l.field} />
                </span>
                <span className="text-[13.5px] text-ter">{count > 0 ? `녹화 ${count}회` : "녹화 전"}</span>
                <Icon name="arrow" size={16} className="text-ter group-hover:text-brand" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
