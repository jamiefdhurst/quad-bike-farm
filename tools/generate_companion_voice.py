"""Record every spoken line a companion can say with an offline voice, so each
girl sounds the same in every browser and in her own voice.

Two engines:

  chatterbox  (default) Resemble AI's Chatterbox (MIT licence), which copies the
              voice in a short reference recording and has an "exaggeration"
              control for how emotional a line sounds. Each situation in
              voiceLines.js has a feel (FEEL below), so frightened, excited and
              cross lines come out that way and calm ones stay calm.
              Reference voices, in tools/voices/:
                amy-ref.wav   Piper's "cori" voice (trained on public-domain
                              LibriVox recordings), so Amy sounds as she did
                jess-ref.wav  Ruth Golding reading in RP, from LibriVox's
                              public-domain Dialect and Accent Collection Vol. 1
  piper       The older engine: Piper with its "cori" voice. Flat, but quick.

Neither engine ships with the game; they're only used here.

Every recorded line is checked by ear, by machine: Whisper (openai/whisper-base.en)
transcribes it and the line is recorded again (up to TRIES times) if it doesn't
match the text, keeping the best. Lines that never match are listed at the end
and in <cache>/<character>-unclear.txt, to listen to.

Writes, for the character's voiceBank in src/npc/characters.js:

  public/audio/<voiceBank>.mp3   every line, back to back
  public/audio/<voiceBank>.json  where each line starts and ends, keyed by its text

Lines are keyed by their exact text, so after editing voiceLines.js, a
character's own lines or banterLines.js (what the girls say to each other),
run this again. A line with no recording falls back to
the browser's speech.

Usage (needs node; for Chatterbox a Python 3.11 venv with
`pip install chatterbox-tts transformers librosa soundfile "setuptools<81"`):

  python tools/generate_companion_voice.py --character amy --cache .scratch/voice-cache --fallback en_GB-cori-high.onnx
  python tools/generate_companion_voice.py --character jess --cache .scratch/voice-cache
  python tools/generate_companion_voice.py --character amy --engine piper --model en_GB-cori-high.onnx

With --cache, each line's recording is kept and reused while its text, voice and
settings are unchanged, so only new or edited lines are recorded again.
"""

import argparse
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_RMS = 0.1  # loudness of each line's speech
PAD = 0.04  # seconds of quiet kept either side
GAP = 0.08  # seconds of silence between lines in the bank
TRIES = 4  # recordings of a line before settling for the best
MATCH = 0.8  # how closely Whisper's transcript has to match the text (0..1)
FALLBACK_BELOW = 0.6  # with --fallback, a Chatterbox take this far off is tried again with Piper

# Piper settings.
LENGTH_SCALE = 0.95  # a touch quicker than Piper's default, more like chat
NOISE_SCALE = 0.7  # a little more variation in delivery than the default

# How each situation should sound: Chatterbox's exaggeration (0.5 is neutral,
# higher is more emotional) and cfg weight (lower lets the delivery run freer,
# which suits the more emotional lines). Unlisted situations are 'chat'.
FEELS = {
    'calm': (0.4, 0.5),
    'chat': (0.55, 0.45),
    'cross': (0.7, 0.4),
    'excited': (0.85, 0.35),
    'snide': (0.65, 0.4),
    'scared': (0.9, 0.35),
}
FEEL = {
    **dict.fromkeys(['rideGentle', 'rideLong', 'nearbyWarm', 'mountedTogether', 'waitingSeated', 'likeRed', 'likeBlue',
                     'likeYellow', 'likeGreen', 'likeOrange', 'seatedShakingLong', 'drivePause', 'startWarm'], 'calm'),
    **dict.fromkeys(['rideFun', 'ghostRidingFun', 'ghostStoppedFun', 'driveHappy', 'startCaught', 'caughtAfterStruggle',
                     'ackFaster', 'ackGiveRide', 'ackDrive', 'tunedFast', 'driveSetOffConfident', 'ackFollow',
                     'tinkerLimiter', 'selfDrive', 'ackGoAgain'], 'excited'),
    **dict.fromkeys(['rideFast', 'hardBrake', 'ghostRiding', 'driveTooFast', 'driveOverSteer', 'driveBump',
                     'driveRollBack', 'driveObstacle', 'sprayedHer', 'leftBehind', 'fallingBehind', 'takeOverStop',
                     'takeOverDrive', 'driveScared', 'driveNervous', 'rideRough', 'rideShaking'], 'scared'),
    **dict.fromkeys(['ghostStopped', 'ackKeepOn', 'driveTaken', 'ackStopDrive', 'ackBack', 'driveGaveUp',
                     'startGaveUp', 'stalledRiding', 'outOfFuel', 'selfGetOffWaited', 'askOff', 'askStop'], 'cross'),
    'banter': 'snide',  # the girls bickering (banterLines.js)
}
# How much more (or less) emotional each character is than the feel says.
CHARACTER_LIFT = {'amy': 0.0, 'jess': 0.1}

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


