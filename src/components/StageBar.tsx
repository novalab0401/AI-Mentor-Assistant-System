import type { LessonStep } from "@/lib/types";

type Stage = { name: string; minutes: number; steps: LessonStep[] };

export function groupStages(steps: LessonStep[]): Stage[] {
  const out: Stage[] = [];
  for (const s of steps) {
    const last = out.at(-1);
    if (last && last.name === s.stage) {
      last.steps.push(s);
      last.minutes += s.minutes ?? 0;
    } else out.push({ name: s.stage, minutes: s.minutes ?? 0, steps: [s] });
  }
  return out;
}

/**
 * 60분 수업의 구조를 시간 비율 그대로 보여 주는 막대.
 * detail=true면 단계 안의 활동까지 칸으로 나눈다.
 */
export function StageBar({ steps, tone = "light", detail = false }: { steps: LessonStep[]; tone?: "light" | "dark"; detail?: boolean }) {
  const stages = groupStages(steps);
  const total = stages.reduce((a, s) => a + s.minutes, 0) || 1;
  const dark = tone === "dark";
  // 전개(가장 긴 단계)를 진하게, 나머지는 옅게
  const main = stages.reduce((a, s) => (s.minutes > a.minutes ? s : a), stages[0]);

  return (
    <figure aria-label={stages.map((s) => `${s.name} ${s.minutes}분`).join(", ")}>
      <div className="flex gap-1">
        {stages.map((st) => (
          <div key={st.name} className="flex gap-[2px]" style={{ flex: st.minutes / total }}>
            {(detail ? st.steps : [{ topic: st.name, minutes: st.minutes } as LessonStep]).map((s) => (
              <span
                key={s.topic}
                title={detail ? `${s.topic} ${s.minutes}분` : undefined}
                className={`h-1.5 rounded-full ${
                  dark ? (st === main ? "bg-white" : "bg-white/40") : st === main ? "bg-brand" : "bg-brand-soft"
                }`}
                style={{ flex: (s.minutes ?? 0) || 0.5 }}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="mt-2.5 flex gap-1 text-[12.5px]">
        {stages.map((st) => (
          <span key={st.name} className={dark ? "text-brand-soft" : "text-sub"} style={{ flex: st.minutes / total, minWidth: "fit-content" }}>
            {st.name} <span className="tnum">{st.minutes}분</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
