// 부스 시연(레이저 챌린지 3분 수업) 화면에 넘기는 데이터 모양. 내용은 content/booth/에 있다.
import type { Feedback, RubricItem } from "./types";

export type BoothLine = { t: number; who: string; text: string };
export type BoothEvent = { t: number; kind: "mission" | "shot" | "hand" | "hit" | "miss" | "end"; text: string };
export type BoothNote = { t: number; tone: "good" | "warn" | "info"; area: string; text: string };
export type BoothScene = { no: number; title: string; start: number; end: number; plan: string[] };

export type BoothDemoData = {
  title: string;
  subtitle: string;
  durationSec: number;
  teacher: string;
  audience: string;
  game: string;
  goals: string[];
  scenes: BoothScene[];
  lines: BoothLine[];
  events: BoothEvent[];
  notes: BoothNote[];
};

export type BoothResult = {
  feedback: Feedback;
  next: { when: string; title: string; say: string }[];
  model: string;
};

export type BoothProps = { demo: BoothDemoData; result: BoothResult; rubric: RubricItem[]; checklist: string[] };
