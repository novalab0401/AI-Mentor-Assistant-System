import Link from "next/link";
import { FieldIcon, Icon } from "@/components/Icon";
import { lessons } from "@/server/content";

// 표준 강의 영상은 아직 제작 전. 차시별로 영상이 다룰 학습 목표를 먼저 보여 준다.
export default function LecturesPage() {
  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">표준 강의</h1>
      <p className="mt-2 text-[14px] text-sub">차시마다 꼭 맞게 설명해야 할 내용을 담은 기준 영상이에요. 영상은 제작 중이고, 지금은 영상이 다룰 학습 목표를 볼 수 있어요.</p>
      <ol className="mt-8 border-t border-line">
        {lessons.map((l) => (
          <li key={l.no} className="grid grid-cols-[72px_120px_1fr_100px] items-start gap-x-6 border-b border-line py-5 pl-1">
            <span className="tnum text-[18px] font-light text-ter">{String(l.no).padStart(2, "0")}</span>
            <div className="grid aspect-video place-items-center rounded-lg border border-line bg-side text-ter" aria-hidden="true">
              <Icon name="video" size={20} />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[12.5px] text-ter">
                <FieldIcon field={l.field} size={14} />
                {l.field}
              </p>
              <Link href={`/lessons/${l.no}`} className="mt-1 block text-[15px] text-ink hover:text-brand">
                {l.title}
              </Link>
              <ul className="mt-2 space-y-1 text-[13.5px] leading-relaxed text-sub">
                {l.goals.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
            <span className="text-right text-[13.5px] text-ter">제작 전</span>
          </li>
        ))}
      </ol>
    </>
  );
}
