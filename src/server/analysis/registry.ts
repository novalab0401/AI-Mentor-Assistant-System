// 지금 이 서버에서 돌고 있는 분석 목록.
// 개발 서버가 코드를 다시 불러와도 목록이 지워지지 않게 globalThis에 둔다.
const g = globalThis as unknown as { __novalabAnalyses?: Set<string> };
const running = (g.__novalabAnalyses ??= new Set<string>());

export const MAX_CONCURRENT_ANALYSES = 1; // 메모리·비용을 생각해 한 번에 하나만

export function isAnalysisRunning(id: string) {
  return running.has(id);
}

export function runningCount() {
  return running.size;
}

export function markRunning(id: string) {
  running.add(id);
}

export function markStopped(id: string) {
  running.delete(id);
}
