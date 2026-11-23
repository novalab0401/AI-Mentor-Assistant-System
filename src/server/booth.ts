// 부스 시연 자료. 시연 대본(content/booth/laser-demo.json)과 미리 만든 AI 피드백(laser-demo-feedback.json).
// 피드백은 scripts/booth-feedback.ts로 만든다(실제 채점 파이프라인 + 사람 수정 + AI 재검토).
import demoJson from "../../content/booth/laser-demo.json";
import resultJson from "../../content/booth/laser-demo-feedback.json";
import type { BoothDemoData, BoothResult } from "@/lib/booth";

export const boothDemo = demoJson as BoothDemoData;
export const boothResult = resultJson as unknown as BoothResult;
