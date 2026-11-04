"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import type { Lesson } from "@/lib/types";
import {
  acquireDraftLock,
  acquireLease,
  appendChunk,
  deleteDraft,
  getDraft,
  getDrafts,
  loadDraftBlob,
  lockedDraftIds,
  startDraft,
  type DraftMeta,
  type Release,
} from "@/lib/draftStore";

type Phase = "idle" | "ready" | "recording" | "paused" | "review" | "uploading";

function pickMimeType(video: boolean) {
  const candidates = video
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

const draftDate = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

export function Recorder({ lesson }: { lesson: Lesson }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [useCamera, setUseCamera] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [pinnedStep, setPinnedStep] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);
  const [drafts, setDrafts] = useState<DraftMeta[]>([]); // 제출하지 않은 녹화들(최신순)
  const [busyDrafts, setBusyDrafts] = useState<Set<string>>(new Set()); // 다른 탭이 쓰는 중인 녹화
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const openingRef = useRef(false); // 장치 열기 중복 방지
  const mountedRef = useRef(true);
  // 임시 저장(IndexedDB)
  const draftRef = useRef<DraftMeta | null>(null);
  const seqRef = useRef(0);
  const persistQ = useRef<Promise<unknown>>(Promise.resolve());
  const elapsedRef = useRef(0);
  const activeDraftIdRef = useRef<string | null>(null); // 지금 화면에 있는 녹화의 임시 저장 ID
  const uploadKeyRef = useRef<string | null>(null); // 같은 녹화를 두 번 올려도 세션이 하나만 생기게 하는 키
  const releaseRef = useRef<Release | null>(null); // 같은 차시 녹화 잠금 해제(녹화를 멈추면 푼다)
  const draftLockRef = useRef<Release | null>(null); // 지금 화면의 임시 녹화 잠금(제출·지우기·화면 떠남까지 쥔다)

  // 지도안 단계별 시작 시각(초)
  const timeline = useMemo(() => {
    const secs = lesson.steps.map((s) => (s.minutes ?? 0) * 60);
    return lesson.steps.map((s, i) => {
      const start = secs.slice(0, i).reduce((a, v) => a + v, 0);
      return { ...s, start, end: start + secs[i] };
    });
  }, [lesson.steps]);
  const autoStep = Math.max(0, timeline.findLastIndex((s) => elapsed >= s.start));
  const currentStep = pinnedStep ?? autoStep;
  const live = phase === "recording" || phase === "paused";

  const releaseDraftLock = useCallback(() => {
    const rel = draftLockRef.current;
    draftLockRef.current = null;
    rel?.();
  }, []);

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // 녹화 중에 화면을 떠나면 녹화를 멈춘다. 멈추는 순간까지의 녹화는 onstop에서 임시 저장을 마무리한다.
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      recorderRef.current = null;
      stopStream();
      // onstop의 임시 저장이 끝난 뒤 잠금을 푼다
      const release = releaseRef.current;
      releaseRef.current = null;
      const draftRelease = draftLockRef.current;
      draftLockRef.current = null;
      persistQ.current.finally(() => {
        release?.();
        draftRelease?.();
      });
    };
  }, [stopStream]);
  useEffect(() => () => {
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
  }, [reviewUrl]);

  // 제출하지 않은 녹화 목록. 처음 열 때와, 다른 탭에서 돌아왔을 때 다시 읽는다.
  const refreshDrafts = useCallback(() => {
    lockedDraftIds()
      .catch(() => new Set<string>())
      .then(async (locked) => [await getDrafts(lesson.no, locked), locked] as const)
      .then(([list, locked]) => {
        if (!mountedRef.current) return;
        // 이 탭이 쥔 잠금은 '다른 탭'이 아니다
        const mine = activeDraftIdRef.current;
        setDrafts(list.filter((d) => d.id !== mine));
        setBusyDrafts(new Set([...locked].filter((id) => id !== mine)));
      })
      .catch(() => {});
  }, [lesson.no]);
  useEffect(() => {
    refreshDrafts();
    const onVisible = () => document.visibilityState === "visible" && refreshDrafts();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshDrafts);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshDrafts);
    };
  }, [refreshDrafts]);

  // 녹화 중(또는 임시 저장에 실패한 녹화가 있을 때)에는 이동을 확인받는다
  const unsafe = phase === "recording" || phase === "paused" || phase === "uploading" || (phase === "review" && !!saveWarning);
  useEffect(() => {
    if (!unsafe) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download") || e.defaultPrevented) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      const msg = saveWarning
        ? "녹화가 아직 저장되지 않았어요. 이동하면 녹화가 사라질 수 있어요. 그래도 이동할까요?"
        : "녹화 중이에요. 이동하면 녹화가 멈추고, 여기까지는 임시 저장돼서 다시 돌아오면 제출할 수 있어요. 이동할까요?";
      if (!window.confirm(msg)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [unsafe, saveWarning]);

  // 녹화 시간
  useEffect(() => {
    if (phase !== "recording") return;
    const started = Date.now() - elapsed * 1000;
    const id = window.setInterval(() => {
      const sec = (Date.now() - started) / 1000;
      elapsedRef.current = sec;
      setElapsed(sec);
    }, 250);
    return () => window.clearInterval(id);
    // elapsed는 시작 시점 기준값으로만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function openDevices() {
    if (openingRef.current || streamRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setError(null);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: useCamera ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      // 권한 창이 떠 있는 동안 화면을 떠났으면 바로 끈다
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = useCamera ? stream : null;
        videoRef.current.muted = true;
        // 미리보기는 카메라를 쓸 때만 재생한다. 소스 없는 영상의 play()는 끝나지 않아서
        // 음성만 녹화일 때 기다리면 '녹화 시작' 단계로 넘어가지 못한다. 기다리지 않고 진행한다.
        if (useCamera) videoRef.current.play().catch(() => {});
      }
      // 마이크 입력 크기 표시. 실패해도 녹화는 할 수 있게 둔다.
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 64));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setPhase("ready");
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      if (streamRef.current === stream) streamRef.current = null;
      if (!mountedRef.current) return;
      const name = (e as DOMException)?.name;
      setError(
        name === "NotAllowedError"
          ? "카메라·마이크 권한이 막혀 있어요. 주소창 왼쪽 자물쇠를 눌러 권한을 허용한 뒤 다시 시도해 주세요."
          : name === "NotFoundError"
            ? "연결된 카메라나 마이크를 찾지 못했어요. 장치를 연결하거나 '음성만 녹화'로 바꿔 보세요."
            : "카메라·마이크를 켜지 못했어요. 다른 프로그램이 장치를 쓰고 있는지 확인해 주세요.",
      );
    } finally {
      openingRef.current = false;
      if (mountedRef.current) setOpening(false);
    }
  }

  async function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    // 같은 차시를 다른 탭에서 녹화 중이면 시작하지 않는다
    const release = await acquireLease(lesson.no);
    if (!release) {
      setError("다른 탭에서 이 차시를 녹화하고 있어요. 그 탭에서 녹화를 끝낸 뒤 다시 시도해 주세요.");
      return;
    }
    if (!mountedRef.current) {
      release();
      return;
    }
    releaseRef.current = release;
    setError(null);
    const mimeType = pickMimeType(useCamera);
    // 화질을 정해 두지 않으면 720p가 약 2.5Mbps로 녹화돼 60분이면 1GB(업로드 한도)를 넘는다.
    // 영상 1Mbps + 음성 64kbps면 60분에 약 480MB. AI 분석은 음성만 쓰므로 음성은 충분한 화질로 둔다.
    const rec = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      ...(useCamera ? { videoBitsPerSecond: 1_000_000 } : {}),
      audioBitsPerSecond: 64_000,
    });
    const type = rec.mimeType || mimeType || "video/webm";
    const fail = () =>
      mountedRef.current && setSaveWarning("임시 저장에 실패했어요. 녹화를 끝내고 제출하거나 내려받기 전까지 이 화면을 떠나지 마세요.");

    // 새 녹화의 ID를 먼저 정하고 잠근다. 목록에 나타나기 전부터 이 탭의 녹화로 표시된다.
    const id = crypto.randomUUID();
    releaseDraftLock();
    const draftRelease = await acquireDraftLock(id);
    if (!mountedRef.current) {
      draftRelease?.();
      release();
      return;
    }
    draftLockRef.current = draftRelease;
    chunksRef.current = [];
    seqRef.current = 0;
    draftRef.current = null;
    activeDraftIdRef.current = id;
    uploadKeyRef.current = id; // 같은 녹화를 다시 올려도 세션은 하나
    elapsedRef.current = 0;
    setSaveWarning(null);
    // 조각이 생길 때마다 순서대로 임시 저장한다
    persistQ.current = startDraft(id, lesson.no, type)
      .then((m) => {
        draftRef.current = m;
      })
      .catch(fail);
    rec.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      chunksRef.current.push(e.data);
      const seq = seqRef.current++;
      const data = e.data;
      persistQ.current = persistQ.current
        .then(() => draftRef.current && appendChunk(draftRef.current, seq, data, Math.round(elapsedRef.current)))
        .catch(fail);
    };
    rec.onstop = () => {
      // 화면을 떠난 뒤에 멈췄어도 임시 저장은 마무리한다
      persistQ.current = persistQ.current
        .then(() => draftRef.current && appendChunk(draftRef.current, Math.max(0, seqRef.current - 1), new Blob([]), Math.round(elapsedRef.current), true))
        .catch(fail);
      // 녹화가 끝났으니 임시 저장을 마친 뒤 잠금을 푼다
      const rel = releaseRef.current;
      releaseRef.current = null;
      if (rel) persistQ.current.finally(rel);
      if (!mountedRef.current) return;
      const blob = new Blob(chunksRef.current, { type });
      blobRef.current = blob;
      chunksRef.current = []; // 합친 뒤에는 조각을 바로 놓아준다
      setReviewUrl(URL.createObjectURL(blob));
      stopStream();
      setPhase("review");
    };
    // 카메라·마이크 연결이 끊기면 녹화를 멈춘다(여기까지는 임시 저장돼 있다)
    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () => {
        if (recorderRef.current !== rec || rec.state === "inactive") return;
        rec.stop();
        if (mountedRef.current) setError("카메라나 마이크 연결이 끊겨 녹화를 멈췄어요. 여기까지는 임시 저장됐어요. 장치를 확인한 뒤 다시 녹화하거나 지금까지의 녹화를 제출해 주세요.");
      });
    }
    // 시작하고 5초가 지나도 녹화 데이터가 안 들어오면 알린다
    window.setTimeout(() => {
      if (recorderRef.current === rec && rec.state === "recording" && seqRef.current === 0 && mountedRef.current) {
        setSaveWarning("녹화 데이터가 들어오지 않고 있어요. 카메라·마이크가 연결돼 있는지 확인하고, 녹화를 끝낸 뒤 다시 시도해 주세요.");
      }
    }, 5000);
    rec.start(1000);
    recorderRef.current = rec;
    setElapsed(0);
    setPinnedStep(null);
    setPhase("recording");
  }

  async function restoreDraft(d: DraftMeta) {
    setError(null);
    // 다른 탭이 녹화 중이거나 다시 보는 중인 녹화는 복구하지 않는다(중간 녹화가 먼저 제출되는 것을 막는다)
    const lock = await acquireDraftLock(d.id);
    if (!lock) {
      setError("다른 탭에서 이 녹화를 쓰고 있어요. 그 탭에서 녹화를 끝내거나 제출한 뒤 다시 시도해 주세요.");
      refreshDrafts();
      return;
    }
    // 잠금을 얻은 뒤 최신 정보를 다시 읽는다
    const fresh = await getDraft(d.id).catch(() => null);
    if (!fresh) {
      lock();
      setError("이미 제출했거나 지운 녹화예요.");
      refreshDrafts();
      return;
    }
    try {
      const blob = await loadDraftBlob(fresh);
      releaseDraftLock();
      draftLockRef.current = lock;
      blobRef.current = blob;
      elapsedRef.current = fresh.durationSec;
      setElapsed(fresh.durationSec);
      setReviewUrl(URL.createObjectURL(blob));
      activeDraftIdRef.current = fresh.id;
      uploadKeyRef.current = fresh.id; // 같은 녹화를 다시 올려도 세션은 하나
      stopStream();
      setPhase("review");
    } catch {
      lock();
      setError("임시 저장된 녹화를 불러오지 못했어요. 내려받기로 파일을 먼저 저장해 보세요.");
    }
  }

  async function downloadDraft(d: DraftMeta) {
    try {
      saveFile(await loadDraftBlob(d), `${lesson.no}차시-모의수업.webm`);
    } catch {
      setError("임시 저장된 녹화를 내려받지 못했어요.");
    }
  }

  async function discardDraft(d: DraftMeta) {
    setError(null);
    const lock = await acquireDraftLock(d.id);
    if (!lock) {
      setError("다른 탭에서 이 녹화를 쓰고 있어서 지울 수 없어요.");
      refreshDrafts();
      return;
    }
    try {
      if (!window.confirm("이 임시 녹화를 지울까요? 지우면 되돌릴 수 없어요.")) return;
      await deleteDraft(d.id).catch(() => {});
    } finally {
      lock();
      refreshDrafts();
    }
  }

  function togglePause() {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === "recording") {
      rec.pause();
      setPhase("paused");
    } else if (rec.state === "paused") {
      rec.resume();
      setPhase("recording");
    }
  }

  function finish() {
    recorderRef.current?.stop();
  }

  async function retake() {
    if (!window.confirm("지금 녹화를 지우고 다시 녹화할까요? 지우면 되돌릴 수 없어요.")) return;
    await persistQ.current.catch(() => {});
    if (activeDraftIdRef.current) await deleteDraft(activeDraftIdRef.current).catch(() => {});
    activeDraftIdRef.current = null;
    uploadKeyRef.current = null;
    releaseDraftLock();
    refreshDrafts();
    setSaveWarning(null);
    setReviewUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    recorderRef.current = null;
    setElapsed(0);
    setPhase("idle");
  }

  async function submit() {
    const blob = blobRef.current;
    if (!blob) return;
    setPhase("uploading");
    setError(null);
    if (!uploadKeyRef.current) uploadKeyRef.current = crypto.randomUUID();
    const query = new URLSearchParams({ lessonNo: String(lesson.no), durationSec: String(Math.round(elapsed)), uploadKey: uploadKeyRef.current });
    try {
      // 파일을 그대로 보낸다. 서버가 디스크에 조금씩 받아 적는다.
      const res = await fetch(`/api/sessions?${query}`, {
        method: "POST",
        headers: { "Content-Type": blob.type.split(";")[0] || "video/webm" },
        body: blob,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "업로드에 실패했어요.");
      // 제출이 끝났으니 이 녹화의 임시 저장본만 지운다(다른 탭의 녹화는 건드리지 않는다)
      await persistQ.current.catch(() => {});
      if (activeDraftIdRef.current) await deleteDraft(activeDraftIdRef.current).catch(() => {});
      activeDraftIdRef.current = null;
      releaseDraftLock();
      router.push(`/feedback/${body.id}`);
      router.refresh();
    } catch (e) {
      setError(`${(e as Error).message} 네트워크를 확인한 뒤 다시 제출해 주세요.`);
      setPhase("review");
    }
  }

  const step = timeline[currentStep];

  return (
    <div className="grid grid-cols-[1fr_360px] gap-10">
      {/* 왼쪽: 화면과 조작 */}
      <section>
        {drafts.length > 0 && (phase === "idle" || phase === "ready") && (
          <div className="mb-5 rounded-xl border border-line px-5 py-4">
            <p className="flex items-center gap-2 text-[14px] text-ink">
              <Icon name="retry" size={18} className="text-brand" />
              제출하지 않은 녹화가 있어요{drafts.length > 1 && <span className="tnum text-sub"> {drafts.length}개</span>}
            </p>
            <ul className="mt-2 divide-y divide-line">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <p className="tnum flex-1 text-[13.5px] text-body">
                    {draftDate.format(new Date(d.startedAt))} 녹화, 길이 {fmt(d.durationSec)}
                    {busyDrafts.has(d.id) ? (
                      <span className="text-brand"> · 다른 탭에서 쓰는 중</span>
                    ) : (
                      !d.finished && <span className="text-sub"> · 중간에 멈춘 녹화</span>
                    )}
                  </p>
                  <button
                    onClick={() => restoreDraft(d)}
                    disabled={busyDrafts.has(d.id)}
                    className="h-9 rounded-lg bg-brand px-3.5 text-[13.5px] font-medium text-white hover:bg-brand-dark disabled:opacity-40"
                  >
                    다시 보고 제출
                  </button>
                  <button onClick={() => downloadDraft(d)} className="h-9 rounded-lg border border-line px-3 text-[13.5px] text-ink hover:bg-side">
                    내려받기
                  </button>
                  <button onClick={() => discardDraft(d)} disabled={busyDrafts.has(d.id)} className="h-9 rounded-lg px-2 text-[13.5px] text-sub hover:text-ink disabled:opacity-40">
                    지우기
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[12.5px] text-ter">새로 녹화해도 이 녹화들은 지워지지 않아요. 필요 없는 녹화는 직접 지워 주세요.</p>
          </div>
        )}

        <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#14141c]">
          {phase === "review" && reviewUrl ? (
            <video key={reviewUrl} src={reviewUrl} controls className="size-full object-contain" />
          ) : (
            <video ref={videoRef} playsInline muted className={`size-full object-cover ${useCamera && phase !== "idle" ? "" : "invisible"}`} style={{ transform: "scaleX(-1)" }} />
          )}

          {phase === "idle" && (
            <div className="absolute inset-0 grid place-items-center text-center text-white/80">
              <div>
                <p className="text-[15px]">녹화 전에 카메라와 마이크를 켜서 확인해요.</p>
                <p className="mt-1.5 text-[13px] text-white/50">학생이 화면에 나오지 않는 곳에서 녹화해 주세요.</p>
              </div>
            </div>
          )}
          {!useCamera && phase !== "idle" && phase !== "review" && (
            <div className="absolute inset-0 grid place-items-center text-[14px] text-white/70">음성만 녹화하고 있어요</div>
          )}
          {live && (
            <div className="absolute left-5 top-5 flex items-center gap-2 text-[13px] font-medium text-white">
              <span className={`size-2.5 rounded-full ${phase === "recording" ? "animate-pulse bg-alert" : "bg-white/60"}`} />
              <span className="tnum">{fmt(elapsed)}</span>
              {phase === "paused" && <span className="text-white/70">일시정지</span>}
            </div>
          )}
        </div>

        {/* 마이크 입력 */}
        {(phase === "ready" || live) && (
          <div className="mt-4 flex items-center gap-3 text-[12.5px] text-sub">
            <Icon name="mic" size={15} />
            <div className="h-1 flex-1 rounded-full bg-line">
              <div className="h-full rounded-full bg-brand transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
            <span className="w-20 text-right">{level > 0.08 ? "소리 들려요" : "조용해요"}</span>
          </div>
        )}

        {saveWarning && (
          <p role="alert" className="mt-4 flex items-start gap-2 text-[14px] text-alert">
            <Icon name="alert" size={17} className="mt-0.5 shrink-0" />
            {saveWarning}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 text-[14px] text-alert">
            <Icon name="alert" size={17} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          {phase === "idle" && (
            <>
              <button onClick={openDevices} disabled={opening} className="disabled:opacity-60 inline-flex h-11 items-center gap-2 rounded-[10px] bg-brand px-5 text-[14px] font-medium text-white hover:bg-brand-dark">
                <Icon name={useCamera ? "camera" : "mic"} size={17} />
                {useCamera ? "카메라·마이크 켜기" : "마이크 켜기"}
              </button>
              <label className="ml-3 flex cursor-pointer items-center gap-2 text-[14px] text-body">
                <input type="checkbox" checked={!useCamera} onChange={(e) => setUseCamera(!e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
                음성만 녹화
              </label>
            </>
          )}
          {phase === "ready" && (
            <>
              <button onClick={startRecording} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-alert px-5 text-[14px] font-medium text-white hover:opacity-90">
                <span className="size-2.5 rounded-full bg-white" />
                녹화 시작
              </button>
              <button onClick={() => { stopStream(); setPhase("idle"); }} className="h-11 rounded-[10px] px-4 text-[14px] text-sub hover:text-ink">
                장치 끄기
              </button>
            </>
          )}
          {live && (
            <>
              <button onClick={finish} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-ink px-5 text-[14px] font-medium text-white hover:opacity-90">
                <Icon name="stop" size={14} />
                녹화 끝내기
              </button>
              <button onClick={togglePause} className="h-11 rounded-[10px] border border-line px-4 text-[14px] text-ink hover:bg-side">
                {phase === "paused" ? "이어서 녹화" : "일시정지"}
              </button>
            </>
          )}
          {(phase === "review" || phase === "uploading") && (
            <>
              <button
                onClick={submit}
                disabled={phase === "uploading"}
                className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-brand px-5 text-[14px] font-medium text-white hover:bg-brand-dark disabled:opacity-60"
              >
                <Icon name="spark" size={16} />
                {phase === "uploading" ? "올리는 중…" : "제출하고 AI 피드백 받기"}
              </button>
              <button onClick={retake} disabled={phase === "uploading"} className="inline-flex h-11 items-center gap-2 rounded-[10px] px-4 text-[14px] text-sub hover:text-ink disabled:opacity-60">
                <Icon name="retry" size={16} />
                다시 녹화
              </button>
              {reviewUrl && (
                <a
                  href={reviewUrl}
                  download={`${lesson.no}차시-모의수업.webm`}
                  className="inline-flex h-11 items-center gap-2 rounded-[10px] px-3 text-[14px] text-sub hover:text-ink"
                >
                  <Icon name="download" size={16} />
                  내려받기
                </a>
              )}
              <span className="tnum ml-auto text-[13px] text-ter">녹화 길이 {fmt(elapsed)}</span>
            </>
          )}
        </div>
        <p className="mt-6 text-[12.5px] leading-relaxed text-ter">
          녹화하는 동안 이 브라우저에 임시 저장돼서, 화면을 떠나거나 새로고침해도 다시 돌아오면 이어서 제출할 수 있어요. 제출한 영상은 Nova Lab 서버에만 저장되고 AI 피드백을 만드는 데만 쓰여요.
        </p>
      </section>

      {/* 오른쪽: 지도안 흐름 */}
      <aside>
        <div className="border-b border-line pb-5">
          <p className="text-[12.5px] text-ter">지금 단계</p>
          <p className="mt-1 text-[17px] font-medium text-ink">
            {step?.stage} · {step?.topic}
          </p>
          <ul className="mt-3 space-y-1.5 text-[14px] leading-relaxed text-body">
            {step?.teacher.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {step?.notes.length ? <p className="mt-3 text-[13px] text-sub">{step.notes[0]}</p> : null}
        </div>
        <ol className="mt-2 max-h-[420px] overflow-y-auto pr-1">
          {timeline.map((s, i) => {
            const on = i === currentStep;
            const past = live && elapsed >= s.end;
            return (
              <li key={s.topic}>
                <button
                  onClick={() => setPinnedStep(i === pinnedStep ? null : i)}
                  className={`grid w-full grid-cols-[48px_1fr] items-baseline gap-2 rounded-lg px-2 py-2.5 text-left text-[13.5px] ${on ? "bg-tint" : "hover:bg-side"}`}
                >
                  <span className={`tnum text-[12.5px] ${on ? "text-brand" : "text-ter"}`}>{fmt(s.start)}</span>
                  <span className={on ? "font-medium text-ink" : past ? "text-ter" : "text-body"}>
                    {s.topic}
                    <span className="ml-1.5 text-[12px] font-normal text-ter">{s.minutes}분</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {pinnedStep !== null && (
          <button onClick={() => setPinnedStep(null)} className="mt-2 text-[12.5px] text-brand hover:underline">
            녹화 시간에 맞춰 자동으로 따라가기
          </button>
        )}
      </aside>
    </div>
  );
}
