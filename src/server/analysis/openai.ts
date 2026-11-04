// OpenAI API 호출. SDK 없이 fetch로 부른다.
// 키는 .env.local의 OPENAI_API_KEY에서만 읽고, 로그나 오류 문구에 넣지 않는다.

export class AnalysisError extends Error {
  // message는 화면에 그대로 보여 줄 문장이다
}

export function aiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "whisper-1",
    model: process.env.OPENAI_MODEL?.trim() ?? "",
  };
}

/** 분석을 시작할 수 없는 이유. 문제 없으면 null. */
export function aiConfigProblem(): string | null {
  const c = aiConfig();
  if (!c.apiKey) return ".env.local에 OPENAI_API_KEY가 없어요.";
  if (!c.model) return ".env.local에 OPENAI_MODEL(채점에 쓸 모델)이 없어요.";
  return null;
}

const BASE = "https://api.openai.com/v1";

/** 잠깐의 실패(429, 5xx, 네트워크)는 두 번까지 다시 시도한다. */
export async function openaiFetch(path: string, init: { body: BodyInit; json?: boolean; timeoutMs: number }): Promise<unknown> {
  const { apiKey } = aiConfig();
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, ...(init.json ? { "Content-Type": "application/json" } : {}) },
        body: init.body,
        signal: AbortSignal.timeout(init.timeoutMs),
      });
    } catch {
      lastStatus = 0;
      continue; // 네트워크 오류·시간 초과
    }
    if (res.ok) return res.json();
    lastStatus = res.status;
    const detail = await res.text().catch(() => "");
    if (res.status === 429 || res.status >= 500) {
      // 사용 한도 초과는 다시 시도해도 소용없다
      if (detail.includes("insufficient_quota")) throw new AnalysisError("OpenAI 사용 한도(크레딧)가 부족해요. 결제 상태를 확인해 주세요.");
      continue;
    }
    console.error(`[analysis] OpenAI ${path} ${res.status}: ${detail.slice(0, 300)}`);
    if (res.status === 401) throw new AnalysisError("OpenAI API 키가 올바르지 않아요. .env.local의 OPENAI_API_KEY를 확인해 주세요.");
    if (res.status === 404) throw new AnalysisError("설정한 OpenAI 모델을 쓸 수 없어요. .env.local의 모델 이름을 확인해 주세요.");
    throw new AnalysisError(`OpenAI 요청이 거절됐어요(${res.status}).`);
  }
  throw new AnalysisError(lastStatus ? `OpenAI 서버가 응답하지 않아요(${lastStatus}). 잠시 뒤 다시 시도해 주세요.` : "OpenAI에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
}
