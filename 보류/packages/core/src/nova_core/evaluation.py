from pydantic import Field, model_validator

from nova_core._base import CoreModel
from nova_core.enums import EvidenceKind, OutputType, ReviewStatus
from nova_core.ids import RubricItemId, SessionId

# 판단 불가를 나타내는 verdict 값. 나머지 허용값은 루브릭이 정해진 뒤 고정한다.
UNDETERMINED = "undetermined"


class Evidence(CoreModel):
    kind: EvidenceKind
    ref: str = Field(min_length=1)


class EvaluationResult(CoreModel):
    """평가 한 건. 판정은 근거에 기대고, 근거를 못 찾으면 판단 불가로 보고한다.

    규칙 (docs/02-specs.md 하네스 규칙, 결정 261001):
    - 일반 판정은 evidence가 최소 1개 있어야 한다.
    - verdict가 undetermined이면 evidence를 비울 수 있지만 reason이 필수다.
    - classify/generate는 confidence가 필수, measure(규칙 계산)는 비울 수 있다.
    JSON 스키마로는 이 교차 규칙을 표현하지 못하므로 생성 결과를 반드시 검증한다.
    """

    session_id: SessionId
    rubric_item_id: RubricItemId
    verdict: str = Field(min_length=1)  # 허용값은 루브릭 확정 후 고정
    evidence: list[Evidence] = Field(default_factory=list)
    reason: str | None = None
    output_type: OutputType
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    verified: bool = False  # 전문가 일치도가 검증됐는가 (미검증은 참고용)
    review_status: ReviewStatus = ReviewStatus.NONE

    @model_validator(mode="after")
    def _evidence_and_reason_rules(self) -> "EvaluationResult":
        if self.verdict == UNDETERMINED:
            if not (self.reason and self.reason.strip()):
                raise ValueError("판단 불가(undetermined)는 reason이 필요하다")
        elif not self.evidence:
            raise ValueError("판정에는 evidence가 최소 1개 필요하다")
        if self.output_type is not OutputType.MEASURE and self.confidence is None:
            raise ValueError("classify/generate 결과는 confidence가 필요하다")
        return self
