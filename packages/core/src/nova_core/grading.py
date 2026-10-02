from nova_core.enums import GradeUse, SessionType
from nova_core.evaluation import UNDETERMINED, EvaluationResult
from nova_core.session import Session


def grade_use(session: Session, result: EvaluationResult) -> GradeUse:
    """이 평가 결과를 등급 논의에 쓸 수 있는가. 저장하지 않고 항상 계산한다.

    reference_only 조건:
    - 시뮬레이션 세션 (검증 전까지 참고용, AGENTS.md §2, 원본 6·8장)
    - 전문가 일치도 미검증 (docs/02-specs.md)
    - 판단 불가 (판정이 없으므로 등급에 쓸 내용이 없음, 261001 도출 규칙)

    allowed는 등급 논의에 쓸 자격일 뿐 확정이 아니다.
    불이익이 생기는 판정은 사람 검토 없이 확정하지 않는다 (AGENTS.md §2).
    """
    if result.session_id != session.session_id:
        raise ValueError("결과의 session_id가 세션과 다르다")
    if (
        session.session_type is SessionType.SIMULATION
        or not result.verified
        or result.verdict == UNDETERMINED
    ):
        return GradeUse.REFERENCE_ONLY
    return GradeUse.ALLOWED
