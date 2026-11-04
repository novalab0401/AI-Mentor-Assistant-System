export type LessonStep = {
  stage: string;
  stageMinutes: number | null;
  topic: string;
  minutes: number | null;
  teacher: string[];
  student: string[];
  materials: string;
  notes: string[];
};

export type Lesson = {
  no: number;
  title: string;
  field: string;
  unit: string;
  method: string;
  target: string;
  goals: string[];
  materials: { teacher: string; student: string };
  durationMinutes: number;
  steps: LessonStep[];
  summary: string;
};

export type RubricItem = {
  id: string;
  name: string;
  weight: number;
  critical: boolean;
  levels: string[];
};

export type FeedbackPrinciple = {
  no: number;
  title: string;
  summary: string;
  points: string[];
  example: string;
  exampleLabel: string;
};

export type FeedbackStandard = {
  principles: FeedbackPrinciple[];
  checklist: { name: string; question: string }[];
};

export type Program = {
  name: string;
  site: string;
  target: string;
  schedule: string;
  sessions: string;
  room: string;
  studentPrep: string;
  intro: string;
  outcome: string;
  goals: string[];
  contents: string[];
  method: string;
  evaluation: string;
  curriculum: { no: number; theme: string; title: string; goal: string; description: string }[];
};

// saved: 녹화 저장됨(분석 전), analyzing: AI 분석 중, failed: 분석 실패(다시 시도 가능), done: 피드백 완료
export type SessionStatus = "saved" | "analyzing" | "failed" | "done";

/** AI 분석 단계. audio: 음성 추출, transcribe: 음성 인식, score: 채점, review: 검토 체크리스트 */
export type AnalysisStage = "audio" | "transcribe" | "score" | "review";

export type AnalysisState = {
  stage: AnalysisStage;
  startedAt: string; // ISO
  finishedAt?: string;
  error?: string; // 사용자에게 보여 줄 실패 이유
};

/** 녹화에서 확인한 실제 발언. time은 녹화 기준 "mm:ss". */
export type Evidence = { time: string; quote: string };

/** 지도안에 적힌 계획과 실제 진행의 대조. */
export type PlanCheck = { step: string; planned: string; observed: string };

/** 루브릭 한 항목의 채점 결과와 근거. */
export type CriterionResult = {
  score: number | null; // 1~5, null = 판단 불가(근거 부족)
  reason: string; // 왜 이 점수인지
  evidence: Evidence[];
  planCheck?: PlanCheck;
  nextAction: string; // 다음 수업에서 해 볼 것 (실제로 할 말까지)
};

export type Feedback = {
  basis: string; // 무엇을 근거로 채점했는지
  review: {
    status: "draft" | "reviewed";
    checklistPassed: number; // 검토 체크리스트 8개 중 통과 수
    notes?: { name: string; passed: boolean; comment: string }[]; // AI 검토 결과
  };
  criteria: Record<string, CriterionResult>; // rubric id -> 결과
  strengths: { time: string; quote?: string; text: string }[];
  improvements: { time: string; text: string; suggestion: string }[]; // 최대 3개
  closing: string;
};

export type PracticeSession = {
  id: string;
  lessonNo: number;
  createdAt: string; // ISO
  durationSec: number;
  mimeType: string;
  status: SessionStatus;
  ownerId?: string; // 올린 강사의 계정 ID. 계정 기능 전에 만든 녹화에는 없다(운영진만 볼 수 있음)
  uploadKey?: string; // 같은 녹화를 다시 올려도 세션이 하나만 생기게 하는 키(브라우저 임시 녹화 ID)
  demo?: boolean;
  analysis?: AnalysisState;
  feedback?: Feedback;
};
