"use client";

import { useEffect, useRef } from "react";

const toSec = (t: string) => t.split(":").reduce((acc, v) => acc * 60 + Number(v), 0);

/** 녹화 영상. 피드백의 시각 버튼(<SeekButton>)을 누르면 그 장면으로 이동한다. */
export function SessionVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const onSeek = (e: Event) => {
      const v = ref.current;
      if (!v) return;
      v.currentTime = toSec((e as CustomEvent<string>).detail);
      v.play().catch(() => {});
      v.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener("session-seek", onSeek);
    return () => window.removeEventListener("session-seek", onSeek);
  }, []);
  return <video ref={ref} src={src} controls preload="metadata" className="aspect-video w-full rounded-2xl bg-[#14141c]" />;
}

export function SeekButton({ time, enabled }: { time: string; enabled: boolean }) {
  if (!enabled) return <span className="tnum text-[13px] text-ter">{time}</span>;
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("session-seek", { detail: time }))}
      className="tnum text-[13px] text-brand hover:underline"
      aria-label={`${time} 장면 보기`}
    >
      {time}
    </button>
  );
}