def character_lines(character):
    """The character's spoken lines, each with the situations it's said in, and her voice bank name."""
    script = (
        f"const m = await import({json.dumps('file://' + os.path.join(ROOT, 'src/npc/characters.js'))});"
        f"const c = m.CHARACTERS.find((c) => c.id === {json.dumps(character)});"
        "if (!c) { console.error('no such character'); process.exit(1); }"
        f"const b = await import({json.dumps('file://' + os.path.join(ROOT, 'src/npc/banterLines.js'))});"
        "const out = {};"
        "for (const [k, e] of Object.entries(c.lines)) for (const l of e.lines) if (typeof l === 'string') (out[l] ??= []).push(k);"
        "for (const e of b.BANTER) for (const [who, l] of e.lines) if (who === c.id) (out[l] ??= []).push('banter');"
        "console.log(JSON.stringify({ bank: c.voiceBank, lines: out }));"
    )
    out = subprocess.run(['node', '--input-type=module', '-e', script], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def feel_for(situations, character):
    """The strongest feel of the situations a line is said in, lifted for the character."""
    exag, cfg = max((FEELS[FEEL.get(s, 'chat')] for s in situations), key=lambda f: f[0])
    return round(min(1.0, exag + CHARACTER_LIFT.get(character, 0)), 2), cfg


def words(text):
    text = text.lower().replace("'", '')
    text = re.sub(r'(.)\1{2,}', r'\1', text)  # wheeee -> whe
    return re.sub(r'[^a-z0-9 ]+', ' ', text).split()


def similarity(a, b):
    return difflib.SequenceMatcher(None, ' '.join(words(a)), ' '.join(words(b))).ratio()


class Chatterbox:
    def __init__(self, ref):
        import torch
        from chatterbox.tts import ChatterboxTTS

        self.torch = torch
        device = 'mps' if torch.backends.mps.is_available() else 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model = ChatterboxTTS.from_pretrained(device=device)
        self.model.prepare_conditionals(ref)
        self.sr = self.model.sr

    def say(self, text, exag, cfg, seed):
        self.torch.manual_seed(seed)
        wav = self.model.generate(text, exaggeration=exag, cfg_weight=cfg)
        return wav.squeeze(0).cpu().numpy().astype(np.float32)


class Piper:
    def __init__(self, model, exe='piper'):
        self.model = model
        self.exe = exe
        self.sr = None

    def say(self, text, exag, cfg, seed):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, 'line.wav')
            subprocess.run(
                [self.exe, '-m', self.model, '-f', path, '--length-scale', str(LENGTH_SCALE), '--noise-scale', str(NOISE_SCALE)],
                input=text, text=True, check=True, capture_output=True,
            )
            with wave.open(path) as w:
                self.sr = w.getframerate()
                return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


class Ear:
    """Whisper, to check a recording says what it should."""

    def __init__(self):
        from transformers import pipeline

        self.asr = pipeline('automatic-speech-recognition', model='openai/whisper-base.en')

    def hear(self, x, sr):
        import librosa

        return self.asr(librosa.resample(x, orig_sr=sr, target_sr=16000) if sr != 16000 else x)['text'].strip()


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


def max_seconds(text):
    """Longest a recording of the line could reasonably be: three times a slow reading, and never under 4 s."""
    return max(4.0, 3 * (0.5 + 0.4 * len(text.split())))


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:12]


