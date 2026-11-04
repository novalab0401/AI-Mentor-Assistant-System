// Lucide 계열 선 아이콘. 외부 패키지 없이 쓰는 최소 세트.
const PATHS: Record<string, string[]> = {
  home: ["M3 3h7v9H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 16h7v5H3z"],
  doc: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5", "M9 13h6", "M9 17h6"],
  video: ["M4.5 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M17.5 10.5l4-2.5v8l-4-2.5"],
  mic: ["M12 2.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z", "M5.5 10.5a6.5 6.5 0 0 0 13 0", "M12 17v4"],
  spark: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
  check: ["M20 6 9 17l-5-5"],
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  back: ["M19 12H5", "M11 6l-6 6 6 6"],
  chevron: ["M6 9l6 6 6-6"],
  download: ["M12 3v12", "M7 10l5 5 5-5", "M4 21h16"],
  play: ["M7 4.5v15l12-7.5z"],
  stop: ["M6 6h12v12H6z"],
  camera: ["M4.5 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M17.5 10.5l4-2.5v8l-4-2.5"],
  cameraOff: ["M2 2l20 20", "M10.5 5h5a2 2 0 0 1 2 2v3.5l4-2.5v8", "M17.5 17a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7a2 2 0 0 1 1-1.7"],
  retry: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5"],
  alert: ["M12 9v4", "M12 17h.01", "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"],
  // 분야
  bulb: ["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4"],
  flask: ["M10 2v7.5a2 2 0 0 1-.2.9L4.7 20.6a1 1 0 0 0 .9 1.4h12.8a1 1 0 0 0 .9-1.4l-5.1-10.2a2 2 0 0 1-.2-.9V2", "M8.5 2h7", "M7 16h10"],
  bolt: ["M4 14a1 1 0 0 1-.8-1.6l9.9-10.2a.5.5 0 0 1 .9.5l-1.9 6A1 1 0 0 0 13 10h7a1 1 0 0 1 .8 1.6l-9.9 10.2a.5.5 0 0 1-.9-.5l1.9-6A1 1 0 0 0 11 14z"],
  droplet: ["M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"],
  bot: ["M12 8V4H8", "M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z", "M2 14h2", "M20 14h2", "M15 13v2", "M9 13v2"],
  rocket: ["M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z", "M12 15l-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z", "M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0", "M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"],
  // 의미
  target: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", "M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"],
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
  box: ["M11 21.7a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7z", "M12 22V12", "M3.3 7 12 12l8.7-5"],
  shield: ["M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"],
  circleCheck: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M9 12l2 2 4-4"],
  trend: ["M3 17l6-6 4 4 8-8", "M15 7h6v6"],
  layers: ["M12 2 2 7l10 5 10-5z", "M2 17l10 5 10-5", "M2 12l10 5 10-5"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  book: ["M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"],
};

export function Icon({ name, size = 18, className = "", strokeWidth = 1.7 }: { name: keyof typeof PATHS | string; size?: number; className?: string; strokeWidth?: number }) {
  const filled = name === "play" || name === "stop";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {(PATHS[name] ?? []).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const FIELD_ICON: Record<string, string> = {
  입문: "bulb",
  "화학·소재": "flask",
  에너지: "bolt",
  환경공학: "droplet",
  "로봇·제어": "bot",
  "우주·항공": "rocket",
};

/** 분야 아이콘. 분야를 글자보다 먼저 알아보게 하는 표식이라 색은 쓰지 않는다. */
export function FieldIcon({ field, size = 16, className = "" }: { field: string; size?: number; className?: string }) {
  return <Icon name={FIELD_ICON[field] ?? "layers"} size={size} className={className} />;
}

/** 분야 아이콘 + 이름. 표와 목록의 분야 칸에 쓴다. */
export function FieldLabel({ field }: { field: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <FieldIcon field={field} className="text-ter" />
      {field}
    </span>
  );
}
