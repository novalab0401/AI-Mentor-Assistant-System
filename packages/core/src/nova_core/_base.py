from pydantic import BaseModel, ConfigDict


class CoreModel(BaseModel):
    """모든 스키마의 기반. 정의되지 않은 필드는 거부하고, 생성 후 변경하지 못하게 한다.

    앱에서 임의로 필드를 만들지 않는다는 원칙(AGENTS.md §2)을 코드로 강제한다.
    """

    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)
