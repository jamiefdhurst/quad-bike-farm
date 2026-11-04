"""Record the radio's talk: the presenters, weather, farming reports, news, phone-ins and traffic of the two stations in
tools/radio/scripts.json, one small MP3 each, and write public/audio/radio/talk.json (what each is and how long).

Chatterbox copies a reference voice in tools/voices/radio-<voice>-ref.wav (Kokoro's bm_george, bm_lewis and bf_isabella), and Whisper checks
every take against the script, as tools/generate_companion_voice.py does for the girls (which this borrows its engine, ear and tidying
from). Cached, so only new or edited items take time:

  TQDM_DISABLE=1 PYTHONWARNINGS=ignore .scratch/cb/bin/python tools/generate_radio_talk.py --cache .scratch/radio-cache

--bank-only rebuilds the files and talk.json from the cache without recording anything.
"""

import argparse
import hashlib
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import generate_companion_voice as g  # noqa: E402

ROOT = g.ROOT
OUT = os.path.join(ROOT, 'public', 'audio', 'radio')
# How each kind of item is delivered: Chatterbox's exaggeration and cfg weight, by station (a rock presenter is brasher).
FEEL = {
    'dale': {'default': (0.5, 0.5), 'news': (0.35, 0.5), 'phonein': (0.6, 0.45), 'link': (0.55, 0.45), 'ident': (0.6, 0.45)},
    'quarry': {'default': (0.65, 0.4), 'news': (0.4, 0.5), 'competition': (0.8, 0.35), 'ident': (0.85, 0.35), 'link': (0.8, 0.35)},
}
TARGET_RMS = 0.09


def items(scripts):
    for sid, st in scripts['stations'].items():
        for kind, texts in st['talk'].items():
            voice = st['voices']['news'] if kind == 'news' else st['voices']['main']
            for n, text in enumerate(texts):
                yield {'id': f'{sid}-{kind}-{n:02d}', 'station': sid, 'kind': kind, 'voice': voice, 'text': text}


def main():
    import soundfile as sf

    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=os.path.join(ROOT, '.scratch', 'radio-cache'))
    ap.add_argument('--bank-only', action='store_true')
    ap.add_argument('--limit', type=int)
    args = ap.parse_args()
    scripts = json.load(open(os.path.join(HERE, 'radio', 'scripts.json')))
    os.makedirs(args.cache, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    engines, ear = {}, None
    talk, unclear, recorded = [], [], 0
    todo = list(items(scripts))[: args.limit]
    for i, it in enumerate(todo):
        ref = os.path.join(ROOT, 'tools', 'voices', f'radio-{it["voice"]}-ref.wav')
        exag, cfg = FEEL[it['station']].get(it['kind'], FEEL[it['station']]['default'])
        key = hashlib.sha1(f'{g.sha(ref)}|{exag}|{cfg}|{it["text"]}'.encode()).hexdigest()[:16]
        path = os.path.join(args.cache, f'{key}.wav')
        meta_path = os.path.join(args.cache, f'{key}.json')
        if os.path.exists(path):
            x, sr = sf.read(path, dtype='float32')
            meta = json.load(open(meta_path))
        elif args.bank_only:
            unclear.append(f'{it["id"]} not in the cache')
            continue
        else:
            if it['voice'] not in engines:
                engines[it['voice']] = g.Chatterbox(ref)
            ear = ear or g.Ear()
            eng = engines[it['voice']]
            best = None
            for attempt in range(g.TRIES):
                x = eng.say(it['text'], exag, cfg, seed=attempt)
                if len(x) / eng.sr > g.max_seconds(it['text']):
                    score, heard = 0.0, '(ran on)'
                else:
                    heard = ear.hear(x, eng.sr)
                    score = g.similarity(it['text'], heard)
                if best is None or score > best[0]:
                    best = (score, x, heard)
                if score >= g.MATCH:
                    break
            score, x, heard = best
            sr = eng.sr
            meta = {'heard': heard, 'score': round(score, 3), 'tries': attempt + 1}
            if heard != '(ran on)':
                sf.write(path, x, sr, subtype='PCM_16')
                json.dump(meta, open(meta_path, 'w'))
            recorded += 1
            print(f'[{i + 1}/{len(todo)}] {score:.2f} x{attempt + 1} {it["id"]} heard "{heard}"', flush=True)
            if heard == '(ran on)':
                unclear.append(f'{it["id"]} every take ran on')
                continue
        if meta['score'] < 0.5:
            unclear.append(f'{meta["score"]:.2f} {it["id"]} heard "{meta["heard"]}"; left out')
            continue
        if meta['score'] < g.MATCH:
            unclear.append(f'{meta["score"]:.2f} {it["id"]} heard "{meta["heard"]}"')
        x = g.tidy(x, sr)
        x = np.concatenate([x, np.zeros(int(0.15 * sr), dtype=np.float32)])
        sf.write(os.path.join(OUT, it['id'] + '.mp3'), x, sr, format='MP3', subtype='MPEG_LAYER_III')
        talk.append({'id': it['id'], 'station': it['station'], 'kind': it['kind'], 'file': f'audio/radio/{it["id"]}.mp3', 'seconds': round(len(x) / sr, 2)})
    if not args.limit:
        keep = {t['id'] for t in talk}
        for f in os.listdir(OUT):
            if f.endswith('.mp3') and f.split('.')[0] in {it['id'] for it in items(scripts)} and f[:-4] not in keep:
                os.remove(os.path.join(OUT, f))
    json.dump({'talk': talk}, open(os.path.join(OUT, 'talk.json'), 'w'), indent=1)
    print(f'{len(talk)} items ({recorded} newly recorded), {sum(t["seconds"] for t in talk):.0f} s')
    if unclear:
        open(os.path.join(args.cache, 'radio-unclear.txt'), 'w').write('\n'.join(unclear) + '\n')
        print(f'{len(unclear)} not quite right (listed in {args.cache}/radio-unclear.txt):\n' + '\n'.join(unclear))


if __name__ == '__main__':
    main()
