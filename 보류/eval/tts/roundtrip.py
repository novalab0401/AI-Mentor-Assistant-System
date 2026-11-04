# 생성된 wav를 Whisper로 다시 받아써서 의도한 문장과 비교한다 (대략적인 명료도 확인용).
from pathlib import Path

import librosa
import soundfile as sf
import whisper

out = Path(__file__).parent / "out"
model = whisper.load_model("small", device="cpu")

for wav in sorted(out.glob("*.wav")):
    duration = sf.info(str(wav)).duration
    audio, _ = librosa.load(str(wav), sr=16000, mono=True)  # ffmpeg 없이 로드
    text = model.transcribe(audio, language="ko", fp16=False)["text"].strip()
    print(f"{wav.stem:16} {duration:5.1f}s | {text}")
