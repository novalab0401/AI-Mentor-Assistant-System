"""수업 지도안 폴더의 원본 문서를 웹앱이 읽는 JSON으로 변환한다.

입력: 수업 지도안/ (지도안 docx 12개, 교육 운영 제안서 docx, rubric-studio.html)
출력: content/lessons.json, content/program.json, content/rubric.json, content/feedback-standard.json

사용: python scripts/extract_content.py
원본 문서가 바뀌면 다시 실행한다. 학생·강사 개인 정보는 원본에 없으며, 넣지 않는다.
"""
import html
import json
import re
import subprocess
from pathlib import Path

import docx

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "수업 지도안"
OUT = ROOT / "content"

FIELDS = ["입문", "화학·소재", "에너지", "환경공학", "로봇·제어", "우주·항공"]


def cells(row):
    """병합 셀을 한 번만 읽는다."""
    out, prev = [], None
    for c in row.cells:
        if c._tc is prev:
            continue
        prev = c._tc
        out.append(c.text.strip())
    return out


def minutes(s):
    m = re.search(r"\((\d+)\s*[′']\)", s)
    return int(m.group(1)) if m else None


def label(s):
    """'본시학습\n안내\n(2′)' -> '본시학습 안내'"""
    s = re.sub(r"\(\d+\s*[′']\)", "", s)
    return " ".join(x.strip() for x in s.split("\n") if x.strip())


def bullets(s):
    items = [re.sub(r"^[·•\-]\s*", "", x.strip()) for x in s.split("\n")]
    return [x for x in items if x]


def field_of(unit):
    for f in FIELDS:
        if unit.startswith(f.split("·")[0]) or unit.startswith(f):
            return f
    if "진로" in unit:
        return "입문"
    return unit.split(" ")[0]


def parse_lesson(path):
    d = docx.Document(path)
    no = int(path.name[:2])
    info = {}
    for row in d.tables[0].rows:
        c = cells(row)
        for i in range(0, len(c) - 1, 2):
            info[c[i]] = c[i + 1]
    unit = info.get("단원/주제", "")
    unit_head = unit.split("―")[0].strip()
    title = unit.split("―")[-1].strip() if "―" in unit else d.paragraphs[1].text.strip()

    materials = {"teacher": "", "student": ""}
    for part in info.get("준비 자료", "").split("\n"):
        part = part.strip()
        if part.startswith("강사:"):
            materials["teacher"] = part[3:].strip()
        elif part.startswith("학생:"):
            materials["student"] = part[3:].strip()

    steps = []
    for row in d.tables[1].rows[2:]:
        c = cells(row)
        if len(c) < 6:
            continue
        stage, topic, teacher, student, mats, notes = c[:6]
        steps.append({
            "stage": label(stage),
            "stageMinutes": minutes(stage),
            "topic": label(topic),
            "minutes": minutes(topic),
            "teacher": bullets(teacher),
            "student": bullets(student),
            "materials": mats.replace("\n", " "),
            "notes": bullets(notes),
        })

    return {
        "no": no,
        "title": title,
        "field": "입문" if no == 1 else field_of(unit_head),
        "unit": unit_head,
        "method": info.get("교수학습 형태", ""),
        "target": info.get("대상", "").replace("\n", " "),
        "goals": [re.sub(r"^\d+\.\s*", "", g) for g in bullets(info.get("학습 목표", ""))],
        "materials": materials,
        "durationMinutes": 60,
        "steps": steps,
    }


