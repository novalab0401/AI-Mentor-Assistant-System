"""ID 형식: 접두사 + 소문자 영숫자.

접두사는 ID 종류를 섞어 쓰는 실수를 막기 위한 것이다 (설계 판단, 문서 근거 없음).
ID는 무작위로 만들며, 실명·학교명 등 식별 정보에서 만들지 않는다 (원본 기획서 10장 가명 처리).
"""

from typing import Annotated

from pydantic import StringConstraints

LessonId = Annotated[str, StringConstraints(pattern=r"^les_[a-z0-9]+$")]
InstructorId = Annotated[str, StringConstraints(pattern=r"^ins_[a-z0-9]+$")]
SessionId = Annotated[str, StringConstraints(pattern=r"^ses_[a-z0-9]+$")]
RubricItemId = Annotated[str, StringConstraints(pattern=r"^rub_[a-z0-9]+$")]
CohortId = Annotated[str, StringConstraints(pattern=r"^coh_[a-z0-9]+$")]
InstitutionId = Annotated[str, StringConstraints(pattern=r"^org_[a-z0-9]+$")]
