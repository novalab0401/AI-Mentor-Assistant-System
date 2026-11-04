# 260930-1209 문서 구조와 작업 흐름 정비

- 관련 TODO: schema-v0 (다음 작업), cognitive-teacher 스킬 규칙
- 변경 범위: AGENTS.md, docs/ 구조, git init

## 요약
다른 PC·세션에서도 저장소 문서만으로 맥락을 이어가도록 구조를 정비했다.
현재 상태판(`00-status.md`), 코딩 규칙, 학습 문서 폴더를 추가하고 작업 흐름에 학습 관문을 넣었다.

## 주요 결정
| 결정 | 이유 | 대안 |
|---|---|---|
| 최종 시스템에 MCP 없음 | 고정 파이프라인, 오프라인 동작, 서비스 호출 관계가 이미 정해짐 | 서비스를 MCP 도구로 노출 |
| prd/architecture/task/memory.md 미도입 | 03, 01+02, todo/, reports와 중복. 진입점이 흐려지고 낡을 위험 | 6개 파일 구성 |
| `00-status.md` 신설 (memory.md 대신) | 현재 상태 요약이 어디에도 없었음. 포인터 중심, 40줄 제한 | Claude 자동 메모리에 의존 |
| `05-coding-rules.md` 신설 | 제품 원칙은 있으나 코딩 규칙이 없었음 | AGENTS.md에 합침 |
| design.md는 앱 착수 시 작성 | apps가 비어 있고 MVP가 리포트 중심 | 지금 작성 |
| 학습 문서(`docs/learning/`)는 개념·결정이 새로 나온 TODO에만, 퀴즈 통과가 다음 단계의 관문 | 남용 방지, 이해 확인 | 모든 TODO 뒤에 생성 |
| 스킬은 저장소에 포함하지 않고 PC별 설치 | 사용자 결정 유보 시 기본값. 필요하면 `.claude/skills/`로 이동 | 저장소 포함 |
| TODO 상세화는 다음 1~2개만 | 앞 작업 결과가 뒤 TODO를 바꿈 | 전체 선작성 |
| 맥락은 저장소 문서에 둔다 | 자동 메모리·대화는 PC 간 이동 안 됨 | 메모리 의존 |

## 변경 사항
- `AGENTS.md`: 작업 흐름 7단계로 확장, §4 스킬 규칙 작성
- 신규: `docs/00-status.md`, `docs/05-coding-rules.md`, `docs/learning/`, `docs/todo/schema-v0.md`
- `git init` 실행 (커밋·원격 없음)

## 후속 작업
- [ ] git 원격(비공개) 연결, 첫 커밋
- [ ] 스킬 공유 방식 재확인 (저장소 포함 여부)
- [ ] `05-coding-rules.md` draft 항목 확정
- [ ] 앱 착수 시 `design.md` 작성
