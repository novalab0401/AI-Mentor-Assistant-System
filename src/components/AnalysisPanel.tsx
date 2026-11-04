"use client";

// 피드백 화면의 AI 분석 상태 패널. 분석 시작 버튼, 단계별 진행, 실패 이유와 다시 시도.
// 분석 중에는 3초마다 화면을 새로 받아 진행 단계를 갱신한다.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { AnalysisStage, SessionStatus } from "@/lib/types";
import { Icon } from "./Icon";

const STEPS: { stage: AnalysisStage | "saved"; label: string }[] = [
  { stage: "saved", label: "녹화 저장" },
  { stage: "audio", label: "음성 추출" },
  { stage: "transcribe", label: "음성 인식" },
  { stage: "score", label: "지도안·루브릭 기준 채점" },
  { stage: "review", label: "피드백 검토 체크리스트 8개 확인" },
];

export function AnalysisPanel(props: { sessionId: string; lessonNo: number; status: SessionStatus; stage?: AnalysisStage; error?: string; configProblem: string | null }) {
  const router = useRouter();
  // starting: 시작 요청 중, refreshing: 시작한 뒤 새 상태를 받아 오는 중
  const [starting, setStarting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [startError, setStartError] = useState<string | null>(null);
  const analyzing = props.status === "analyzing" || starting || refreshing;

  useEffect(() => {
    if (props.status !== "analyzing") return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [props.status, router]);

  async function start() {
    setStartError(null);
    setStarting(true);
    try {
      const res = await fetch(`/api/sessions/${props.sessionId}/analyze`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStartError(body.error ?? "분석을 시작하지 못했어요.");
        setStarting(false);
        return;
      }
      // 새 상태가 도착할 때 함께 시작 중 표시를 끈다
      startRefresh(() => {
        setStarting(false);
        router.refresh();
      });
    } catch {
      setStartError("서버에 연결하지 못했어요.");
      setStarting(false);
    }
  }

  // 현재 단계까지는 완료, 현재 단계는 진행 중
  const current = analyzing ? STEPS.findIndex((s) => s.stage === (props.stage ?? "audio")) : props.status === "failed" ? STEPS.findIndex((s) => s.stage === props.stage) : 0;
  const failedAt = props.status === "failed" && !analyzing ? current : -1;

  return (
    <section className="mt-10 border-t border-line pt-8">
      <h2 className="text-[18px] font-semibold text-ink">
        {analyzing ? "AI가 녹화를 분석하고 있어요" : props.status === "failed" ? "분석을 마치지 못했어요" : "녹화가 저장됐어요"}
      </h2>
      <p className="mt-3 max-w-[560px] text-[14px] leading-relaxed text-body">
        {analyzing
          ? `음성을 글로 옮긴 뒤 ${props.lessonNo}차시 지도안과 공통 루브릭 13개 기준으로 피드백을 써요. 녹화 길이에 따라 몇 분 걸려요. 이 화면을 닫아도 분석은 계속돼요.`
          : props.status === "failed"
            ? props.error
            : `분석을 시작하면 음성을 글로 옮긴 뒤 ${props.lessonNo}차시 지도안과 공통 루브릭 13개 기준으로 피드백을 써요.`}
      </p>

      <ol className="mt-6 space-y-3 text-[14px]">
        {STEPS.map(({ stage, label }, i) => {
          const done = i < current || (i === 0 && !analyzing && props.status !== "failed");
          const active = analyzing && i === current;
          const failed = i === failedAt;
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                className={`grid size-5 place-items-center rounded-full ${done ? "bg-brand text-white" : failed ? "bg-alert text-white" : active ? "border-2 border-brand" : "border border-line"}`}
              >
                {done && <Icon name="check" size={12} strokeWidth={2.6} />}
                {failed && <Icon name="alert" size={12} strokeWidth={2.6} />}
                {active && <span className="size-1.5 animate-pulse rounded-full bg-brand motion-reduce:animate-none" />}
              </span>
              <span className={done || active ? "text-ink" : failed ? "text-alert" : "text-ter"}>{label}</span>
              {active && <span className="text-[12.5px] text-sub">진행 중</span>}
            </li>
          );
        })}
      </ol>

      {!analyzing && (
        <div className="mt-8">
          {props.configProblem ? (
            <p className="flex items-start gap-2 text-[13.5px] text-sub">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              AI 분석 설정이 없어 시작할 수 없어요. {props.configProblem}
            </p>
          ) : (
            <>
              <button
                onClick={start}
                disabled={starting}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-[14.5px] font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                <Icon name={props.status === "failed" ? "retry" : "spark"} size={17} />
                {props.status === "failed" ? "다시 분석하기" : "AI 분석 시작"}
              </button>
              <p className="mt-3 max-w-[560px] text-[12.5px] leading-relaxed text-ter">
                녹화 음성이 OpenAI(미국) 서버로 전송돼요. 학생 목소리가 담겼다면 수업 데이터 이용 동의 범위를 확인한 뒤 시작해 주세요.
              </p>
            </>
          )}
          {startError && (
            <p role="status" className="mt-3 text-[13.5px] text-alert">
              {startError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