def main():
    import soundfile as sf

    ap = argparse.ArgumentParser()
    ap.add_argument('--character', default='amy')
    ap.add_argument('--engine', choices=['chatterbox', 'piper'], default='chatterbox')
    ap.add_argument('--ref', help='reference recording for Chatterbox (default tools/voices/<character>-ref.wav)')
    ap.add_argument('--model', help='Piper voice model (.onnx)')
    ap.add_argument('--fallback', help='Piper voice model (.onnx) to record a line with when Chatterbox makes a mess of it '
                    '(short exclamations, mostly); for Amy, the voice her reference was made from')
    ap.add_argument('--piper', default='piper', help='the piper command')
    ap.add_argument('--cache', default=None)
    ap.add_argument('--no-check', action='store_true', help="don't check recordings with Whisper")
    ap.add_argument('--limit', type=int, help='only the first N lines (for trying settings out); writes nothing to public/')
    args = ap.parse_args()

    info = character_lines(args.character)
    texts = info['lines']
    if args.limit:
        texts = dict(list(texts.items())[: args.limit])
    if args.engine == 'chatterbox':
        ref = args.ref or os.path.join(ROOT, 'tools', 'voices', f'{args.character}-ref.wav')
        voice_id = f'chatterbox|{sha(ref)}'
        engine = None  # loaded on first use, so a run that's all cached is quick
    else:
        if not args.model:
            sys.exit('--model is needed for piper')
        voice_id = f'piper|{os.path.basename(args.model)}|{LENGTH_SCALE}|{NOISE_SCALE}'
        engine = Piper(args.model, args.piper)
    fallback = Piper(args.fallback, args.piper) if args.fallback and args.engine == 'chatterbox' else None
    ear = None
    cache = args.cache or tempfile.mkdtemp()
    os.makedirs(cache, exist_ok=True)

    out, clips, unclear = [], {}, []
    sr = None
    cursor = recorded = 0
    for i, (text, situations) in enumerate(texts.items()):
        spoken = SPOKEN.get(text, text)
        exag, cfg = feel_for(situations, args.character) if args.engine == 'chatterbox' else (0, 0)
        key = hashlib.sha1(f'{voice_id}|{exag}|{cfg}|{spoken}'.encode()).hexdigest()[:16]
        path = os.path.join(cache, f'{key}.wav')
        meta_path = os.path.join(cache, f'{key}.json')
        if os.path.exists(path):
            x, sr = sf.read(path, dtype='float32')
            meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
        else:
            if engine is None:
                engine = Chatterbox(ref)
            if ear is None and not args.no_check:
                ear = Ear()
            best = None
            for attempt in range(TRIES):
                x = engine.say(spoken, exag, cfg, seed=attempt)
                # Now and then Chatterbox runs away and babbles on; far too long for the line is a failed take.
                if len(x) / engine.sr > max_seconds(spoken):
                    heard, score = '(ran on)', 0.0
                else:
                    heard = ear.hear(x, engine.sr) if ear else ''
                    score = similarity(text, heard) if ear else 1.0
                if best is None or score > best[0]:
                    best = (score, x, heard)
                if score >= MATCH:
                    break
            score, x, heard = best
            sr = engine.sr
            meta = {'heard': heard, 'score': round(score, 3), 'tries': attempt + 1}
            if heard != '(ran on)':
                sf.write(path, x, sr, subtype='PCM_16')
                json.dump(meta, open(meta_path, 'w'))
            recorded += 1
            print(f'[{i + 1}/{len(texts)}] {score:.2f} x{attempt + 1} e{exag} "{text}" heard "{heard}"', flush=True)
        # Chatterbox made a mess of it: the same voice from Piper, if that's clearer.
        if fallback and meta.get('score', 1) < FALLBACK_BELOW and not meta.get('fallback'):
            import librosa

            if ear is None:
                ear = Ear()
            fx = fallback.say(spoken, 0, 0, 0)
            fx = librosa.resample(fx, orig_sr=fallback.sr, target_sr=sr or 24000).astype(np.float32)
            sr = sr or 24000
            fheard = ear.hear(fx, sr)
            fscore = similarity(text, fheard)
            if fscore > meta.get('score', 0):
                x = fx
                meta = {'heard': fheard, 'score': round(fscore, 3), 'tries': meta.get('tries', 0), 'fallback': 'piper'}
                sf.write(path, x, sr, subtype='PCM_16')
            else:
                meta['fallback'] = 'tried'
            if os.path.exists(path):
                json.dump(meta, open(meta_path, 'w'))
            print(f'[{i + 1}/{len(texts)}] Piper {fscore:.2f} for "{text}" (heard "{fheard}"){", used" if meta.get("fallback") == "piper" else ""}', flush=True)
        if ear is not None or meta.get('heard') is not None:
            heard = meta.get('heard', '')
            babble = len(words(heard)) > 2 * len(words(text)) + 1
            if meta.get('score', 1) < 0.3 or babble:
                # Clearly not the line (often a short shout turned into babble): better unrecorded.
                unclear.append(f'{meta.get("score", 0):.2f}  "{text}"  heard "{heard}"; left out')
                continue
        if meta.get('heard') == '(ran on)' or not os.path.exists(path):
            # Every take ran on and nothing better: leave it unrecorded (the browser's voice covers it).
            unclear.append(f'0.00  "{text}"  every take ran on; not recorded')
            continue
        x, sr = sf.read(path, dtype='float32')
        if meta.get('score', 1) < MATCH:
            unclear.append(f'{meta["score"]:.2f}  "{text}"  heard "{meta["heard"]}"')
        x = tidy(x, sr)
        clips[text] = {'start': round(cursor / sr, 5), 'dur': round(len(x) / sr, 5)}
        out += [x, np.zeros(int(GAP * sr), dtype=np.float32)]
        cursor += len(x) + int(GAP * sr)

    audio = np.clip(np.concatenate(out), -1, 1)
    bank = info['bank']
    base = os.path.join(cache if args.limit else os.path.join(ROOT, 'public', 'audio'), bank)
    sf.write(base + '.mp3', audio, sr, format='MP3', subtype='MPEG_LAYER_III')
    with open(base + '.json', 'w') as f:
        json.dump({'file': f'audio/{bank}.mp3', 'voice': voice_id, 'clips': clips}, f, indent=1)
    with open(os.path.join(cache, f'{args.character}-unclear.txt'), 'w') as f:
        f.write('\n'.join(unclear) + '\n')
    print(f'{len(clips)} lines ({recorded} newly recorded), {len(audio) / sr:.1f} s, peak {np.abs(audio).max():.2f}')
    if unclear:
        print(f'{len(unclear)} lines never quite matched (listed in {cache}/{args.character}-unclear.txt):')
        print('\n'.join(unclear))


if __name__ == '__main__':
    main()
