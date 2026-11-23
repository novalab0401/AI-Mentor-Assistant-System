"use client";

// 부스 수업 시연 화면. 녹음 대기 → 녹음 중(실시간 녹취·게임 기록·AI 관찰) → 분석 중 → 결과지.
// 녹취와 결과는 미리 만든 자료를 시각에 맞춰 보여 준다. 마이크는 소리 크기 표시에만 쓰고 녹음·저장·전송하지 않는다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoothProps } from "@/lib/booth";
import { Icon } from "../Icon";
import { ResultSheet } from "./ResultSheet";

type Phase = "ready" | "live" | "analyzing" | "done";

const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function BoothStudio(props: BoothProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [runId, setRunId] = useState(0);
  const mic = useMicLevel(phase === "live");

  const start = () => {
    mic.request();
    setRunId((n) => n + 1);
    setPhase("live");
  };
  const reset = () => setPhase("ready");

  return (
    <div className="booth">
      {phase === "ready" && <ReadyView {...props} onStart={start} />}
      {phase === "live" && <LiveView key={runId} {...props} mic={mic} onFinish={() => setPhase("analyzing")} onCancel={reset} />}
      {phase === "analyzing" && <AnalyzingView {...props} onDone={() => setPhase("done")} />}
      {phase === "done" && <ResultSheet {...props} onRestart={reset} />}
    </div>
  );
}

// ---------------- 녹음 대기 ----------------

function ReadyView({ demo, onStart }: BoothProps & { onStart: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !(e.target instanceof HTMLInputElement)) onStart();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onStart]);

  return (
    <section className="bt-ready">
      <p className="bt-eyebrow">
        <Icon name="target" size={15} /> 부스 수업 시연
      </p>
      <h1>{demo.title}</h1>
      <p className="bt-lead">
        {demo.subtitle} · {demo.audience}. 수업하는 동안 강사의 말을 듣고 받아 적어, 끝나면 공통 루브릭 13개 기준으로 피드백을 드려요.
      </p>

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
          <h2 className="mt">게임</h2>
          <p className="bt-game">{demo.game}</p>
        </div>
      </div>

      <div className="bt-start">
        <button type="button" className="bt-rec-btn" onClick={onStart}>
          <span className="bt-rec-dot" aria-hidden />
          녹음 시작
        </button>
        <p>
          마이크를 허용하면 소리 크기에 맞춰 반응해요. 녹음 길이 약 {Math.round(demo.durationSec / 60)}분 · <kbd>Enter</kbd>
        </p>
      </div>
    </section>
  );
}

// ---------------- 녹음 중 ----------------

const SPEEDS = [1, 2, 4] as const;
const TYPE_CPS = 11; // 받아 적는 속도(글자/초, 수업 시간 기준)

