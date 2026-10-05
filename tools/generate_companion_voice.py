"""Record every spoken line in src/npc/voiceLines.js with an offline voice, so
she sounds the same in every browser.

Uses Piper (https://github.com/OHF-Voice/piper1-gpl), a text-to-speech engine
that runs locally, with its "cori" British English voice, which was trained on
public-domain LibriVox recordings. Piper is only used here as a tool; nothing of
it ships with the game.

Writes:

  public/audio/companion-voice.wav   every line, back to back
  public/audio/companion-voice.json  where each line starts and ends, keyed by its text

Lines are keyed by their exact text, so after editing voiceLines.js run this
again. A line with no recording falls back to the browser's speech.

Usage (needs node, numpy and piper-tts):

  pip install piper-tts numpy
  curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/high/en_GB-cori-high.onnx
  curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/high/en_GB-cori-high.onnx.json
  python3 tools/generate_companion_voice.py en_GB-cori-high.onnx
"""

import json
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_RMS = 0.1  # loudness of each line's speech
PAD = 0.04  # seconds of quiet kept either side
LENGTH_SCALE = 0.95  # a touch quicker than Piper's default, more like chat
NOISE_SCALE = 0.7  # a little more variation in delivery than the default

# What to actually say where the written line doesn't come out right.
SPOKEN = {
    'Wheee!': 'Wheeeee!',
    'Ooh, go on.': 'Ooh. Go on.',
    'Ooh, steady.': 'Ooh. Steady.',
    'Ooh, I like this.': 'Ooh. I like this.',
    'Pooh, that\'s smoky.': 'Poo that\'s smoky.',
    'Oh, not again.': 'Oh not again.',
    "Don't go mad.": "Don't go mad!",
}


def lines():
    script = (
        f"const m = await import({json.dumps('file://' + os.path.join(ROOT, 'src/npc/voiceLines.js'))});"
        "const s = new Set();"
        "for (const e of Object.values(m.VOICE_LINES)) for (const l of e.lines) if (typeof l === 'string') s.add(l);"
        "console.log(JSON.stringify([...s]));"
    )
    out = subprocess.run(['node', '--input-type=module', '-e', script], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def synth(model, text, path):
    subprocess.run(
        ['piper', '-m', model, '-f', path, '--length-scale', str(LENGTH_SCALE), '--noise-scale', str(NOISE_SCALE)],
        input=text,
        text=True,
        check=True,
        capture_output=True,
    )
    with wave.open(path) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return x, sr


def tidy(x, sr):
    """Trims silence, evens out the level and fades the ends."""
    n = int(0.01 * sr)
    env = np.array([np.sqrt(np.mean(x[i : i + n] ** 2)) for i in range(0, len(x) - n, n)])
    voiced = np.where(env > env.max() * 0.05)[0]
    a = max(0, voiced[0] * n - int(PAD * sr))
    b = min(len(x), (voiced[-1] + 1) * n + int(PAD * sr))
    x = x[a:b].copy()
    speech = env[voiced[0] : voiced[-1] + 1]
    rms = np.sqrt(np.mean(speech[speech > speech.max() * 0.1] ** 2))
    x *= TARGET_RMS / rms
    f = int(0.01 * sr)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    return x


def main():
    model = sys.argv[1]
    texts = lines()
    out, clips, sr = [], {}, None
    cursor = 0
    with tempfile.TemporaryDirectory() as tmp:
        for i, text in enumerate(texts):
            x, sr = synth(model, SPOKEN.get(text, text), os.path.join(tmp, f'{i}.wav'))
            x = tidy(x, sr)
            clips[text] = {'start': round(cursor / sr, 5), 'dur': round(len(x) / sr, 5)}
            gap = np.zeros(int(0.05 * sr), dtype=np.float32)
            out += [x, gap]
            cursor += len(x) + len(gap)
    audio = np.concatenate(out)
    path = os.path.join(ROOT, 'public', 'audio', 'companion-voice')
    with wave.open(path + '.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
    with open(path + '.json', 'w') as f:
        json.dump({'file': 'audio/companion-voice.wav', 'voice': os.path.basename(model), 'clips': clips}, f, indent=1)
    print(f'{len(clips)} lines, {len(audio) / sr:.1f} s, peak {np.abs(audio).max():.2f}')


if __name__ == '__main__':
    main()
