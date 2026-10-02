# 00. 현재 상태

새 세션은 `AGENTS.md` 다음에 이 문서를 읽는다. 작업마다 갱신한다. 40줄 이내, 본문 복제 금지(링크만).

- 마지막 갱신: 260930

## 단계
설계 초기. `packages/core`에 공통 스키마 v0(pydantic)와 테스트만 있다. 앱·서비스 코드는 없다.
집중 범위: 수업 전 구축(가이드 → 모의수업 → 루브릭 평가 → 피드백). 멀티모달·실제 수업·수업 중 보조는 나중. ([03](03-product-plan.md))

## 핵심 결정
- 범위·원칙·결정 11건: [260930-0000-01-project-scoping](reports/260930-0000-01-project-scoping.md)
- 문서 구조·작업 흐름: [260930-1209-02-docs-structure](reports/260930-1209-02-docs-structure.md)
- 원본 기획서 재검토, 스키마 v0 보강 항목, MVP/이후 TODO 분리: [260930-1245-03-original-doc-review](reports/260930-1245-03-original-doc-review.md)
- 담당자 요구 흐름 반영 (가이드 → 모의수업 → 루브릭 평가, 기능 2 보류 해제): [261001-1007-04-requester-flow](reports/261001-1007-04-requester-flow.md)
- 스키마 v0 구현과 결정(판단 불가 규칙, grade_use 계산, pydantic): [261001-1151-05-schema-v0-impl](reports/261001-1151-05-schema-v0-impl.md)
- 최종 시스템에 MCP 없음. MCP·스킬은 개발 과정 도구로만 쓴다. (근거: 고정 파이프라인, 오프라인 동작)

## 열린 질문 / 외부 대기
- 요청자 범위·자원 확인 (기간, 인원, 산출물, 데이터) + 담당자 요구 확인 질문 8개 → [scope-confirmation](todo/scope-confirmation.md), [03 확인 필요](03-product-plan.md)
- 루브릭: 커리큘럼팀 확인 필요 → [rubric-draft](todo/rubric-draft.md)
- 회사에서 받을 것: 샘플 지도안, 모의수업 녹화와 전문가 평가, 차시별 오개념 ([03](03-product-plan.md))
- 동의·보관·편향 모니터링·재평가 정책 → [policy-confirmation](todo/policy-confirmation.md)
- 로컬 우선, 품질 미달 시 API 전환: 기준과 허용 데이터 범위 미정 → [policy-confirmation](todo/policy-confirmation.md). 금지 규칙은 아직 유지 중
- git 원격: `github.com/Broogun/Novarlab-AI-system` (비공개, `main`). 스킬은 저장소에 포함하지 않으므로 새 PC에서 직접 설치

## 다음 액션
1. 공통 스키마 v0 구현 완료(퀴즈 확인만 남음) → [schema-v0](todo/schema-v0.md). 다음은 루브릭 가안([rubric-draft](todo/rubric-draft.md))과 담당자 확인 질문 전달
2. 범위 확인 요청 발송 (대기 시간이 있으므로 병행)

## 최근 변경
- 261002: 첫 커밋과 GitHub 푸시 (`main`, 46개 파일). `.serena/`는 `.gitignore`에 추가
- 261001: 스키마 v0 구현(packages/core, 테스트 28개), 02-specs·05-coding-rules 갱신, human-review·벤치마킹 TODO 정리
- 261001: 담당자 요구 흐름 반영 (03 재구성, TODO 추가: 수업 가이드, 클릭 입력)
- 260930: 원본 재검토 반영 (AGENTS 원칙 2개, 01 studio 정정, policy-confirmation 신설, TODO 분리)
- 260930: docs 구조 정비 (00-status, 05-coding-rules, docs/learning 추가), AGENTS.md 작업 흐름·스킬 규칙 확정, git init