def parse_program():
    d = docx.Document(SRC / "교육 운영 제안서ver.2.docx")
    paras = [p.text.strip() for p in d.paragraphs if p.text.strip()]
    t0 = {}
    for row in d.tables[0].rows:
        c = cells(row)
        for i in range(0, len(c) - 1, 2):
            t0[c[i]] = c[i + 1]
    t1 = {cells(r)[0].strip(): cells(r)[1] for r in d.tables[1].rows}
    curriculum = []
    for i, row in enumerate(d.tables[2].rows[1:]):
        theme, name, detail = cells(row)[:3]
        lines = [x.strip() for x in detail.split("\n") if x.strip()]
        goal = lines[0].replace("학습 목표:", "").strip() if lines else ""
        curriculum.append({
            "no": i + 1,
            "theme": label(theme).replace("(", "").replace(")", "").split(" ")[0],
            "title": name.strip().rstrip("?") + ("?" if name.strip().endswith("?") else ""),
            "goal": goal,
            "description": " ".join(lines[1:]),
        })
    return {
        "name": t0.get("강좌명", "STEM 진로 탐험대"),
        "site": "성남다함께돌봄센터 35호점",
        "target": t0.get("대상 / 인원", "").replace("\n", " "),
        "schedule": t0.get("희망 운영 시간", ""),
        "sessions": t0.get("희망 운영 차시", ""),
        "room": t0.get("강의실 준비 사항", ""),
        "studentPrep": t0.get("수강생 준비사항", "").replace("\n", " "),
        "intro": paras[1] if len(paras) > 1 else "",
        "outcome": paras[3] if len(paras) > 3 else "",
        "goals": [re.sub(r"^[①-⑨]\s*", "", x) for x in bullets(t1.get("프로그램 목표", ""))],
        "contents": [re.sub(r"^[①-⑨]\s*", "", x) for x in bullets(t1.get("주요 교육 내용", ""))],
        "method": t1.get("주요 강의 방법", ""),
        "evaluation": t1.get("평가 방법", ""),
        "curriculum": curriculum,
    }


def parse_rubric(src):
    m = re.search(r"const common=(\[.*?\]);", src, re.S)
    js = "process.stdout.write(JSON.stringify(" + m.group(1) + "))"
    raw = subprocess.run(["node", "-e", js], capture_output=True, text=True, encoding="utf-8", check=True).stdout
    items = json.loads(raw)
    return [{"id": c["id"], "name": c["name"], "weight": c["weight"], "critical": bool(c.get("critical")),
             "levels": c["desc"]} for c in items]


def parse_feedback_standard(src):
    body = re.sub(r"<script.*?</script>|<style.*?</style>", "", src, flags=re.S)
    lines = [html.unescape(x).strip() for x in re.sub(r"<[^>]+>", "\n", body).split("\n")]
    lines = [x for x in lines if x]
    start = next(i for i, x in enumerate(lines) if re.match(r"^1\.\s", x))
    end = lines.index("최종 피드백 검토 체크리스트")
    principles, cur, mode = [], None, "bullets"
    for x in lines[start:end]:
        if re.match(r"^\d\.\s", x):
            cur = {"no": int(x[0]), "title": x[3:].strip(), "summary": "", "points": [], "example": "", "exampleLabel": ""}
            principles.append(cur)
            mode = "summary"
            continue
        if mode == "summary":
            cur["summary"] = x
            mode = "bullets"
        elif x in ("예", "우선순위 기준", "샌드위치 피드백"):
            cur["exampleLabel"] = x
            mode = "example"
        elif mode == "example":
            cur["example"] += ("\n" if cur["example"] else "") + x
        else:
            cur["points"].append(x)
    checklist = []
    tail = lines[end + 1:]
    for i, x in enumerate(tail):
        if x.startswith("·") and i > 0:
            checklist.append({"name": tail[i - 1], "question": x.lstrip("· ").strip()})
    return {"principles": principles, "checklist": checklist}


def main():
    OUT.mkdir(exist_ok=True)
    plans = sorted((SRC / "STEM진로탐험대_수업지도안").glob("[0-9][0-9]차시_*.docx"))
    lessons = [parse_lesson(p) for p in plans]
    program = parse_program()
    for les, cur in zip(lessons, program["curriculum"]):
        les["summary"] = cur["description"]
        cur["theme"] = les["field"]
    src = (SRC / "rubric-studio.html").read_text(encoding="utf-8")
    data = {
        "lessons.json": lessons,
        "program.json": program,
        "rubric.json": parse_rubric(src),
        "feedback-standard.json": parse_feedback_standard(src),
    }
    for name, obj in data.items():
        (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
        print("wrote", name)


if __name__ == "__main__":
    main()
