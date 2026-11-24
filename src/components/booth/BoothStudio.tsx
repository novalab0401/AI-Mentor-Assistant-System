"use client";

// 부스 수업 화면. 녹음된 3분 체험 수업을 불러와 분석하는 흐름으로 보여 준다.
// 분석 대기 → 음성 분석(녹음을 4배속으로 훑으며 음성 인식·게임 기록·장면 관찰) → 채점·검토 → 결과지.
// 음성 기록과 결과는 미리 만든 자료(content/booth)를 시각에 맞춰 보여 준다. 마이크·카메라는 쓰지 않는다.
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoothDemoData, BoothProps } from "@/lib/booth";
import { Icon } from "../Icon";
import { ResultSheet } from "./ResultSheet";

type Phase = "ready" | "live" | "analyzing" | "done";

const SPEED = 4; // 녹음을 훑는 속도(배속)
const TYPE_CPS = 11; // 받아 적는 속도(글자/초, 녹음 시간 기준)
const FILE_NAME = "laser-challenge-수업.m4a";

/** 화면 위쪽에 보이는 전체 분석 단계. 음성 분석은 LiveView, 나머지는 AnalyzingView가 진행한다. */
const PIPELINE = ["음성 분석", "루브릭 채점", "근거 대조", "자체 검토", "리포트"] as const;

const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function BoothStudio(props: BoothProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [runId, setRunId] = useState(0);
  const start = () => {
    setRunId((n) => n + 1);
    setPhase("live");
  };
  const reset = useCallback(() => setPhase("ready"), []);
  const toAnalyze = useCallback(() => setPhase("analyzing"), []);
  const toDone = useCallback(() => setPhase("done"), []);

  return (
    <div className="booth">
      {phase === "ready" && <ReadyView {...props} onStart={start} />}
      {phase === "live" && <LiveView key={runId} {...props} onFinish={toAnalyze} onStop={reset} />}
      {phase === "analyzing" && <AnalyzingView {...props} onDone={toDone} onStop={reset} />}
      {phase === "done" && <ResultSheet {...props} onRestart={reset} />}
    </div>
  );
}

// ---------------- 녹음 파형 ----------------

