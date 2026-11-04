from pydantic import Field, model_validator

from nova_core._base import CoreModel
from nova_core.enums import SessionType, SimMode
from nova_core.ids import CohortId, InstitutionId, InstructorId, LessonId, SessionId


class Session(CoreModel):
    """수업 한 번의 기록 카드. 이벤트와 평가 결과가 session_id로 참조한다."""

    session_id: SessionId
    lesson_id: LessonId
    instructor_id: InstructorId
    # 강사 효과와 집단 효과를 분리하기 위한 축 (원본 기획서 5·7장). 시뮬레이션은 비울 수 있다.
    cohort_id: CohortId | None = None
    institution_id: InstitutionId | None = None
    occurrence: int | None = Field(default=None, ge=1)  # 같은 차시의 몇 번째 회차
    session_type: SessionType
    sim_mode: SimMode | None = None

    @model_validator(mode="after")
    def _sim_mode_only_for_simulation(self) -> "Session":
        if self.session_type is SessionType.SIMULATION and self.sim_mode is None:
            raise ValueError("simulation 세션은 sim_mode(practice|evaluation)가 필요하다")
        if self.session_type is not SessionType.SIMULATION and self.sim_mode is not None:
            raise ValueError("sim_mode는 simulation 세션에서만 지정한다")
        return self