function LiveView({ demo, mic, onFinish, onCancel }: BoothProps & { mic: MicState; onFinish: () => void; onCancel: () => void }) {
  const [clock, setClock] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [paused, setPaused] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const finishing = useRef(false);

  // 수업 시계. 끝까지 가면 잠깐 멈췄다가 분석으로 넘어간다.
  useEffect(() => {
    if (paused) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setClock((c) => Math.min(demo.durationSec, c + dt * speed));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, speed, demo.durationSec]);

  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    if (clock < demo.durationSec) return;
    const t = setTimeout(finish, 1200);
    return () => clearTimeout(t);
  }, [clock, demo.durationSec, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "ArrowRight") setClock((c) => Math.min(demo.durationSec, c + 10));
      else if (e.key === "Enter") finish();
      else if (e.key === "Escape") onCancel();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [demo.durationSec, finish, onCancel]);

  // 지금까지 나온 발언·게임 기록을 시각순으로
  const feed = useMemo(() => {
    const items = [
      ...demo.lines.map((l, i) => ({ key: `l${i}`, t: l.t, line: l })),
      ...demo.events.map((e, i) => ({ key: `e${i}`, t: e.t, event: e })),
    ].sort((a, b) => a.t - b.t);
    return items.filter((x) => x.t <= clock);
  }, [demo, clock]);
  const notes = demo.notes.filter((n) => n.t <= clock).reverse();

  // 지금 말하는 중인 문장(받아 적는 중)
  const lastLine = [...demo.lines].reverse().find((l) => l.t <= clock);
  const typing = lastLine ? Math.min(lastLine.text.length, Math.floor((clock - lastLine.t) * TYPE_CPS)) : 0;
  const speaking = Boolean(lastLine && typing < lastLine.text.length);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [feed.length, typing]);

  const scene = demo.scenes.find((s) => clock >= s.start && clock < s.end) ?? demo.scenes.at(-1)!;
  const spoken = demo.lines.filter((l) => l.t <= clock);
  const stats = {
    teacher: spoken.filter((l) => l.who === "강사").length,
    questions: spoken.filter((l) => l.who === "강사" && /[?？]/.test(l.text)).length,
    shots: demo.events.filter((e) => e.t <= clock && /발사/.test(e.text)).length,
    hits: demo.events.filter((e) => e.t <= clock && e.kind === "hit").length,
  };
  const ended = clock >= demo.durationSec;

  return (
    <section className="bt-live">
      <header className="bt-live-head">
        <div>
          <p className="bt-eyebrow">
            <Icon name="target" size={15} /> {demo.title}
          </p>
          <h1>
            장면 {scene.no} · {scene.title}
          </h1>
        </div>
        <div className="bt-live-ctl">
          <span className={`bt-rec ${paused || ended ? "off" : ""}`} aria-live="off">
            <i aria-hidden />
            {ended ? "녹음 끝" : paused ? "일시정지" : "REC"}
            <b className="tnum">
              {mmss(clock)} <small>/ {mmss(demo.durationSec)}</small>
            </b>
          </span>
          <div className="bt-seg" role="group" aria-label="재생 속도">
            {SPEEDS.map((s) => (
              <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
          <button type="button" className="bt-ghost" onClick={() => setPaused((p) => !p)} aria-label={paused ? "이어서" : "일시정지"}>
            <Icon name={paused ? "play" : "stop"} size={14} />
          </button>
          <button type="button" className="bt-primary" onClick={finish}>
            녹음 끝내고 분석
          </button>
        </div>
      </header>

      <div className="bt-progress" aria-hidden>
        {demo.scenes.map((s) => {
          const w = ((s.end - s.start) / demo.durationSec) * 100;
          const fill = Math.max(0, Math.min(1, (clock - s.start) / (s.end - s.start)));
          return (
            <div key={s.no} style={{ width: `${w}%` }} className={s.no === scene.no ? "on" : ""}>
              <i style={{ transform: `scaleX(${fill})` }} />
              <span>{s.title}</span>
            </div>
          );
        })}
      </div>

      <div className="bt-live-grid">
        <div className="bt-card bt-feed-card">
          <h2>
            실시간 녹취
            <span className="bt-badge">
              <i className={speaking ? "on" : ""} aria-hidden />
              {speaking ? "받아 적는 중" : "듣는 중"}
            </span>
          </h2>
          <div className="bt-feed" ref={feedRef} aria-live="polite">
            {feed.length === 0 && <p className="bt-empty">강사의 첫 마디를 기다리고 있어요…</p>}
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
              const text = isLast ? l.text.slice(0, typing) : l.text;
              return (
                <div key={x.key} className={`bt-line ${l.who === "강사" ? "t" : "s"}`}>
                  <span className="tnum">{mmss(l.t)}</span>
                  <b>{l.who}</b>
                  <p>
                    {text}
                    {isLast && speaking && <i className="bt-caret" aria-hidden />}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="bt-side">
          <div className="bt-card bt-mic">
            <h2>
              음성
              <span className={`bt-mic-state ${mic.status}`}>{mic.status === "on" ? "마이크 연결됨" : mic.status === "asking" ? "마이크 확인 중" : "내장 음성 입력"}</span>
            </h2>
            <Waveform mic={mic} speaking={speaking && !paused} />
          </div>

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
              <Icon name="spark" size={15} className="text-brand" /> AI 실시간 관찰 <span className="bt-count tnum">{notes.length}</span>
            </h2>
            <ul className="bt-notes">
              {notes.length === 0 && <li className="bt-empty">수업 장면을 분석하고 있어요</li>}
              {notes.map((n) => (
                <li key={n.t} className={n.tone}>
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
        <kbd>Space</kbd> 일시정지 · <kbd>→</kbd> 10초 앞으로 · <kbd>Enter</kbd> 분석 · <kbd>Esc</kbd> 처음으로
      </p>
    </section>
  );
}

// ---------------- 마이크 소리 크기 ----------------

type MicState = { status: "idle" | "asking" | "on" | "off"; level: React.RefObject<number>; request: () => void };

/** 마이크 소리 크기(0~1)만 읽는다. 녹음·저장·전송은 하지 않는다. 허용하지 않으면 화면의 말소리 흐름으로 대신 움직인다. */
function useMicLevel(active: boolean): MicState {
  const [status, setStatus] = useState<MicState["status"]>("idle");
  const level = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const request = useCallback(() => {
    if (streamRef.current || !navigator.mediaDevices?.getUserMedia) {
      if (!navigator.mediaDevices?.getUserMedia) setStatus("off");
      return;
    }
    setStatus("asking");
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((stream) => {
        streamRef.current = stream;
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const read = () => {
          if (!ctxRef.current) return;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += ((v - 128) / 128) ** 2;
          level.current = Math.min(1, Math.sqrt(sum / buf.length) * 5);
          requestAnimationFrame(read);
        };
        read();
        setStatus("on");
      })
      .catch(() => setStatus("off"));
  }, []);

  // 녹음 화면을 벗어나면 마이크를 끈다
  useEffect(() => {
    if (active) return;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    level.current = 0;
  }, [active]);

  return { status, level, request };
}

const BARS = 40;

function Waveform({ mic, speaking }: { mic: MicState; speaking: boolean }) {
  const [bars, setBars] = useState<number[]>(() => Array(BARS).fill(0.04));
  const speakingRef = useRef(speaking);
  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(() => {
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      // 실제 마이크 소리와, 화면 속 강사가 말하는 동안의 말소리 흐름 중 큰 쪽
      const synth = speakingRef.current ? 0.25 + 0.55 * Math.abs(Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1)) * (0.6 + Math.random() * 0.4) : 0.03 + Math.random() * 0.04;
      const v = Math.max(mic.level.current ?? 0, synth);
      setBars((b) => [...b.slice(1), v]);
    }, 70);
    return () => clearInterval(id);
  }, [mic.level]);

  return (
    <div className="bt-wave" aria-hidden>
      {bars.map((v, i) => (
        <i key={i} style={{ transform: `scaleY(${Math.max(0.06, v)})`, opacity: 0.35 + (i / BARS) * 0.65 }} />
      ))}
    </div>
  );
}

// ---------------- 분석 중 ----------------

function AnalyzingView({ demo, result, rubric, checklist, onDone }: BoothProps & { onDone: () => void }) {
  const fb = result.feedback;
  const teacherLines = demo.lines.filter((l) => l.who === "강사").length;
  const evidence = Object.values(fb.criteria).reduce((a, c) => a + c.evidence.length, 0);
  const steps = [
    { label: "녹음 정리 · 음성 인식", detail: `${demo.lines.length}문장 · ${mmss(demo.durationSec)}`, ms: 2200 },
    { label: "화자 구분", detail: `강사 ${teacherLines} · 관람객 ${demo.lines.length - teacherLines}`, ms: 1500 },
    { label: "게임 기록과 발화 시각 맞추기", detail: `게임 이벤트 ${demo.events.length}개 연결`, ms: 1500 },
    { label: "공통 루브릭 13개 항목 채점", detail: "지도안·녹취를 맞대어 점수와 근거 작성", ms: 3900 },
    { label: "근거 발언을 녹취와 대조", detail: `근거 ${evidence}개 모두 녹취에서 확인`, ms: 1500 },
    { label: "AI 자체 검토", detail: `체크리스트 ${checklist.length}개 확인`, ms: 2600 },
  ];
  const [elapsed, setElapsed] = useState(0);
  const total = steps.reduce((a, s) => a + s.ms, 0);

  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setElapsed(now - t0);
      if (now - t0 < total + 900) raf = requestAnimationFrame(tick);
      else onDone();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, onDone]);

  let acc = 0;
  const bounds = steps.map((s) => {
    const b = { start: acc, end: acc + s.ms };
    acc += s.ms;
    return b;
  });
  const cur = bounds.findIndex((b) => elapsed < b.end);
  const scoreStep = bounds[3];
  const rubricDone = Math.floor(Math.max(0, Math.min(1, (elapsed - scoreStep.start) / (scoreStep.end - scoreStep.start))) * rubric.length);
  const reviewStep = bounds[5];
  const reviewDone = Math.floor(Math.max(0, Math.min(1, (elapsed - reviewStep.start) / (reviewStep.end - reviewStep.start))) * checklist.length);
  const notes = new Map((fb.review.notes ?? []).map((n) => [n.name, n.passed]));
  const pct = Math.min(100, Math.round((elapsed / total) * 100));

  return (
    <section className="bt-analyze" aria-live="polite">
      <p className="bt-eyebrow">
        <Icon name="spark" size={15} /> AI 분석
      </p>
      <h1>{cur === -1 ? "결과지를 만들고 있어요" : `${steps[cur].label} 중…`}</h1>
      <div className="bt-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>

      <div className="bt-analyze-grid">
        <ol className="bt-steps">
          {steps.map((s, i) => {
            const state = cur === -1 || i < cur ? "done" : i === cur ? "now" : "wait";
            return (
              <li key={s.label} className={state}>
                <span className="bt-step-mark">{state === "done" ? <Icon name="check" size={13} strokeWidth={2.4} /> : i + 1}</span>
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
              const done = i < rubricDone;
              return (
                <li key={r.id} className={done ? "done" : i === rubricDone && cur === 3 ? "now" : ""}>
                  <span>{r.name}</span>
                  <b className="tnum">{done ? (sc == null ? "판단 불가" : `${sc}점`) : i === rubricDone && cur === 3 ? "…" : ""}</b>
                </li>
              );
            })}
          </ul>
          <h2 className="mt">자체 검토</h2>
          <ul className="bt-check">
            {checklist.map((name, i) => (
              <li key={name} className={i < reviewDone ? (notes.get(name) ? "pass" : "flag") : ""}>
                <i aria-hidden>{i < reviewDone ? (notes.get(name) ? "✓" : "!") : ""}</i>
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
