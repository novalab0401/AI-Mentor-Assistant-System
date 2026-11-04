"""공통 스키마 v0 검증 테스트. 모든 데이터는 가짜다 (AGENTS.md §3)."""

import pytest
from pydantic import ValidationError

from nova_core import (
    UNDETERMINED,
    EvaluationResult,
    GradeUse,
    LessonPlan,
    Session,
    TimelineEvent,
    grade_use,
)


def make_session(**overrides):
    base = {
        "session_id": "ses_demo01",
        "lesson_id": "les_demo01",
        "instructor_id": "ins_demo01",
        "session_type": "mock",
    }
    base.update(overrides)
    return Session(**base)


def make_result(**overrides):
    base = {
        "session_id": "ses_demo01",
        "rubric_item_id": "rub_demo01",
        "verdict": "met",
        "evidence": [{"kind": "timestamp", "ref": "ses_demo01@20.1"}],
        "output_type": "classify",
        "confidence": 0.8,
    }
    base.update(overrides)
    return EvaluationResult(**base)


# ── ID ──────────────────────────────────────────────────────────
@pytest.mark.parametrize("bad", ["demo01", "les_demo01", "SES_DEMO01", "ses_", "ses_a-b"])
def test_session_id_requires_prefix_and_lowercase(bad):
    with pytest.raises(ValidationError):
        make_session(session_id=bad)


def test_unknown_field_is_rejected():
    with pytest.raises(ValidationError):
        make_session(favorite_color="blue")


# ── Session ─────────────────────────────────────────────────────
def test_simulation_requires_sim_mode():
    with pytest.raises(ValidationError):
        make_session(session_type="simulation")
    s = make_session(session_type="simulation", sim_mode="evaluation")
    assert s.sim_mode == "evaluation"


@pytest.mark.parametrize("session_type", ["mock", "real"])
def test_sim_mode_forbidden_outside_simulation(session_type):
    with pytest.raises(ValidationError):
        make_session(session_type=session_type, sim_mode="practice")


def test_occurrence_must_be_positive():
    with pytest.raises(ValidationError):
        make_session(occurrence=0)


# ── TimelineEvent ───────────────────────────────────────────────
def test_event_valid_and_click_source():
    e = TimelineEvent(
        session_id="ses_demo01", t=12.5, source="ui", event_type="click_checkpoint", payload={"item": "x"}
    )
    assert e.source == "ui"


@pytest.mark.parametrize("t", [-1, float("nan"), float("inf")])
def test_event_t_must_be_finite_non_negative(t):
    with pytest.raises(ValidationError):
        TimelineEvent(session_id="ses_demo01", t=t, source="asr", event_type="utterance")


def test_event_source_and_type_format():
    with pytest.raises(ValidationError):
        TimelineEvent(session_id="ses_demo01", t=1, source="camera", event_type="utterance")
    with pytest.raises(ValidationError):
        TimelineEvent(session_id="ses_demo01", t=1, source="asr", event_type="Bad Type")


# ── EvaluationResult ────────────────────────────────────────────
def test_normal_verdict_needs_evidence():
    with pytest.raises(ValidationError):
        make_result(evidence=[])


def test_undetermined_may_omit_evidence_but_needs_reason():
    r = make_result(verdict=UNDETERMINED, evidence=[], reason="음성 인식 확신도 낮음", confidence=0.3)
    assert r.evidence == []
    with pytest.raises(ValidationError):
        make_result(verdict=UNDETERMINED, evidence=[])
    with pytest.raises(ValidationError):
        make_result(verdict=UNDETERMINED, evidence=[], reason="   ")


def test_confidence_rules():
    with pytest.raises(ValidationError):
        make_result(confidence=None)  # classify는 필수
    with pytest.raises(ValidationError):
        make_result(confidence=1.5)
    m = make_result(output_type="measure", confidence=None)  # 규칙 계산은 비울 수 있음
    assert m.confidence is None


def test_defaults_are_conservative():
    r = make_result()
    assert r.verified is False
    assert r.review_status == "none"


def test_result_is_immutable():
    r = make_result()
    with pytest.raises(ValidationError):
        r.verified = True


# ── grade_use ───────────────────────────────────────────────────
@pytest.mark.parametrize(
    ("session_kwargs", "result_kwargs", "expected"),
    [
        ({"session_type": "mock"}, {"verified": True}, GradeUse.ALLOWED),
        ({"session_type": "real"}, {"verified": True}, GradeUse.ALLOWED),
        ({"session_type": "mock"}, {"verified": False}, GradeUse.REFERENCE_ONLY),
        (
            {"session_type": "simulation", "sim_mode": "evaluation"},
            {"verified": True},
            GradeUse.REFERENCE_ONLY,
        ),
        (
            {"session_type": "mock"},
            {"verified": True, "verdict": UNDETERMINED, "evidence": [], "reason": "판별 불가"},
            GradeUse.REFERENCE_ONLY,
        ),
    ],
)
def test_grade_use_truth_table(session_kwargs, result_kwargs, expected):
    assert grade_use(make_session(**session_kwargs), make_result(**result_kwargs)) == expected


def test_grade_use_rejects_mismatched_session():
    with pytest.raises(ValueError):
        grade_use(make_session(session_id="ses_other"), make_result())


# ── LessonPlan ──────────────────────────────────────────────────
def test_lesson_plan_valid_and_activity_phase_check():
    plan = LessonPlan(
        lesson_id="les_demo01",
        objectives=["(가짜) 목표"],
        phases=[{"name": "도입", "minutes": 10}],
        activities=[{"name": "(가짜) 활동", "phase": "도입"}],
    )
    assert plan.phases[0].minutes == 10
    with pytest.raises(ValidationError):
        LessonPlan(
            lesson_id="les_demo01",
            phases=[{"name": "도입", "minutes": 10}],
            activities=[{"name": "활동", "phase": "없는단계"}],
        )
    with pytest.raises(ValidationError):
        LessonPlan(lesson_id="les_demo01", phases=[{"name": "도입", "minutes": 0}])


# ── JSON 스키마 내보내기 ────────────────────────────────────────
def test_json_schema_export_works():
    for model in (Session, TimelineEvent, EvaluationResult, LessonPlan):
        schema = model.model_json_schema()
        assert schema["type"] == "object"
        assert schema["additionalProperties"] is False
