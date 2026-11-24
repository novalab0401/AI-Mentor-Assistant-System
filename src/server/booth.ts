// 부스 수업 자료. 수업 대본(content/booth/laser-demo.json)과 미리 만든 AI 피드백(laser-demo-feedback.json).
// 피드백은 scripts/booth-feedback.ts로 만든다(실제 채점 파이프라인 + 사람 수정 + AI 재검토).
// 화면에는 "시연"·"녹취" 대신 "수업"·"음성 기록"으로 보여 준다(원본 파일은 그대로 둔다).
import demoJson from "../../content/booth/laser-demo.json";
import resultJson from "../../content/booth/laser-demo-feedback.json";
import type { BoothDemoData, BoothResult } from "@/lib/booth";

// "녹취"는 받침이 없고 "음성 기록"은 받침이 있어서 뒤에 붙는 조사를 함께 바꾼다
const PARTICLE: Record<string, string> = { 와: "과", 를: "을", 는: "은", 가: "이", 로: "으로" };

export function boothWording(text: string): string {
  return text
    .replace(/녹취(와|를|는|가|로)?/g, (_, p?: string) => `음성 기록${p ? PARTICLE[p] : ""}`)
    .replace(/수업 시연/g, "수업")
    .replace(/말·쓰기·시연/g, "말·쓰기·발표") // 공통 루브릭 문장(학생이 해 보이는 참여 방식)
    .replace(/시연 강사/g, "담당 강사")
    .replace(/시연/g, "수업");
}

/** 객체 안의 모든 문자열에 boothWording을 적용한 복사본. */
function reword<T>(value: T): T {
  if (typeof value === "string") return boothWording(value) as T;
  if (Array.isArray(value)) return value.map(reword) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reword(v)])) as T;
  return value;
}

export const boothDemo = reword(demoJson as BoothDemoData);
/** 부스 화면에 보일 공통 루브릭(수준 문장에도 같은 낱말 바꾸기 적용, 원본은 그대로). */
export const boothRubric = <T>(items: T): T => reword(items);
export const boothResult = reword(resultJson as unknown as BoothResult);
