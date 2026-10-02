from pydantic import Field, model_validator

from nova_core._base import CoreModel
from nova_core.ids import LessonId


class Phase(CoreModel):
    name: str = Field(min_length=1)
    minutes: int = Field(gt=0)


class Activity(CoreModel):
    name: str = Field(min_length=1)
    phase: str | None = None  # 소속 단계 이름 (phases 중 하나)


class LessonPlan(CoreModel):
    """지도안 구조화 데이터 (진단과 수업 가이드의 기준 데이터).

    세부 필드는 샘플 지도안을 받은 뒤 확정한다. v0는 최소 구조만 둔다.
    """

    lesson_id: LessonId
    objectives: list[str] = Field(default_factory=list)
    concepts: list[str] = Field(default_factory=list)
    misconceptions: list[str] = Field(default_factory=list)
    phases: list[Phase] = Field(default_factory=list)
    activities: list[Activity] = Field(default_factory=list)

    @model_validator(mode="after")
    def _activity_phase_exists(self) -> "LessonPlan":
        names = {p.name for p in self.phases}
        for a in self.activities:
            if a.phase is not None and a.phase not in names:
                raise ValueError(f"activity '{a.name}'의 phase '{a.phase}'가 phases에 없다")
        return self
