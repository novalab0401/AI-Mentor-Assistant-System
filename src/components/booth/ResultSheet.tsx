"use client";

// 부스 시연 결과지. 모의수업 결과지(A4) 형식: 루브릭 항목 분석 · 근거 발언 타임라인 · AI 피드백 | 점수 · 점수 올리기 · 감점 · 분포 · 목표 · 과정.
import { useEffect, useState } from "react";
import type { BoothProps } from "@/lib/booth";
import { Icon } from "../Icon";

const GROUPS: { label: string; ids: string[] }[] = [
  { label: "안내·설명", ids: ["c_goal", "c_instruction", "c_accuracy", "c_clarity"] },
  { label: "확인·조정", ids: ["c_question", "c_check", "c_adjust"] },
  { label: "도움·피드백", ids: ["c_scaffold", "c_feedback", "c_follow"] },
  { label: "참여·안전", ids: ["c_active", "c_participation", "c_safety"] },
];

const SHORT: Record<string, string> = {
  c_goal: "학습 목적 안내",
  c_instruction: "활동 절차 안내",
  c_accuracy: "내용 정확성",
  c_clarity: "눈높이 설명",
  c_question: "사고를 이끄는 질문",
  c_check: "이해 확인",
  c_adjust: "이해에 맞춘 조정",
  c_scaffold: "도움 조절",
  c_feedback: "구체적 피드백",
  c_follow: "피드백 뒤 확인",
  c_active: "직접 수행 시간",
  c_participation: "참여 기회",
  c_safety: "실습 안전",
};

const toSec = (t: string) => {
  const [m, s] = t.split(":").map(Number);
  return m * 60 + s;
};
const tone = (s: number | null) => (s === null ? "na" : s <= 2 ? "lo" : s === 3 ? "md" : "hi");

