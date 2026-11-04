import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Recorder } from "@/components/Recorder";
import { getLesson } from "@/server/content";

export default async function PracticeLessonPage(props: PageProps<"/practice/[no]">) {
  const { no } = await props.params;
  const lesson = getLesson(Number(no));
  if (!lesson) notFound();
  return (
    <>
      <Link href="/practice" className="inline-flex items-center gap-1.5 text-[13px] text-sub hover:text-ink">
        <Icon name="back" size={15} />
        모의수업
      </Link>
      <header className="mb-8 mt-6">
        <p className="text-[13px] text-sub">
          {lesson.no}차시 <span className="ml-2 text-ter">{lesson.field}</span>
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink">{lesson.title}</h1>
      </header>
      <Recorder lesson={lesson} />
    </>
  );
}
