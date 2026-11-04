"""Nova Coach 공통 스키마 (v0 초안).

모든 앱·서비스가 공유하는 데이터 형식. 스키마는 이 패키지에서만 정의한다.
변경하면 docs/reports/에 기록한다. (AGENTS.md §2, docs/01-folder-architecture.md)
"""

from nova_core.enums import (
    EventSource,
    EvidenceKind,
    GradeUse,
    OutputType,
    ReviewStatus,
    SessionType,
    SimMode,
)
from nova_core.evaluation import UNDETERMINED, EvaluationResult, Evidence
from nova_core.event import TimelineEvent
from nova_core.grading import grade_use
from nova_core.ids import (
    CohortId,
    InstitutionId,
    InstructorId,
    LessonId,
    RubricItemId,
    SessionId,
)
from nova_core.lesson_plan import Activity, LessonPlan, Phase
from nova_core.session import Session

__all__ = [
    "UNDETERMINED",
    "Activity",
    "CohortId",
    "EvaluationResult",
    "EventSource",
    "Evidence",
    "EvidenceKind",
    "GradeUse",
    "InstitutionId",
    "InstructorId",
    "LessonId",
    "LessonPlan",
    "OutputType",
    "Phase",
    "ReviewStatus",
    "RubricItemId",
    "Session",
    "SessionId",
    "SessionType",
    "SimMode",
    "TimelineEvent",
    "grade_use",
]