export function ResultSheet({ demo, result, rubric, onRestart }: BoothProps & { onRestart: () => void }) {
  const fb = result.feedback;
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const rows = rubric.map((r) => {
    const sc = fb.criteria[r.id]?.score ?? null;
    return { ...r, score: sc, pt: sc === null ? null : (r.weight * sc) / 5 };
  });
  const scored = rows.filter((r) => r.pt !== null);
  const possible = scored.reduce((a, r) => a + r.weight, 0);
  const earned = scored.reduce((a, r) => a + (r.pt ?? 0), 0);
  const total = Math.round((earned / possible) * 100);
  const byId = new Map(rows.map((r) => [r.id, r]));

  // 4점까지 올렸을 때 늘어나는 점수(100점 환산)
  const gains = scored
    .filter((r) => (r.score ?? 5) < 4)
    .map((r) => ({ r, gain: ((r.weight * (4 - (r.score ?? 0))) / 5 / possible) * 100 }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3);
  const target = Math.min(100, Math.round(total + gains.reduce((a, g) => a + g.gain, 0)));
  const losses = scored
    .map((r) => ({ r, loss: r.weight - (r.pt ?? 0) }))
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 4);
  const dist = {
    hi: rows.filter((r) => (r.score ?? 0) >= 4).length,
    md: rows.filter((r) => r.score === 3).length,
    lo: rows.filter((r) => r.score !== null && r.score <= 2).length,
    na: rows.filter((r) => r.score === null).length,
  };

  // 근거로 가장 많이 인용된 장면
  const cites = new Map<string, { time: string; quote: string; ids: string[] }>();
  for (const r of rubric)
    for (const e of fb.criteria[r.id]?.evidence ?? []) {
      const c = cites.get(e.time) ?? { time: e.time, quote: e.quote, ids: [] };
      c.ids.push(r.id);
      cites.set(e.time, c);
    }
  const top = [...cites.values()].sort((a, b) => b.ids.length - a.ids.length || toSec(a.time) - toSec(b.time)).slice(0, 3);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 60);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1300);
      setCount(Math.round(total * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [total]);

  const today = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).format(new Date()).replace(/\s/g, "").replace(/\.$/, "");
  const X = (sec: number) => 10 + (sec / demo.durationSec) * 500;

  return (
    <section className={`rs ${shown ? "shown" : ""}`}>
      <div className="rs-actions">
        <button type="button" className="bt-ghost" onClick={onRestart}>
          <Icon name="retry" size={14} /> 처음으로
        </button>
        <button type="button" className="bt-ghost" onClick={() => print()}>
          <Icon name="download" size={14} /> 인쇄 · PDF
        </button>
      </div>

      <article className="sheet" aria-label="부스 시연 결과지">
        <header className="top">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nova-lab-mark.svg" alt="" />
            <h1>
              <small>NOVA COACH</small>부스 시연 결과지
            </h1>
          </div>
          <div className="org">
            <b>Nova Lab</b>
            <br />
            공통 루브릭 13개 항목 · AI 피드백
          </div>
        </header>

        <dl className="info">
          <div>
            <dt>강사</dt>
            <dd>{demo.teacher}</dd>
          </div>
          <div>
            <dt>수업</dt>
            <dd>{demo.title}</dd>
          </div>
          <div>
            <dt>형식 · 대상</dt>
            <dd>부스 체험 · {demo.audience}</dd>
          </div>
          <div>
            <dt>녹음 길이</dt>
            <dd className="tnum">{`${Math.floor(demo.durationSec / 60)}분 ${String(demo.durationSec % 60).padStart(2, "0")}초`}</dd>
          </div>
          <div>
            <dt>평가일</dt>
            <dd className="tnum">{today}</dd>
          </div>
        </dl>

        <div className="cols">
          <div className="main">
            <section className="sec">
              <h2>
                루브릭 항목 분석<em>항목을 누르면 근거 발언이 보여요</em>
              </h2>
              <div className="rub">
                <div className="rh">
                  <span />
                  <span className="nmh">항목</span>
                  <div className="zones">
                    <span>
                      개선 필요<b>1–2점</b>
                    </span>
                    <span>
                      보통<b>3점</b>
                    </span>
                    <span>
                      잘함<b>4–5점</b>
                    </span>
                  </div>
                  <span className="c">점수</span>
                  <span className="c">획득/배점</span>
                </div>
                {GROUPS.map((g) => (
                  <div className="grp" key={g.label}>
                    <div className="gl">{g.label}</div>
                    <div className="rows">
                      {g.ids.map((id, k) => {
                        const r = byId.get(id)!;
                        const c = fb.criteria[id];
                        const t = tone(r.score);
                        const isOpen = open === id;
                        return (
                          <div key={id} className={`rrw ${isOpen ? "open" : ""}`}>
                            <button type="button" className="rr" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>
                              <span className="nm">
                                {r.name}
                                {r.critical && <i>필수</i>}
                              </span>
                              <span className="track">
                                {r.score !== null ? (
                                  <i className={`fill ${t}`} style={{ width: shown ? `${r.score * 20}%` : 0, transitionDelay: `${(GROUPS.indexOf(g) * 4 + k) * 60}ms` }} />
                                ) : (
                                  <em className="na-txt">판단 불가 · 화면 속 가상 레이저라 안전 점검 장면이 없어요</em>
                                )}
                              </span>
                              <span className={`sc ${t}`}>{r.score ?? "–"}</span>
                              <span className="pt">
                                <b>{r.pt === null ? "–" : r.pt.toFixed(1)}</b>/{r.weight}
                              </span>
                            </button>
                            {isOpen && c && (
                              <div className="detail">
                                <ol className="levels" aria-label="1~5점 수준">
                                  {r.levels.map((lv, n) => (
                                    <li key={n} className={r.score === n + 1 ? "got" : ""} aria-current={r.score === n + 1 ? "true" : undefined}>
                                      <b>{n + 1}점</b>
                                      {lv}
                                    </li>
                                  ))}
                                </ol>
                                <p>{c.reason}</p>
                                {c.evidence.map((e) => (
                                  <blockquote key={e.time}>
                                    <time>{e.time}</time>
                                    {e.quote}
                                  </blockquote>
                                ))}
                                {c.nextAction && (
                                  <p className="na">
                                    <b>다음 행동</b> {c.nextAction}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="scale">
                <span />
                <div className="ticks">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
                <span />
              </div>
            </section>

            <section className="sec tl">
              <h2>
                근거 발언 타임라인<em>점 크기 = 근거로 인용된 항목 수</em>
              </h2>
              <svg viewBox="0 0 520 92" role="img" aria-label={`장면별 근거 발언 위치. ${top[0]?.time}이 ${top[0]?.ids.length}개 항목의 근거로 가장 많이 인용됐어요.`}>
                <line x1="10" y1="22" x2="510" y2="22" stroke="#d9dbe2" strokeWidth="3" strokeLinecap="round" />
                {[...cites.values()].map((c) => {
                  const rank = top.indexOf(c);
                  return (
                    <g key={c.time}>
                      <circle cx={X(toSec(c.time))} cy="22" r={3 + c.ids.length * 1.6} fill={rank >= 0 ? "#6247d9" : "#a99be9"} stroke="#fff" strokeWidth="1.5" />
                      {rank >= 0 && (
                        <text x={X(toSec(c.time))} y="9" textAnchor="middle" className="t-lb">
                          {rank + 1}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text x="2" y="44" className="t-ax">
                  게임
                </text>
                {demo.events
                  .filter((e) => e.kind === "hit" || e.kind === "miss")
                  .map((e) => (
                    <path key={e.t} d={`M${X(e.t)} 36 l4 6 h-8 z`} fill={e.kind === "hit" ? "#2f9e6b" : "#e5534b"} />
                  ))}
                {demo.scenes.map((s) => (
                  <g key={s.no}>
                    <line x1={X(s.start)} y1="52" x2={X(s.start)} y2="70" stroke="#e3e4ea" />
                    <text x={(X(s.start) + X(s.end)) / 2} y="64" textAnchor="middle" className="t-st">
                      {s.title.replace(/ 「.+」/, "")}
                    </text>
                  </g>
                ))}
                <line x1="510" y1="52" x2="510" y2="70" stroke="#e3e4ea" />
                {[0, 30, 60, 90, 120, 150, 180].map((t) => (
                  <text key={t} x={X(t)} y="84" textAnchor={t === 0 ? "start" : t === 180 ? "end" : "middle"} className="t-ax">
                    {t === 0 ? "0:00" : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`}
                  </text>
                ))}
              </svg>
              <ol className="cited">
                {top.map((c, i) => (
                  <li key={c.time}>
                    <b>{i + 1}</b>
                    <time>{c.time}</time>
                    <q>{c.quote}</q>
                    <span>{c.ids.map((id) => SHORT[id]).join(" · ")}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="sec aifb">
              <h2>AI 피드백</h2>
              <div className="two">
                <div>
                  <h3>잘한 점</h3>
                  <ul className="lst">
                    {fb.strengths.map((s) => (
                      <li key={s.time}>
                        <time>{s.time}</time>
                        <p>{s.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>다음 시연에서 할 말</h3>
                  <ul className="lst nx">
                    {result.next.map((n) => (
                      <li key={n.title}>
                        <time>{n.when}</time>
                        <p>
                          <b>{n.title}</b>
                          <q>{/["“]([^"”]+)["”]/.exec(n.say)?.[1] ?? n.say}</q>
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="sum">
                <h3>종합 의견</h3>
                <p>{fb.closing}</p>
              </div>
            </section>
          </div>

          <aside className="aside">
            <section className="score">
              <div className="hd">
                시연 점수<span>100점 만점</span>
              </div>
              <div className="bd">
                <div className="big tnum">
                  {count}
                  <small>/100점</small>
                </div>
                <div className="gauge" aria-hidden>
                  <i style={{ width: shown ? `${total}%` : 0 }} />
                  <b style={{ left: `${target}%` }} />
                </div>
                <div className="gk">
                  <span>0</span>
                  <em style={{ left: `${target}%` }}>▲ {target}</em>
                  <span>100</span>
                </div>
                <p className="cap">판단 불가 {dist.na}개(실습 안전)는 빼고 환산했어요.</p>
              </div>
            </section>

            <section className="box">
              <h3>점수 올리기</h3>
              <div className="adj">
                <div className="adj-ends">
                  <span>
                    현재<b>{total}</b>
                  </span>
                  <i>→</i>
                  <span>
                    목표<b className="up">{target}</b>
                  </span>
                </div>
                <dl className="kv">
                  {gains.map((g) => (
                    <Row key={g.r.id} dt={SHORT[g.r.id]} dd={`${g.r.score}→4점`} v={`+${g.gain.toFixed(1)}`} cls="up" />
                  ))}
                </dl>
              </div>
            </section>

            <section className="box">
              <h3>
                감점이 큰 항목<span>배점 − 획득</span>
              </h3>
              <dl className="kv">
                {losses.map((l) => (
                  <Row key={l.r.id} dt={SHORT[l.r.id]} dd={`${l.r.weight}점 중`} v={`−${l.loss.toFixed(1)}`} cls="dn" />
                ))}
              </dl>
            </section>

            <section className="box">
              <h3>
                항목 분포<span>13개</span>
              </h3>
              <div className="dist">
                <div className="bar" aria-label={`잘함 ${dist.hi}개, 보통 ${dist.md}개, 개선 필요 ${dist.lo}개, 판단 불가 ${dist.na}개`}>
                  {(
                    [
                      ["hi", dist.hi],
                      ["md", dist.md],
                      ["lo", dist.lo],
                      ["na", dist.na],
                    ] as const
                  )
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => (
                      <span key={k} className={k} style={{ flex: n }}>
                        {n}
                      </span>
                    ))}
                </div>
                <div className="k">
                  <span>
                    <i className="dot hi" />
                    잘함 <b>{dist.hi}</b>
                  </span>
                  <span>
                    <i className="dot md" />
                    보통 <b>{dist.md}</b>
                  </span>
                  <span>
                    <i className="dot lo" />
                    개선 <b>{dist.lo}</b>
                  </span>
                  <span>
                    <i className="dot na" />
                    불가 <b>{dist.na}</b>
                  </span>
                </div>
              </div>
            </section>

            <section className="box">
              <h3>시연 학습 목표</h3>
              <ol className="goals">
                {demo.goals.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ol>
            </section>

            <section className="box">
              <h3>결과지가 만들어진 과정</h3>
              <ol className="flow">
                <li>
                  <b>1</b>
                  <span>
                    수업 녹음<small>부스에서 3분 시연</small>
                  </span>
                </li>
                <li>
                  <b>2</b>
                  <span>
                    음성 인식 · 화자 구분<small>강사 발화 {demo.lines.filter((l) => l.who === "강사").length}문장</small>
                  </span>
                </li>
                <li>
                  <b>3</b>
                  <span>
                    게임 기록 연결<small>발사·명중 {demo.events.length}건을 발화 시각에 맞춤</small>
                  </span>
                </li>
                <li className="ai">
                  <b>4</b>
                  <span>
                    루브릭 13개 항목 채점<small>{result.model} · 근거 발언 대조</small>
                  </span>
                </li>
                <li className="ai">
                  <b>5</b>
                  <span>
                    AI 자체 검토<small>체크리스트 {fb.review.checklistPassed}/{fb.review.notes?.length ?? 8} 통과</small>
                  </span>
                </li>
              </ol>
            </section>
          </aside>
        </div>

        <footer className="foot">
          <span>Nova Coach · Nova Lab</span>
          <span>AI 평가 · 참고용</span>
        </footer>
      </article>
    </section>
  );
}

function Row({ dt, dd, v, cls }: { dt: string; dd: string; v: string; cls: "up" | "dn" }) {
  return (
    <>
      <dt>{dt}</dt>
      <dd>{dd}</dd>
      <dd className={cls}>{v}</dd>
    </>
  );
}