/** 녹음 파형 모양(0~1). 말하는 구간은 크게, 조용한 구간은 작게. 매번 같은 모양이 나오도록 고정된 의사 난수를 쓴다. */
function useWaveShape(demo: BoothDemoData, bars: number) {
  return useMemo(() => {
    const rand = (n: number) => {
      const x = Math.sin(n * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    const speech = demo.lines.map((l) => [l.t, l.t + Math.max(2, l.text.length / 7)] as const);
    return Array.from({ length: bars }, (_, i) => {
      const t = ((i + 0.5) / bars) * demo.durationSec;
      const talking = speech.some(([a, b]) => t >= a && t <= b);
      // 서버·브라우저 계산 끝자리가 달라 화면이 어긋나지 않게 소수 셋째 자리로 맞춘다
      return Math.round((talking ? 0.35 + rand(i) * 0.65 : 0.06 + rand(i) * 0.12) * 1000) / 1000;
    });
  }, [demo, bars]);
}

function Waveform({ demo, at, bars = 120 }: { demo: BoothDemoData; at: number; bars?: number }) {
  const shape = useWaveShape(demo, bars);
  const head = (at / demo.durationSec) * 100;
  return (
    <div className="bt-wave" aria-hidden>
      {shape.map((v, i) => (
        <i key={i} className={(i + 0.5) / bars <= at / demo.durationSec ? "on" : ""} style={{ transform: `scaleY(${v})` }} />
      ))}
      {at > 0 && <b className="bt-head" style={{ left: `${head}%` }} />}
    </div>
  );
}

function FileInfo({ demo }: { demo: BoothDemoData }) {
  const teacher = demo.lines.filter((l) => l.who === "강사").length;
  return (
    <p className="bt-file">
      <Icon name="mic" size={15} />
      <b>{FILE_NAME}</b>
      <span className="tnum">{mmss(demo.durationSec)}</span>
      <span>
        발화 {demo.lines.length}문장 (강사 {teacher}) · 게임 기록 {demo.events.length}건
      </span>
    </p>
  );
}

// ---------------- 분석 단계 표시(오른쪽 위) ----------------

function Pipeline({ step, pct, onStop }: { step: number; pct: number; onStop: () => void }) {
  return (
    <div className="bt-pipe">
      <ol aria-label="분석 단계">
        {PIPELINE.map((name, i) => (
          <li key={name} className={i < step ? "done" : i === step ? "now" : ""} aria-current={i === step ? "step" : undefined}>
            <span>{i < step ? <Icon name="check" size={11} strokeWidth={2.6} /> : i + 1}</span>
            {name}
          </li>
        ))}
      </ol>
      <div className="bt-pipe-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="전체 분석 진행률">
        <i style={{ width: `${pct}%` }} />
      </div>
      <button type="button" className="bt-stop" onClick={onStop}>
        <Icon name="stop" size={12} /> 중지
      </button>
    </div>
  );
}

/** 전체 진행률: 음성 분석 60%, 나머지 단계 40%. */
const overall = (phase: "live" | "analyzing", p: number) => (phase === "live" ? p * 60 : 60 + p * 40);

// ---------------- 분석 대기 ----------------

function ReadyView({ demo, onStart }: BoothProps & { onStart: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") onStart();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onStart]);

  return (
    <section className="bt-ready">
      <header className="bt-ready-head">
        <div>
          <p className="bt-eyebrow">
            <Icon name="target" size={15} /> 부스 체험 수업
          </p>
          <h1>{demo.title}</h1>
        </div>
        <button type="button" className="bt-primary bt-go-sm" onClick={onStart}>
          <Icon name="spark" size={15} /> 분석 시작
        </button>
      </header>
      <p className="bt-lead">
        {demo.subtitle} 녹음을 불러왔어요. 녹음을 처음부터 훑으며 강사의 말과 게임 기록을 맞춰 보고, 공통 루브릭 13개 기준으로 피드백을 만들어요.
      </p>

      <section className="bt-game-intro" aria-labelledby="game-h">
        <figure className="bt-shot main">
          <Image src="/booth/laser-home.webp" alt="레이저 챌린지 처음 화면. 레이저와 거울, 1·2·3 타깃, 쉬움·보통·어려움·마스터 난이도 카드" width={1600} height={900} unoptimized priority />
        </figure>
        <div className="bt-how">
          <h2 id="game-h">레이저 챌린지</h2>
          <p className="bt-how-lead">손을 거울처럼 기울여 레이저를 반사시키고, 색깔 타깃을 정해진 순서대로 맞히는 빛의 반사 게임이에요.</p>
          <ol>
            <li>
              <b>난이도 고르기</b>
              <span>손으로 카드를 1초 가리키면 시작해요. 이번 수업은 MISSION 04 「빛의 미로」(타깃 4개 · 60초 · 6발)예요.</span>
            </li>
            <li>
              <b>손가락으로 거울 각도 맞추기</b>
              <span>손가락이 가리키는 방향이 거울 방향이에요. 왼손은 왼쪽 거울, 오른손은 오른쪽 거울을 움직여요.</span>
            </li>
            <li>
              <b>주먹을 쥐어 발사</b>
              <span>빨강 → 노랑 → 파랑 → 초록 순서로 맞히면 성공이에요. 순서가 틀리면 인정되지 않아요.</span>
            </li>
          </ol>
        </div>
      </section>

      <section className="bt-game-intro alt" aria-label="배우는 원리">
        <div className="bt-how">
          <h2>배우는 원리 · 반사의 법칙</h2>
          <p className="bt-how-lead">
            빛은 거울에 들어온 각도(입사각)와 같은 각도(반사각)로 나가요. 거울 각도를 바꾸면 빛이 가는 방향이 바뀌니까, 빛의 경로를 미리 예측해야 타깃을 순서대로 맞힐 수 있어요.
          </p>
          <p className="bt-cap">오른쪽은 MISSION 04의 정답 경로예요. 거울 다섯 개를 지나는 한 줄기 빛이 네 타깃을 모두 순서대로 지나가요.</p>
        </div>
        <figure className="bt-shot">
          <Image src="/booth/laser-mission04.webp" alt="MISSION 04 빛의 미로 정답 경로. 레이저가 거울 다섯 개에서 반사되며 빨강, 노랑, 파랑, 초록 타깃을 차례로 지난다" width={1600} height={900} unoptimized />
        </figure>
      </section>

      <div className="bt-ready-grid">
        <div className="bt-card">
          <h2>수업 흐름</h2>
          <ol className="bt-scenes">
            {demo.scenes.map((s) => (
              <li key={s.no}>
                <span className="tnum">{mmss(s.start)}</span>
                <b>{s.title}</b>
              </li>
            ))}
          </ol>
        </div>
        <div className="bt-card">
          <h2>학습 목표</h2>
          <ul className="bt-goals">
            {demo.goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bt-start">
        <button type="button" className="bt-go-btn" onClick={onStart}>
          <Icon name="spark" size={18} />
          분석 시작
        </button>
      </div>
    </section>
  );
}

// ---------------- 음성 분석(녹음을 훑으며) ----------------

function LiveView({ demo, onFinish, onStop }: BoothProps & { onFinish: () => void; onStop: () => void }) {
  const [clock, setClock] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setClock((c) => Math.min(demo.durationSec, c + dt * SPEED));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [demo.durationSec]);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    if (clock < demo.durationSec) return;
    const t = setTimeout(finish, 900);
    return () => clearTimeout(t);
  }, [clock, demo.durationSec, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStop();
      else if (e.key === "ArrowRight") setClock((c) => Math.min(demo.durationSec, c + 20));
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [demo.durationSec, onStop]);

  const feed = useMemo(() => {
    const items = [
      ...demo.lines.map((l, i) => ({ key: `l${i}`, t: l.t, line: l })),
      ...demo.events.map((e, i) => ({ key: `e${i}`, t: e.t, event: e })),
    ].sort((a, b) => a.t - b.t);
    return items.filter((x) => x.t <= clock);
  }, [demo, clock]);
  const notes = demo.notes.filter((n) => n.t <= clock).reverse();

  const lastLine = [...demo.lines].reverse().find((l) => l.t <= clock);
  const typing = lastLine ? Math.min(lastLine.text.length, Math.floor((clock - lastLine.t) * TYPE_CPS)) : 0;
  const writing = Boolean(lastLine && typing < lastLine.text.length);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [feed.length, typing]);

  const scene = demo.scenes.find((s) => clock >= s.start && clock < s.end) ?? demo.scenes.at(-1)!;
  const heard = demo.lines.filter((l) => l.t <= clock);
  const stats = {
    teacher: heard.filter((l) => l.who === "강사").length,
    questions: heard.filter((l) => l.who === "강사" && /[?？]/.test(l.text)).length,
    shots: demo.events.filter((e) => e.t <= clock && /발사/.test(e.text)).length,
    hits: demo.events.filter((e) => e.t <= clock && e.kind === "hit").length,
  };
  const p = clock / demo.durationSec;

  return (
    <section className="bt-live">
      <header className="bt-live-head">
        <div>
          <p className="bt-eyebrow">
            <Icon name="spark" size={15} /> 녹음 분석 중 · {demo.title}
          </p>
          <h1>
            장면 {scene.no} · {scene.title}
          </h1>
        </div>
        <Pipeline step={0} pct={overall("live", p)} onStop={onStop} />
      </header>

      <div className="bt-card bt-file-card bt-file-live">
        <div className="bt-file-row">
          <FileInfo demo={demo} />
          <span className="bt-pos tnum">
            {mmss(clock)} <small>/ {mmss(demo.durationSec)}</small>
            <em>{SPEED}× 분석</em>
          </span>
        </div>
        <Waveform demo={demo} at={clock} />
        <div className="bt-progress" aria-hidden>
          {demo.scenes.map((s) => (
            <div key={s.no} style={{ width: `${((s.end - s.start) / demo.durationSec) * 100}%` }} className={s.no === scene.no ? "on" : clock >= s.end ? "past" : ""}>
              <span>{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bt-live-grid">
        <div className="bt-card bt-feed-card">
          <h2>
            수업 음성 기록
            <span className="bt-badge">
              <i className={writing ? "on" : ""} aria-hidden />
              {p >= 1 ? "음성 인식 완료" : writing ? "음성 인식 중" : "다음 발화 찾는 중"}
            </span>
          </h2>
          <div className="bt-feed" ref={feedRef} aria-live="polite">
            {feed.length === 0 && <p className="bt-empty">녹음에서 첫 발화를 찾고 있어요…</p>}
            {feed.map((x) => {
              if ("event" in x && x.event) {
                return (
                  <div key={x.key} className={`bt-ev ${x.event.kind}`}>
                    <span className="tnum">{mmss(x.t)}</span>
                    <b>게임</b>
                    {x.event.text}
                  </div>
                );
              }
              if (!("line" in x)) return null;
              const l = x.line;
              const isLast = l === lastLine;
              return (
                <div key={x.key} className={`bt-line ${l.who === "강사" ? "t" : "s"} ${isLast ? "cur" : ""}`}>
                  <span className="tnum">{mmss(l.t)}</span>
                  <b>{l.who}</b>
                  <p>
                    {isLast ? l.text.slice(0, typing) : l.text}
                    {isLast && writing && <i className="bt-caret" aria-hidden />}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="bt-side">
          <div className="bt-stats">
            <div>
              <b className="tnum">{stats.teacher}</b>강사 발화
            </div>
            <div>
              <b className="tnum">{stats.questions}</b>질문
            </div>
            <div>
              <b className="tnum">{stats.shots}</b>발사
            </div>
            <div>
              <b className="tnum">{stats.hits}</b>명중
            </div>
          </div>

          <div className="bt-card bt-notes-card">
            <h2>
              <Icon name="spark" size={15} className="text-brand" /> AI 장면 관찰 <span className="bt-count tnum">{notes.length}</span>
            </h2>
            <ul className="bt-notes">
              {notes.length === 0 && <li className="bt-empty">장면을 살펴보고 있어요</li>}
              {notes.map((n) => (
                <li key={n.t}>
                  <div>
                    <span className="tnum">{mmss(n.t)}</span>
                    <b>{n.area}</b>
                  </div>
                  <p>{n.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      <p className="bt-keys">
        <kbd>→</kbd> 20초 건너뛰기 · <kbd>Esc</kbd> 중지
      </p>
    </section>
  );
}

// ---------------- 채점·검토 ----------------

function AnalyzingView({ result, rubric, checklist, onDone, onStop }: BoothProps & { onDone: () => void; onStop: () => void }) {
  const fb = result.feedback;
  const evidence = Object.values(fb.criteria).reduce((a, c) => a + c.evidence.length, 0);
  // PIPELINE[1..4]와 같은 순서
  const steps = [
    { label: "공통 루브릭 13개 항목 채점", detail: "지도안·음성 기록을 맞대어 점수와 근거 작성", ms: 3900 },
    { label: "근거 발언을 음성 기록과 대조", detail: `근거 ${evidence}개 모두 음성 기록에서 확인`, ms: 1500 },
    { label: "AI 자체 검토", detail: `체크리스트 ${checklist.length}개 확인`, ms: 2600 },
    { label: "리포트 작성", detail: "점수·근거·다음 행동 정리", ms: 1100 },
  ];
  const [elapsed, setElapsed] = useState(0);
  const total = steps.reduce((a, s) => a + s.ms, 0);

  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setElapsed(now - t0);
      if (now - t0 < total + 600) raf = requestAnimationFrame(tick);
      else onDone();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStop();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onStop]);

  let acc = 0;
  const bounds = steps.map((s) => {
    const b = { start: acc, end: acc + s.ms };
    acc += s.ms;
    return b;
  });
  const cur = bounds.findIndex((b) => elapsed < b.end);
  const frac = (b: { start: number; end: number }) => Math.max(0, Math.min(1, (elapsed - b.start) / (b.end - b.start)));
  const rubricDone = Math.floor(frac(bounds[0]) * rubric.length);
  const reviewDone = Math.floor(frac(bounds[2]) * checklist.length);
  const notes = new Map((fb.review.notes ?? []).map((n) => [n.name, n.passed]));
  const p = Math.min(1, elapsed / total);

  return (
    <section className="bt-analyze" aria-live="polite">
      <header className="bt-live-head">
        <div>
          <p className="bt-eyebrow">
            <Icon name="spark" size={15} /> 녹음 분석 중
          </p>
          <h1>{cur === -1 ? "리포트를 열고 있어요" : `${steps[cur].label} 중…`}</h1>
        </div>
        <Pipeline step={cur === -1 ? 4 : cur + 1} pct={overall("analyzing", p)} onStop={onStop} />
      </header>

      <div className="bt-analyze-grid">
        <ol className="bt-steps">
          <li className="done">
            <span className="bt-step-mark">
              <Icon name="check" size={13} strokeWidth={2.4} />
            </span>
            <div>
              <b>음성 분석</b>
              <small>음성 인식 · 화자 구분 · 게임 기록 연결 · 장면 관찰</small>
            </div>
          </li>
          {steps.map((s, i) => {
            const state = cur === -1 || i < cur ? "done" : i === cur ? "now" : "wait";
            return (
              <li key={s.label} className={state}>
                <span className="bt-step-mark">{state === "done" ? <Icon name="check" size={13} strokeWidth={2.4} /> : i + 2}</span>
                <div>
                  <b>{s.label}</b>
                  <small>{state === "wait" ? "대기" : s.detail}</small>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="bt-card bt-scoring">
          <h2>루브릭 채점</h2>
          <ul>
            {rubric.map((r, i) => {
              const sc = fb.criteria[r.id]?.score;
              const done = i < rubricDone || cur > 0 || cur === -1;
              const now = cur === 0 && i === rubricDone;
              return (
                <li key={r.id} className={done ? "done" : now ? "now" : ""}>
                  <span>{r.name}</span>
                  <b className="tnum">{done ? (sc == null ? "판단 불가" : `${sc}점`) : now ? "…" : ""}</b>
                </li>
              );
            })}
          </ul>
          <h2 className="mt">자체 검토</h2>
          <ul className="bt-check">
            {checklist.map((name, i) => {
              const done = i < reviewDone || cur === 3 || cur === -1;
              return (
                <li key={name} className={done ? (notes.get(name) ? "pass" : "flag") : ""}>
                  <i aria-hidden>{done ? (notes.get(name) ? "✓" : "!") : ""}</i>
                  {name}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
