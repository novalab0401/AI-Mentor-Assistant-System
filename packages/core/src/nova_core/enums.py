from enum import StrEnum


class SessionType(StrEnum):
    """수업 종류 (원본 기획서 2·3장)."""

    MOCK = "mock"  # 일반 모의수업
    SIMULATION = "simulation"  # 가상 학생 시뮬레이션
    REAL = "real"  # 실제 수업 (값만 예약, 1단계 상세 설계 대상 아님)


class SimMode(StrEnum):
    """시뮬레이션 모드 (원본 3장). 평가용만 강사 간 비교가 성립한다."""

    PRACTICE = "practice"
    EVALUATION = "evaluation"


class EventSource(StrEnum):
    """사건을 만든 주체. 허용값은 초안이며 ASR 베이스라인 후 바뀔 수 있다."""

    ASR = "asr"
    VAD = "vad"
    INSTRUCTOR = "instructor"
    STUDENT_SIM = "student_sim"
    UI = "ui"  # 수업 중 클릭 입력 (담당자 요구 261001)
    DEVICE = "device"  # 실습 기기 로그 (값만 예약)
    RULE = "rule"


class OutputType(StrEnum):
    """AI 출력 유형 (AGENTS.md §2)."""

    MEASURE = "measure"  # 규칙·계산
    CLASSIFY = "classify"  # 근거 기반 분류
    GENERATE = "generate"  # 생성


class EvidenceKind(StrEnum):
    """근거 종류 (docs/02-specs.md)."""

    TIMESTAMP = "timestamp"
    LOG_ID = "log_id"
    DOC_REF = "doc_ref"


class ReviewStatus(StrEnum):
    """사람 검토 상태. 검토자·수정 내용 기록은 human-review TODO에서 결정."""

    NONE = "none"
    QUEUED = "queued"
    REVIEWED = "reviewed"
    APPEALED = "appealed"


class GradeUse(StrEnum):
    """등급 결정에 쓸 수 있는가. 저장하지 않고 grading.grade_use()로 계산한다."""

    ALLOWED = "allowed"  # 등급 논의에 쓸 자격이 있음 (확정은 아님, 사람 검토 필요)
    REFERENCE_ONLY = "reference_only"
