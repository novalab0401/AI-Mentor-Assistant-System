# TODO: 공통 스키마 v0 설계

- 상태: `doing`
- 우선순위: P0
- 담당: 
- 관련 문서: 02-specs.md, 01-folder-architecture.md

## 목표
지도안, 타임라인 이벤트, 평가 결과의 공통 스키마 초안을 `packages/core`에 정의한다.

## 배경
모든 앱·서비스가 공유하는 데이터 형식이라 이후 작업의 기반이다. 스키마 변경은 report 필수.
`02-specs.md`에 필드 목록이 있으나 타입·필수 여부·검증 규칙은 없다.

## 범위 메모 (261001)
수업 전 구축(가이드, 모의수업, 루브릭 평가)이 우선이다. 멀티모달·실제 수업·수업 중 보조는 상세 설계하지 않고, `session_type=real`과 `source=device` 같은 값만 예약해 확장 여지를 둔다.

## 완료 조건
- [x] ID 6종 형식 정의 (`ids.py`)
- [x] 타임라인 이벤트 스키마: 필드 타입, `source` 허용값 (`event_type`은 형식만, 허용값은 v1)
- [x] 평가 결과 스키마: 판단 불가 규칙, `evidence` 최소 1개 검증(예외 포함), `confidence` 범위
- [~] 지도안 스키마: 최소 구조만 정의. 세부 필드는 샘플 지도안 후 확정
- [x] 강사 효과와 집단 효과 분리용 ID: `cohort_id`, `institution_id`, `occurrence` (원본 5·7장)
- [x] 세션 유형과 시뮬레이션 모드 필드 (원본 3장). `real`·`device`는 값만 예약
- [x] "등급 결정 사용 불가" 표시: `grade_use()` 계산 함수로 구현 (저장 안 함)
- [~] 검토 상태 필드: `review_status` 4값만 정의. 검토자·수정 내용 기록은 [human-review](human-review.md)에서 결정
- [x] 클릭 입력 사건용 `source=ui`. 입력 채널 표현은 루브릭 항목 쪽에서 정함 (rubric-draft)
- [ ] 시나리오와 `lesson_id` 연결, 시뮬레이션의 `cohort_id` 처리 (시나리오 설계 시. 현재 `cohort_id`는 선택값)
- [ ] LessonPlan이 수업 가이드 생성에 필요한 정보(진행 흐름, 질문 방식, 이해 확인, 상황 대응)를 담을 수 있는지 확인 (수업 가이드 설계 TODO와 함께)
- [ ] 평가 결과에 모델 정보(`model_id`, `backend`, 프롬프트 버전) 포함 여부 — v0에는 넣지 않음. 로컬/API 비교 eval 설계 시 결정
- [x] 가짜 데이터 예시와 검증 테스트 (`packages/core/tests`, 28개 통과)
- [x] `02-specs.md` 갱신, `reports/`에 결정 기록
- [ ] 학습 문서 (AGENTS.md §4) 퀴즈 통과 (문서는 생성됨, 결과 미확인)

## 진행 기록
- 260930: TODO 생성
- 260930: 착수. 검증 라이브러리 선택(05 draft)은 스키마 작업 중 함께 결정하기로 함.
- 260930: 설계 초안 작성, 학습 문서 생성 [260930-schema-v0-design](../learning/260930-schema-v0-design.html). 첫 버전이 어려워 유치원생 눈높이로 교체(같은 파일명). 퀴즈 통과 대기. 열린 결정 3건(undetermined의 evidence 허용, grade_use 저장/계산, pydantic 채택) 미확정.
- 261001: 열린 결정 3건 확정(undetermined는 evidence 비움 + reason 필수, grade_use는 계산, pydantic v2). 퀴즈 결과 확인 없이 사용자 지시로 진행. 코드와 테스트 작성, 문서 반영. [261001-1151-05-schema-v0-impl](../reports/261001-1151-05-schema-v0-impl.md)

## 막힌 점 / 필요한 것
- 루브릭 항목 구조가 `rubric_item_id`와 `verdict` 허용값에 영향. 루브릭 가안과 병행 필요.
- 지도안 세부 필드는 샘플 지도안을 받아야 확정 가능. v0는 가정으로 시작.
- 검증 라이브러리는 pydantic v2로 확정(261001, `05-coding-rules.md` 반영). ruff·타입 체커 등 나머지 draft 항목은 남아 있음.
- 동의 범위·보관 만료 메타데이터, 편향 모니터링용 강사 속성 수집 여부는 정책 결정이 필요 → [policy-confirmation](policy-confirmation.md). v0에서는 필드를 넣지 않고 확장 가능하게만 설계.
