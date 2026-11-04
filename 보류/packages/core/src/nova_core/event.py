from typing import Any

from pydantic import Field

from nova_core._base import CoreModel
from nova_core.enums import EventSource
from nova_core.ids import SessionId


class TimelineEvent(CoreModel):
    """수업 중 사건. 모든 사건이 같은 시계(세션 시작 기준 초) 위에 놓인다."""

    session_id: SessionId
    t: float = Field(ge=0, allow_inf_nan=False)  # 세션 시작 후 경과 초 (설계 판단)
    source: EventSource
    # v0는 형식만 강제한다. 허용값 목록과 타입별 payload 스키마는 v1에서 고정한다.
    event_type: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    payload: dict[str, Any] = Field(default_factory=dict)
