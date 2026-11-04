# CosyVoice 2 저장소 루트에서 실행: python <이 파일 경로>
# 화자 프롬프트는 저장소에 포함된 샘플 음성을 쓴다. 실제 강사 음성은 동의 없이 쓰지 않는다.
import sys
import time
from pathlib import Path

import torch
import torchaudio

sys.path.append(".")
sys.path.append("third_party/Matcha-TTS")
from cosyvoice.cli.cosyvoice import CosyVoice2  # noqa: E402

sys.path.append(str(Path(__file__).parent))
from sentences import SENTENCES  # noqa: E402

out = Path(__file__).parent / "out"
out.mkdir(exist_ok=True)

model = CosyVoice2("pretrained_models/CosyVoice2-0.5B", load_jit=False, load_trt=False, fp16=False)
prompt_wav = "asset/zero_shot_prompt.wav"

for sid, variants in SENTENCES.items():
    for kind, text in variants.items():
        start = time.perf_counter()
        chunks = [c["tts_speech"] for c in model.inference_cross_lingual(text, prompt_wav, stream=False)]
        torchaudio.save(str(out / f"cosy_{sid}_{kind}.wav"), torch.cat(chunks, dim=1), model.sample_rate)
        print(f"cosy {sid} {kind}: {time.perf_counter() - start:.1f}s")
