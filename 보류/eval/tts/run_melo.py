# Windows: python-mecab-ko를 MeloTTS 환경과 다른 폴더에 설치하고 PYTHONPATH로 지정 (리포트 261010-0058-07 참고).
# 같은 폴더의 eunjeon.py가 g2pkk와 python-mecab-ko를 연결한다.
import time
from pathlib import Path

from melo.api import TTS

from sentences import SENTENCES

out = Path(__file__).parent / "out"
out.mkdir(exist_ok=True)

model = TTS(language="KR", device="cpu")
speaker = model.hps.data.spk2id["KR"]

for sid, variants in SENTENCES.items():
    for kind, text in variants.items():
        start = time.perf_counter()
        model.tts_to_file(text, speaker, str(out / f"melo_{sid}_{kind}.wav"), speed=1.0)
        print(f"melo {sid} {kind}: {time.perf_counter() - start:.1f}s")
