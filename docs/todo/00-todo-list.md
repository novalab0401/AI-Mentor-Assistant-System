# 00. TODO 목록

원칙: 수업 전(MVP)을 상세히, 이후 영역은 제약 조건만 얕게 잡는다. 결정하기 비싼 것(ID, 스키마 필드)은 전 영역을 고려한다.

## MVP (수업 전)

| 상태 | 우선 | 항목 | 파일 |
|---|---|---|---|
| todo | P0 | 요청자에게 범위·자원 확인 (기간, 인원, 산출물, 데이터, 담당자 요구 확인 질문) | [scope-confirmation](scope-confirmation.md) |
| todo | P0 | 강사 역량 루브릭 가안 작성 → 커리큘럼팀 확인 (입력 채널, 시뮬레이션 항목 포함) | [rubric-draft](rubric-draft.md) |
| doing | P0 | 공통 스키마 v0 설계 (지도안, 이벤트, 평가 결과) | [schema-v0](schema-v0.md) |
| todo | P1 | 수업 가이드 설계 (지도안 기반 정적 가이드, 슬라이드 + 음성/텍스트, 검토 절차) | |
| todo | P1 | 클릭 입력 설계 (수업 중 클릭 → 이벤트 → 루브릭 평가) | |
| todo | P1 | 데이터·공정성 정책 확인 (동의, 보관, 편향 모니터링, 재평가) | [policy-confirmation](policy-confirmation.md) |
| todo | P1 | 사람 검토 절차 설계 (검토 대상, 주체, 화면, 기록, 형식적 검토 점검) | [human-review](human-review.md) |
| todo | P1 | 지도안 템플릿 역추출 (받은 초반 설계 자료 기준) | |
| todo | P1 | ASR 베이스라인 측정 (정답 전사본 1~2시간) | |
| todo | P1 | 로컬 모델 품질 기준 정의와 후보 모델 비교 eval (API 전환 판단 기준) | |
| todo | P1 | 도메인 용어집 채우기 | |
| todo | P1 | 개발 환경 세팅 (5090 노트북 CUDA·vLLM·faster-whisper 호환 확인) | |
| todo | P1 | git 원격(비공개) 연결, 첫 커밋 | |
| todo | P1 | 05-coding-rules.md draft 항목 확정 | |
| todo | P2 | 자율주행 PID 가상 학생 시나리오 3~5개 (학생 반응·돌발상황 유형, 차시 선택 구조 포함) | |
| todo | P2 | design.md 작성 (앱 착수 시) | |
| done | P2 | cognitive-teacher 스킬 사용 규칙 AGENTS.md에 작성 | [260930-1209-02](../reports/260930-1209-02-docs-structure.md) |

## 이후 (수업 후·수업 중)

MVP 검증 후 상세화. 지금은 스키마가 수용 가능한지만 확인한다 (schema-v0 참조).

| 상태 | 우선 | 항목 | 파일 |
|---|---|---|---|
| todo | P2 | 멀티모달 분석: 영상(시선·표정·제스처) 도입 여부와 방식 | |
| todo | P2 | 수업 후 분석: 실제 수업 음성 + 설문 결합 설계 | |
| todo | P2 | 수업 중 힌트: 기기 로그 수집 가능 여부 확인 (scope-confirmation 항목) | |
