# 05. 코딩 규칙

제품 원칙은 `AGENTS.md` §2~3, 기술 제약은 `02-specs.md`. 이 문서는 코드 작성 규칙만 다룬다.
초안이며 항목은 착수 시점에 확정한다. (`draft`로 표시된 것은 미확정)

## 확정 (기존 문서에서 가져옴)
- 언어 Python, 의존성 관리는 uv 워크스페이스. (02)
- 공통 스키마는 `packages/core`에서만 정의한다. 앱에서 필드를 임의로 만들지 않는다. (AGENTS)
- import 방향은 `apps → services → packages/core`. `studio`↔`live` import 금지. (01)
- 모든 AI 출력에 `output_type`(`measure|classify|generate`)을 붙인다. (AGENTS, 02)
- 규칙으로 계산 가능한 지표는 코드로 계산한다. LLM에 맡기지 않는다. (AGENTS)
- 테스트·예시에는 가짜 데이터만 쓴다. 실제 학생·강사 데이터 금지. (AGENTS)
- 외부 API 호출 금지. (AGENTS)

## 확정 (261001, 스키마 v0 작업 중)
- 스키마는 pydantic v2로 정의한다. 모델은 `CoreModel` 기반: `extra="forbid"`(정의 안 된 필드 거부), `frozen=True`(불변). 같은 정의에서 검증과 JSON 스키마를 얻는다. (02 하네스 규칙)
- 테스트는 pytest. 테스트 데이터는 가짜만. 스키마 규칙을 추가하면 통과·실패 사례 테스트를 함께 넣는다.
- 워크스페이스: 루트 `pyproject.toml`의 `members = ["packages/*"]`. 실행은 `uv run pytest packages/core`.
- 검증된 Python: 3.13, 3.14 (pydantic 2.13.5, 261001).

## draft (착수 시 확정)
- 스타일·린트: ruff 사용 여부
- 타입 힌트 범위, 타입 체커 사용 여부
- 하네스 코드: JSON 스키마 강제와 근거 검증 후처리를 공통 모듈로 둘지
- 커밋 메시지 형식, 브랜치 규칙
