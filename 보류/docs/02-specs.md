# 02. 기술 제약과 구현 규칙

## 환경

- 장비: RTX 5090 노트북 (VRAM 24GB), 로컬 전용
- 수업 중 시스템은 네트워크 없이 동작해야 한다 (로컬 캐시 → 수업 후 동기화)
- 언어: Python, 의존성 관리: uv 워크스페이스

## 모델

| 역할 | 기본 선택 | 비고 |
|---|---|---|
| 음성 인식 | faster-whisper (large 계열) | VAD 필수, 차시별 용어 프롬프트 |
| LLM | 14B급 4bit | 분류·매칭·서술만 담당. 후보 모델은 eval로 비교 후 확정 |
| 서빙 | vLLM 또는 Ollama | logprobs 필요 시 vLLM |

## 모델 운영 방침 (261001, 담당자 요구)

- 이 단계에서는 로컬 모델을 최대한 사용한다. 품질이 너무 낮으면 나중에 API 기반 전환을 검토한다.
- **현재는 외부 API로 수업 데이터를 보내지 않는다** (아래 금지 항목, `AGENTS.md` §3). 전환은 아래 조건을 갖춘 뒤 별도 결정 리포트로만 한다.
  - 로컬 모델의 품질 미달이 eval 수치로 입증됨 (기준은 `eval/`에서 정의)
  - 보낼 데이터의 종류가 정책상 허용됨 (동의, 비식별, 학생·강사 데이터 제외 등. [policy-confirmation](todo/policy-confirmation.md))
- 전환 가능성을 위해 `services/llm`은 모델 백엔드(로컬 / API)를 바꿔 끼울 수 있는 인터페이스로 만든다. 앱은 백엔드를 직접 알지 못한다.

## 공통 데이터 형식 (packages/core)

구현: `packages/core/src/nova_core/` (pydantic v2). 아래는 v0 요약이며 정의는 코드가 정본이다.

- 공통 ID: `lesson_id`, `instructor_id`, `session_id`, `rubric_item_id`, `cohort_id`, `institution_id`
  - 형식: 접두사(`les_`, `ins_`, `ses_`, `rub_`, `coh_`, `org_`) + 소문자 영숫자. 무작위로 만들고 식별 정보에서 만들지 않는다.
- 세션: `{session_id, lesson_id, instructor_id, cohort_id?, institution_id?, occurrence?, session_type, sim_mode?}`
  - `session_type`: `mock | simulation | real`. `sim_mode`(`practice | evaluation`)는 `simulation`일 때만, 그리고 반드시 지정한다.
- 타임라인 이벤트: `{session_id, t, source, event_type, payload}`
  - `t`: 세션 시작 후 경과 초(0 이상, 유한). `source`: `asr | vad | instructor | student_sim | ui | device | rule`
- 평가 결과: `{session_id, rubric_item_id, verdict, evidence[], reason?, output_type, confidence?, verified, review_status}`
  - `output_type`: `measure | classify | generate`
  - `evidence`: 타임스탬프, 로그 ID, 문서 출처 중 최소 1개. **예외: `verdict=undetermined`(판단 불가)일 때는 비울 수 있고, 그 대신 `reason`이 필수다.**
  - `confidence`: 0~1. `classify/generate`는 필수, `measure`(규칙 계산)는 비울 수 있다.
  - `verified` 기본값 `false`, `review_status`(`none | queued | reviewed | appealed`) 기본값 `none`
  - `grade_use`(`allowed | reference_only`)는 저장하지 않고 `grade_use(session, result)`로 계산한다. 시뮬레이션 세션, 미검증(`verified=false`), 판단 불가이면 `reference_only`. `allowed`는 등급 논의에 쓸 자격일 뿐 확정이 아니다(`AGENTS.md` §2).
- 지도안 스키마: objectives / concepts / misconceptions / phases / activities (세부 필드는 샘플 지도안 후 확정, v0는 최소 구조)
- 한계: 필드 간 교차 규칙(`evidence` 예외, `sim_mode` 조건 등)은 JSON 스키마로 표현되지 않는다. 생성 결과는 반드시 모델로 검증한다.

## 하네스 규칙

- 출력은 JSON 스키마로 강제한다.
- 근거 인용이 실제로 존재하는지 후처리로 검증하고, 없으면 버린다.
- "판단 불가"를 허용한다.
- 확신도가 낮은 판정은 사람 검토 큐로 보낸다.
- 전문가 일치도가 검증되지 않은 항목은 `verified=false`로 표시하고 참고용으로만 노출한다.

## ASR 규칙

- 전사 보정은 규칙 치환 → 자모 유사도 매칭 순서. LLM 보정은 용어 목록 한정.
- 모든 보정 내역은 로그로 남긴다.
- 파인튜닝은 eval 기준 용어 오류가 남을 때만.

## 모의수업 처리 흐름 (일반, 음성 기반) (261005)

음성 입력 → ASR → 보정까지는 순차. 이후 측정(measure)과 분류(classify)는 같은 보정 텍스트·이벤트를 입력으로 받는 별개 단계. 클릭 입력은 ASR을 거치지 않고 측정 단계에 바로 합류한다(`source=ui`).

```
[음성 녹음] → VAD → ASR → 용어 보정(규칙→자모매칭→LLM 최후수단) → 타임라인 이벤트(source=asr)
                                                                    │
                                              ┌─────────────────────┴─────────────────────┐
                                        측정(measure)                               분류(classify)
                                     [알고리즘, LLM 없음]                        [LLM, evidence 필수]
                                              └─────────────────────┬─────────────────────┘
                                                                    │
                                                  결과 집계 → grade_use 계산 → confidence 낮으면 검토 큐
                                                                    │
                                                              피드백 생성(generate, LLM)
```

| 단계 | 처리 | `output_type` |
|---|---|---|
| VAD | Silero VAD 등 경량 분류기 | - |
| ASR | faster-whisper + 차시별 initial_prompt | - |
| 용어 보정 | 딕셔너리 치환 → 자모 분해+편집거리(Levenshtein) 매칭 → (못 잡으면) LLM이 후보 목록 중 선택 | - |
| 측정 | 정규식·산술 (시간 배분, 말 속도, 발문 횟수 등). LLM 미사용 | `measure` |
| 분류 | 전사 텍스트를 지도안(objectives/concepts/misconceptions)과 대조해 루브릭 판정, evidence 인용 | `classify` |
| 피드백 | 집계된 루브릭 결과를 강사용 서술로 변환 | `generate` |

열린 점: 측정값(예: 시간 배분)이 분류 판단(예: 지도안 이행 여부)의 입력으로 들어가야 하는 항목이 있으면 완전한 병렬이 아니게 된다. 루브릭 가안에서 항목별로 확인.

## 금지

- 외부 API로 수업 데이터 전송
- 실제 학생 데이터를 테스트·문서에 사용
- 규칙으로 계산 가능한 지표를 LLM에 맡기기
