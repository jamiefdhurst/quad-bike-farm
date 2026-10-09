"""Cut engine recordings into single firing pulses for the recorded engine sound.

Reads mono 16-bit WAVs of the source recordings (see ASSETS.md for where they
come from), finds each firing pulse, and writes:

  public/audio/<bank>.wav   the segments that are used, back to back
  public/audio/<bank>.json  where every pulse ("grain") starts and ends, its
                            pulse rate, and what kind it is

There are four banks: engine-bank (four-stroke quads), engine-bank-2t
(two-stroke), engine-bank-50 (the kids' 50cc) and engine-bank-tractor (the diesel tractor). A grain's "rpm" is 120 / pulse period whatever the engine type,
which is the rpm a four-stroke would be doing; the runtime picks grains by the
same measure, so two-strokes match up without special cases.

At runtime each pulse from the engine model plays one recorded pulse
(src/audio/engineWorklet.js), so the lumpiness, misfires and starter rhythm
of the engine model come through with real recorded sound.

Usage (needs numpy, and matplotlib for --plot):

  afconvert -f WAVE -d LEI16@44100 -c 1 379915.mp3 quad.wav     # or ffmpeg
  afconvert -f WAVE -d LEI16@44100 -c 1 419091.mp3 rev.wav
  afconvert ... 419088.mp3 atv.wav;  afconvert ... 637151.mp3 quarry.wav
  afconvert ... 361407.mp3 crf.wav
  python3 tools/slice_engine_audio.py engine-bank quad=quad.wav rev=rev.wav atv=atv.wav quarry=quarry.wav crf=crf.wav [--plot out.png]

  afconvert ... 450034.mp3 mx.wav;  afconvert ... 148868.mp3 crm.wav
  afconvert ... 675214.mp3 db.wav
  python3 tools/slice_engine_audio.py engine-bank-2t mx=mx.wav crm=crm.wav db=db.wav quad=quad.wav

  afconvert ... 140384.mp3 gil.wav
  python3 tools/slice_engine_audio.py engine-bank-50 gil=gil.wav quad=quad.wav

  afconvert ... 637890.mp3 t0.wav;  afconvert ... 637891.mp3 t1.wav
  python3 tools/slice_engine_audio.py engine-bank-tractor t0=t0.wav t1=t1.wav
  python3 tools/slice_engine_audio.py engine-bank-tractor-eq t0=t0.wav t1=t1.wav

  afconvert ... 510231.mp3 ten.wav;  afconvert ... 450136.mp3 honda.wav
  python3 tools/slice_engine_audio.py engine-bank-green ten=ten.wav honda=honda.wav quad=quad.wav
"""

import argparse
import json
import os
import wave

import numpy as np

SR = 44100
# Every bank is scaled so its idle pulses sit at this loudness, so quads using
# different banks are equally loud at idle.
TARGET_IDLE_RMS = 0.2
ENV_RATE = 4000  # envelope sample rate, Hz
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Which parts of which recording each bank uses. Times in seconds.
#   segments: (kind, source, start, end, (shortest, longest pulse period in s))
#   oneshots: (name, source, start, end)
#   level: (kind, other kind) whose median loudness is matched, so the second
#          machine sits at the same level as the first where they meet.
BANKS = {
    'engine-bank': {
        # Idle from the quad (red) or the ATV rev recording (blue). Revs come from two
        # recordings of real quads being ridden, so they carry the sound of an engine
        # working through a CVT: the same ATV as the blue idle driving away, and a
        # second ATV riding round a quarry. Both run about 2,500 to 5,500 rpm under
        # load, which is where a utility quad lives.
        'segments': [
            ('idle', 'quad', 1.60, 7.30, (0.06, 0.12)),
            ('idle', 'quad', 8.80, 12.0, (0.06, 0.12)),
            ('idle', 'quad', 17.0, 19.9, (0.06, 0.12)),
            ('idle2', 'rev', 0.10, 1.95, (0.06, 0.09)),  # the ATV rev recording's idle (blue quad)
            ('accel', 'atv', 0.3, 4.0, (0.034, 0.05)),
            ('accel', 'atv', 4.0, 8.1, (0.024, 0.034)),
            ('decel', 'atv', 8.2, 10.9, (0.025, 0.04)),
            ('accel', 'quarry', 14.4, 17.3, (0.021, 0.037)),
            ('accel', 'quarry', 19.2, 23.2, (0.023, 0.028)),
            ('accel', 'quarry', 41.7, 43.8, (0.028, 0.042)),
            ('accel', 'quarry', 55.2, 57.8, (0.023, 0.036)),
            ('accel', 'quarry', 83.0, 87.5, (0.023, 0.031)),
            ('accel', 'quarry', 101.7, 104.0, (0.022, 0.028)),  # starts once it's back in earshot
            ('accel', 'quarry', 112.9, 114.9, (0.034, 0.054)),
            ('accel', 'quarry', 116.1, 117.9, (0.025, 0.031)),
            ('decel', 'quarry', 76.4, 79.5, (0.024, 0.042)),
            ('decel', 'quarry', 104.0, 108.3, (0.025, 0.04)),
            # A third idle, for the green quad: a Honda CRF250 four-stroke single ticking over.
            ('idle3', 'crf', 4.0, 16.2, (0.045, 0.07)),
        ],
        'oneshots': [
            # The starter's own chug isn't regular enough to cut per compression stroke, so
            # cranking is an engage sound followed by a loop between two quiet points.
            ('starterEngage', 'quad', 0.08, 0.365),
            ('crankLoop', 'quad', 0.365, 1.329),
            ('shutdown', 'quad', 20.22, 21.2),  # the run-down once the ignition is cut
        ],
        # (base kind, other kind, other source): the other source is scaled so its
        # idle matches the base idle's loudness.
        'level': [('idle', 'idle2', 'rev'), ('idle', 'idle3', 'crf')],
        # Both ATVs move about in front of the microphone, so their loudness follows
        # distance more than the engine. Flatten that out and give them a level that
        # rises with rpm instead, about as steeply as a close recording does.
        'flatten': {'sources': ('atv', 'quarry'), 'rms3000': 0.3, 'slope': 1.2, 'headroom': 4},
        # Reject pulses longer or shorter than the segment's period limits allow: the
        # quarry recording is noisy enough for the tracker to slip now and then.
        'periodCheck': True,
    },
    'engine-bank-2t': {
        # Idle from a two-stroke motocross bike (its later idle skips beats, so only
        # the steady stretches are used). Revs from a Honda CRM250 pulling away and
        # backing off, and a second two-stroke dirt bike for the top end (up to about
        # 9,000 rpm). Period limits are tight per section so the tracker can't lock
        # onto double or half the firing rate. Starter and shutdown borrow the quad
        # recordings: the game has an electric start.
        'segments': [
            ('idle', 'mx', 24.0, 30.3, (0.022, 0.045)),
            ('idle', 'mx', 32.0, 40.5, (0.022, 0.045)),
            ('idle2', 'crm', 0.1, 1.9, (0.02, 0.045)),
            ('accel', 'crm', 5.5, 9.0, (0.0105, 0.021)),
            ('accel', 'crm', 9.5, 10.6, (0.0105, 0.0135)),
            ('decel', 'crm', 12.7, 14.0, (0.0095, 0.0135)),
            ('decel', 'crm', 14.5, 16.5, (0.0105, 0.018)),
            ('accel', 'db', 2.7, 4.6, (0.011, 0.023)),
            ('accel', 'db', 6.8, 9.6, (0.0085, 0.013)),
            ('accel', 'db', 9.8, 11.0, (0.0062, 0.009)),
            ('accel', 'db', 15.9, 17.2, (0.0068, 0.0085)),
            ('accel', 'db', 19.0, 21.0, (0.0075, 0.0095)),
            ('decel', 'db', 21.5, 25.5, (0.0075, 0.0115)),
        ],
        'oneshots': [
            ('starterEngage', 'quad', 0.08, 0.365),
            ('crankLoop', 'quad', 0.365, 1.329),
            ('shutdown', 'quad', 20.22, 21.2),
        ],
        # The second dirt bike has no idle, so its revs are matched to the CRM250's revs.
        'level': [('idle', 'idle2', 'crm'), ('accel', 'accel', 'db', 'crm')],
        # Riding recordings are noisy: be more forgiving cutting rev pulses.
        'revTail': 0.75,
        'revOdd': 0.3,
    },
    'engine-bank-tractor': {
        # The old tractor: kyles's throaty, rattly diesel (Freesound 637890 and 637891), recorded close beside it. The idle is
        # 637891's steady running after its revs (about 1,000 rpm by the pulse-rate measure, with one beat in each cycle
        # stronger). 637890's longer idle has a drone at 256 to 310 Hz that sounded like a heavy noise over the tractor; it is
        # engine-bank-tractor-eq below, EQ'd to sound like this one. The revs are 637890's pulled-away stretches (lower and
        # lumpier; the pulse sound doesn't play them). Starter and shutdown come from the same two recordings.
        'segments': [
            ('idle', 't1', 6.0, 11.0, (0.09, 0.14)),
            ('accel', 't0', 34.0, 44.0, (0.12, 0.24)),
            ('accel', 't0', 46.0, 60.5, (0.12, 0.24)),
            ('decel', 't0', 34.0, 44.0, (0.12, 0.24)),
        ],
        'oneshots': [
            ('starterEngage', 't1', 1.1, 1.4),
            ('crankLoop', 't1', 1.4, 2.9),
            ('shutdown', 't0', 61.4, 63.6),
        ],
        'level': [('idle', 'accel', 't0')],
        # A four-cylinder: four beats in each cycle, one of them stronger. Cut the idle into whole cycles that all start on that
        # strong beat, so every grain is the same shape and length, and let playback read them in recording order.
        'idleCycles': True,
        'idleOdd': 0.06,
        'revTail': 0.9,
        'revOdd': 0.3,
        # The level 637891 played at when it shared the idle with 637890: Jamie picked it at that level, quieter than 637890's.
        'fixedGain': {'t1': 1.042},
    },
    'engine-bank-tractor-eq': {
        # Another old tractor, for later: 637890's 15 s of steady running, EQ'd to 637891's tonal balance (its drone at 256 to
        # 310 Hz down 12 dB, 80 to 120 Hz up 6 to 8). Longer than engine-bank-tractor's idle, so it doesn't loop, but it keeps
        # 637890's rattle. Same sources, revs, starter and shutdown as engine-bank-tractor.
        'segments': [
            ('idle', 't0', 14.8, 30.6, (0.09, 0.16)),
            ('accel', 't0', 34.0, 44.0, (0.12, 0.24)),
            ('accel', 't0', 46.0, 60.5, (0.12, 0.24)),
            ('decel', 't0', 34.0, 44.0, (0.12, 0.24)),
        ],
        'oneshots': [
            ('starterEngage', 't1', 1.1, 1.4),
            ('crankLoop', 't1', 1.4, 2.9),
            ('shutdown', 't0', 61.4, 63.6),
        ],
        'level': [('idle', 'accel', 't0')],
        'eqMatch': {'source': 't0', 'span': (14.8, 30.6), 'like': ('t1', 6.0, 11.0)},
        'idleCycles': True,
        'idleOdd': 0.06,
        'revTail': 0.9,
        'revOdd': 0.3,
        'fixedGain': {'t1': 1.042},
    },
    'engine-bank-50': {
        # The kids' 50cc quad: a Gilera Runner SP50 scooter two-stroke, recorded an inch
        # from its exhaust. Its cold idle on the automatic choke and its warm idle at the
        # end are the idle; the rev blips and the long held high rev are the revs. Starter
        # and shutdown borrow the quad recordings, as the other two-stroke bank does.
        'segments': [
            ('idle', 'gil', 3.2, 9.6, (0.04, 0.07)),
            ('idle', 'gil', 53.6, 57.6, (0.06, 0.1)),
            ('accel', 'gil', 10.0, 14.0, (0.007, 0.02)),
            ('accel', 'gil', 16.0, 20.0, (0.007, 0.02)),
            ('accel', 'gil', 20.0, 26.0, (0.007, 0.016)),
            ('decel', 'gil', 30.0, 35.0, (0.007, 0.02)),
            ('accel', 'gil', 40.5, 52.5, (0.007, 0.012)),
        ],
        'oneshots': [
            ('starterEngage', 'quad', 0.08, 0.365),
            ('crankLoop', 'quad', 0.365, 1.329),
            ('shutdown', 'quad', 20.22, 21.2),
        ],
        'level': [('idle', 'accel', 'gil')],
        # It fires every other turn at idle, so the beats alternate strong and weak.
        'idleTail': 1.2,
        'idleOdd': 0.4,
        'revTail': 0.75,
        'revOdd': 0.3,
    },
    'engine-bank-moto': {
        # The mini moto: a Derbi GPR 50 two-stroke with a race kit (ahnoj, Freesound 127592), close by as it's ridden off and
        # back. Its idle is the purr between blips once it's back (the engine is off from about 54.5 s). At idle it bangs every
        # other turn, a burst every 63 ms (about 1,900 rpm), so each burst is cut as a whole cycle and split in two
        # (cycleSplit), one slice per turn, read back in order. Revs from the blips and riding off. Starter and shutdown
        # borrow the quad recordings.
        'segments': [
            ('idle', 'der', 32.5, 35.0, (0.055, 0.075)),
            ('idle', 'der', 41.0, 44.0, (0.055, 0.075)),
            ('idle', 'der', 51.0, 54.0, (0.055, 0.075)),
            ('accel', 'der', 17.5, 20.5, (0.01, 0.02)),
            ('accel', 'der', 28.0, 30.5, (0.01, 0.02)),
            ('accel', 'der', 44.0, 47.0, (0.01, 0.02)),
            ('accel', 'der', 48.5, 50.5, (0.01, 0.02)),
            ('decel', 'der', 20.5, 22.5, (0.01, 0.025)),
        ],
        'oneshots': [
            ('starterEngage', 'quad', 0.08, 0.365),
            ('crankLoop', 'quad', 0.365, 1.329),
            ('shutdown', 'quad', 20.22, 21.2),
        ],
        'level': [('idle', 'idle', 'der')],
        'fixedGain': {'quad': 4.851},  # as in engine-bank-50, which the mini moto used before
        'idleCycles': True,
        'cycleSplit': 2,
        'revTail': 0.75,
        'revOdd': 0.3,
    },
    'engine-bank-atc': {
        # The ATC: a Piaggio Ape idling in a Bangalore street (nikitralala, Freesound 239927). It lumps along with a strong
        # beat every 110 to 116 ms, buried in street noise, so like the moto it's cut into whole lumps split in three. Revs
        # come from a Yamaha DT 125 two-stroke (kristian321, 175964) and an old Vespa PX 200 with a rusted exhaust ridden
        # onboard (druki, 158891). Starter and shutdown borrow the quad recordings.
        'segments': [
            ('idle', 'ape', 2.0, 28.0, (0.1, 0.13)),
            ('idle', 'ape', 30.0, 50.0, (0.1, 0.13)),
            ('accel', 'dt', 15.0, 18.5, (0.01, 0.03)),
            ('accel', 'ves', 48.0, 60.0, (0.012, 0.04)),
            ('decel', 'dt', 18.0, 20.0, (0.01, 0.035)),
        ],
        'oneshots': [
            ('starterEngage', 'quad', 0.08, 0.365),
            ('crankLoop', 'quad', 0.365, 1.329),
            ('shutdown', 'quad', 20.22, 21.2),
        ],
        'level': [('idle', 'idle', 'ape'), ('idle', 'accel', 'dt'), ('accel', 'accel', 'ves', 'dt')],
        'fixedGain': {'quad': 6.283},  # as in engine-bank-2t, which the ATC used before
        'idleCycles': True,
        'cycleSplit': 3,
        'revTail': 0.75,
        'revOdd': 0.3,
    },
    'engine-bank-green': {
        # The green: a Yamaha Ténéré 250 four-stroke single idling, studio-close (Singular_Estudio, Freesound 510231), about
        # 1,750 rpm. Revs from kyles's Honda ATV pulling away (450136), about 2,400 to 7,000 rpm, which the pulse sound blends
        # into as the revs rise (pulseRevLo / pulseRevHi). Starter and shutdown borrow the quad recording.
        'segments': [
            ('idle', 'ten', 1.0, 15.0, (0.055, 0.085)),
            ('idle', 'ten', 42.0, 52.0, (0.055, 0.085)),
            ('accel', 'honda', 10.0, 14.0, (0.028, 0.06)),
            ('accel', 'honda', 14.0, 21.0, (0.025, 0.036)),
            ('accel', 'honda', 21.0, 30.0, (0.019, 0.03)),
        ],
        'oneshots': [
            ('starterEngage', 'quad', 0.08, 0.365),
            ('crankLoop', 'quad', 0.365, 1.329),
            ('shutdown', 'quad', 20.22, 21.2),
        ],
        'level': [('idle', 'idle', 'ten'), ('idle', 'accel', 'honda')],
        'fixedGain': {'quad': 1.014},  # as in engine-bank, which the green used before
        'periodCheck': True,
        'revTrack': True,  # its revs are cut along their smoothed rise (follow_track), so the tail check can go
        'revTail': None,
        'revOdd': 0.3,
    },
    'engine-bank-yellow': {
        # The yellow: a Yamaha DT 125 two-stroke (kristian321, Freesound 175964) idling at about 1,900 rpm (4 to 6.3 s) and
        # holding a high idle near 3,300 (6.5 to 14.5 s; its blip after that is left out). Both are idle grains at their own
        # speed, so the pulse sound plays whichever is nearest the revs. Revs from a Honda CR85 ridden flat out onboard
        # (Olympia_94, 704792), about 5,000 to 12,000 rpm, blended in as the revs rise (pulseRevLo / pulseRevHi).
        'segments': [
            ('idle', 'dt', 4.0, 6.3, (0.025, 0.04)),
            ('idle', 'dt', 6.5, 14.5, (0.013, 0.022)),
            ('accel', 'cr', 13.0, 28.0, (0.0055, 0.016)),
            ('accel', 'cr', 31.0, 40.0, (0.0045, 0.0075)),
            ('accel', 'cr', 50.0, 58.0, (0.0045, 0.0075)),
            ('decel', 'cr', 60.0, 70.0, (0.0055, 0.014)),
        ],
        'oneshots': [
            ('starterEngage', 'quad', 0.08, 0.365),
            ('crankLoop', 'quad', 0.365, 1.329),
            ('shutdown', 'quad', 20.22, 21.2),
        ],
        'level': [('idle', 'idle', 'dt'), ('idle', 'accel', 'cr')],
        'fixedGain': {'quad': 6.283},  # as in engine-bank-2t, which the yellow used before
        'periodCheck': True,
        # The DT 125 is recorded in a courtyard and its firings are blurred: be more forgiving cutting its idle.
        'idleTail': 1.0,
        'idleOdd': 0.4,
        'revTail': 0.75,
        'revOdd': 0.3,
    },
    'engine-bank-landy': {
        # The Land Rover: craigsmith's old Jeep rumbling at idle (Freesound 438105), beating every 61 ms. Only its steadiest three
        # seconds (15.4 to 18.4 s): elsewhere the beat and the level wander, and from 21 s it speeds up and dips. There the beats
        # fall in groups of three, so it's cut into those and each split into its beats, read in order. Its pull-away for the
        # recorded sound's revs. The starter is an old Ford stake bed truck's (D.jones, 521857): a heavy, uneven crank about
        # five compressions a second, the Series' slow 170 rpm; the starting handle's clunk is craigsmith's old car cranked by
        # hand (438033), one swing; the shutdown is the Jeep stopping.
        'segments': [
            ('idle', 'jeep', 15.4, 18.4, (0.17, 0.2)),
            ('accel', 'jeep', 29.0, 45.0, (0.12, 0.16)),
            ('decel', 'jeep', 37.0, 45.0, (0.12, 0.16)),
        ],
        'oneshots': [
            ('starterEngage', 'ford', 0.05, 0.444),
            ('crankLoop', 'ford', 1.247, 2.388, {'crankRpm': 170}),
            ('handCrank', 'crank', 31.95, 32.45),
            ('shutdown', 'jeep', 55.2, 57.0),
        ],
        'level': [('idle', 'idle', 'jeep'), ('idle', 'accel', 'jeep')],
        'oneshotLevel': {'ford': (4.5, 9.0)},  # the starter as loud against the Jeep's idle as against the truck's own
        'idleCycles': True,
        'cycleSplit': 3,  # one slice per beat, each played for one of the engine's firings
        'revTail': 0.9,
        'revOdd': 0.3,
    },
    'engine-bank-utv': {
        # The UTV: a John Deere Gator idling, recorded on the vehicle (videog, Freesound 149193). A small three-cylinder
        # diesel at about 970 rpm with one sharp beat per cycle, so it's cut into whole cycles like the tractor. Revs from a
        # small Bobcat loader's diesel working (cognito perceptu, 174237). The shutdown borrows the tractor's. Two starters:
        # the UTV's is a small tractor's quick diesel crank (radwoc, 256808), two compressions a loop at about 7 a second, a
        # three-cylinder at the UTV's 260 rpm; the 200TDi's ('Tdi', recStarterSet) a Citroen Jumpy van's four-cylinder diesel
        # (chlund, 500193), three compressions a loop at about 7.5 a second, a four at 230 rpm. Loops are cut in the quiet
        # between compressions.
        'segments': [
            ('idle', 'gat', 0.2, 14.2, (0.11, 0.14)),
            ('accel', 'bob', 168.0, 184.0, (0.04, 0.07)),
            ('decel', 'bob', 176.0, 184.0, (0.04, 0.07)),
        ],
        'oneshots': [
            ('starterEngage', 'rad', 0.14, 0.415),
            ('crankLoop', 'rad', 0.415, 0.614, {'crankRpm': 260}),
            ('starterEngageTdi', 'jumpy', 1.0, 1.273),
            ('crankLoopTdi', 'jumpy', 1.273, 1.716, {'crankRpm': 230}),
            ('shutdown', 't0', 61.4, 63.6),
        ],
        'level': [('idle', 'idle', 'gat'), ('idle', 'accel', 'bob')],
        'fixedGain': {'t0': 1.503},  # as in engine-bank-tractor, which the UTV used before
        # Each starter as loud, against the bank's idle, as it is against its own engine's idle in its recording.
        'oneshotLevel': {'rad': (2.0, 7.0), 'jumpy': (3.0, 10.0)},
        'idleCycles': True,
        'revTail': 0.9,
        'revOdd': 0.3,
    },
}


def load(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, path
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def envelope(x, smooth):
    k = max(1, int(SR * smooth))
    e = np.convolve(np.abs(x), np.ones(k) / k, mode='same')
    return e[:: SR // ENV_RATE]


def local_period(env, t, lo, hi, win):
    """Autocorrelation estimate of the pulse period around env index t."""
    a = max(0, t - win // 2)
    seg = env[a : a + win] - env[a : a + win].mean()
    ac = np.correlate(seg, seg, 'full')[len(seg) - 1 :]
    lo_i, hi_i = int(lo * ENV_RATE), min(int(hi * ENV_RATE), len(ac) - 1)
    return (lo_i + int(np.argmax(ac[lo_i:hi_i]))) / ENV_RATE


def find_peaks(env, lo, hi):
    """Follows the pulse train: each peak is the loudest point about one period after the last."""
    win = int(max(0.3, hi * 4) * ENV_RATE)
    p = local_period(env, win // 2, lo, hi, win)
    first = int(np.argmax(env[: int(p * ENV_RATE) + 1]))
    peaks = [first]
    while True:
        p = local_period(env, peaks[-1], lo, hi, win)
        a = peaks[-1] + int(0.72 * p * ENV_RATE)
        b = peaks[-1] + int(1.28 * p * ENV_RATE)
        if b >= len(env):
            break
        peaks.append(a + int(np.argmax(env[a:b])))
    return np.array(peaks) / ENV_RATE


def follow_track(env, peaks, passes=2):
    """Re-places peaks along the smoothed period of the rev rise. find_peaks searches a wide window, so in a busy stretch it
    sometimes lands on an echo: one firing short and the next long by as much, which no engine does. Here each peak is the
    loudest point within 12% of the median of the nine periods around it."""
    for _ in range(passes):
        d = np.diff(peaks)
        track = np.array([np.median(d[max(0, i - 4) : i + 5]) for i in range(len(d))])
        placed = [peaks[0]]
        for i, p in enumerate(track):
            a = int((placed[-1] + 0.88 * p) * ENV_RATE)
            b = int((placed[-1] + 1.12 * p) * ENV_RATE) + 1
            if b >= len(env):
                break
            placed.append((a + int(np.argmax(env[a:b]))) / ENV_RATE)
        peaks = np.array(placed)
    return peaks


def steady_cuts(x, peaks, cuts):
    """Cuts at a steady distance before each followed peak: the median of how far cut_points put the nine cuts around it,
    snapped to the nearest rising zero crossing. In a busy rev stretch cut_points' quietest spot jumps about within the gap,
    which would give firings of uneven lengths from an even rhythm."""
    lead = np.array([int(p * SR) for p in peaks]) - np.array(cuts)
    out = []
    for i, p in enumerate(peaks):
        q = min(len(x) - 1, max(0, int(p * SR) - int(np.median(lead[max(0, i - 4) : i + 5]))))
        lo, hi = max(1, q - int(0.0008 * SR)), min(len(x) - 1, q + int(0.0008 * SR))
        zc = [k for k in range(lo, hi) if x[k - 1] <= 0 < x[k]]
        out.append(min(zc, key=lambda k: abs(k - q)) if zc else q)
    return out


def cut_points(x, peaks, smooth_env):
    """Where to cut before each thump: find where its attack starts, then take the
    quietest zero crossing just ahead of that, so a grain never carries the start
    of the next thump and never begins partway into its own."""
    cuts = []
    for i, p in enumerate(peaks):
        pi = min(int(p * SR), len(x) - 1)
        prev = int(peaks[i - 1] * SR) if i > 0 else max(0, pi - int(0.1 * SR))
        period = pi - prev
        # Attack start: walk back from the peak until the envelope drops near the local floor.
        floor_lo = prev + int(0.3 * period)
        floor = smooth_env[floor_lo:pi].min() if pi > floor_lo else 0
        level = floor + 0.2 * (smooth_env[pi] - floor)
        j = pi
        while j > floor_lo and smooth_env[j] > level:
            j -= 1
        # Quietest spot in the stretch just before the attack, snapped to a zero crossing.
        a = max(floor_lo, j - int(0.25 * period))
        q = a + int(np.argmin(smooth_env[a : j + 1])) if j > a else j
        lo, hi = max(1, q - int(0.0015 * SR)), min(len(x) - 1, q + int(0.0015 * SR))
        zc = [k for k in range(lo, hi) if x[k - 1] <= 0 < x[k]]
        cuts.append(min(zc, key=lambda k: abs(k - q)) if zc else q)
    return cuts


def whole_cycle_cuts(x, lo, hi):
    """Cuts a steady multi-cylinder engine into whole cycles that all start just before the same cylinder's beat. Following
    single beats (find_peaks) lands on whichever cylinder is loudest nearby, so cuts drift by a beat either way and grains come
    out three, four or five beats long. Here the cycle's average shape is the template, and each cut is placed where the next
    cycle best matches it, about one period on from the last."""
    step = SR // ENV_RATE
    rate = SR / step
    e = envelope(x, 0.004)
    e = e - e.mean()
    ac = np.correlate(e, e, 'full')[len(e) - 1 :]
    lo_i, hi_i = int(lo * rate), int(hi * rate)
    n = lo_i + int(np.argmax(ac[lo_i:hi_i]))  # the cycle, in envelope samples
    # Average cycle on a fixed grid, then shift the grid to cut 6 ms ahead of its strongest beat.
    template = np.mean([e[s : s + n] for s in range(0, len(e) - n, n)], axis=0)
    first = (int(np.argmax(template)) - int(0.006 * rate)) % n
    w = max(2, n // 16)  # how far each cut may move from one period on
    starts = list(range(first, len(e) - n, n))
    for _ in range(2):
        template = np.mean([e[s : s + n] for s in starts], axis=0)
        starts = [starts[0]]
        while starts[-1] + n + w + n < len(e):
            guess = starts[-1] + n
            starts.append(max(range(guess - w, guess + w + 1), key=lambda s: float(np.dot(e[s : s + n], template))))
    # The cuts now agree with each other; move them all so they sit just ahead of the aligned cycle's strongest beat.
    template = np.mean([e[s : s + n] for s in starts], axis=0)
    shift = int(np.argmax(template)) - int(0.006 * rate)
    starts = [s + shift for s in starts if s + shift >= 0 and s + shift + n < len(e)]
    # Back to audio samples, each snapped to the nearest rising zero crossing.
    cuts = []
    for s in starts:
        q = s * step
        zc = [k for k in range(max(1, q - int(0.0015 * SR)), min(len(x) - 1, q + int(0.0015 * SR))) if x[k - 1] <= 0 < x[k]]
        cuts.append(min(zc, key=lambda k: abs(k - q)) if zc else q)
    return cuts


def split_cycles(x, cuts, n):
    """Cuts each whole cycle into n equal grains, each start snapped to the nearest rising zero crossing. For a two-stroke whose
    idle lumps along with a strong beat every few firings (four-stroking): the lump is easy to find in a noisy recording where
    the single firings aren't, and read back in order (readThrough), its slices keep the lumpy pattern at the engine's own
    firing rate instead of each firing playing only the start of a lump."""
    out = []
    for a, b in zip(cuts[:-1], cuts[1:]):
        for k in range(n):
            q = a + round(k * (b - a) / n)
            zc = [j for j in range(max(1, q - int(0.0015 * SR)), min(len(x) - 1, q + int(0.0015 * SR))) if x[j - 1] <= 0 < x[j]]
            out.append(min(zc, key=lambda j: abs(j - q)) if zc and k else q)
    out.append(cuts[-1])
    return out


def flatten(x, cuts, rms3000, slope, headroom):
    """Takes distance out of a recording of a machine moving about: rescales it so each
    pulse's loudness follows its rpm, (rpm / 3000) ** slope times rms3000, instead of
    how near the microphone it was. The gain is smoothed over about 0.3 s, so the
    pulse-to-pulse variation stays. Written at 1 / headroom of the final level so the
    file doesn't clip; the source gain puts it back."""
    centres = np.array([(a + b) / 2 for a, b in zip(cuts[:-1], cuts[1:])])
    rpm = 120 / (np.diff(cuts) / SR)
    w = int(0.3 * SR)
    loudness = np.sqrt(np.convolve(x**2, np.ones(w) / w, mode='same')) + 1e-6
    gains = []
    for c in centres:
        near = np.abs(centres - c) <= 0.15 * SR
        target = rms3000 / headroom * (np.median(rpm[near]) / 3000) ** slope
        gains.append(target / loudness[int(c)])
    # Don't let a quiet stretch (the machine out of earshot) be boosted into a roar.
    gains = np.minimum(gains, 3 * np.median(gains))
    return x * np.interp(np.arange(len(x)), centres, gains).astype(np.float32)


def eq_match(x, span, ref, max_db=12):
    """EQs a whole recording so its stretch `span` has the long-term tonal balance of `ref` (another recording's stretch):
    third-octave smoothed spectra, their ratio as a fixed filter, within max_db either way, flat outside 30 Hz to 8 kHz and at
    the same overall level, with peaks kept below full scale."""
    n = 8192
    f = np.fft.rfftfreq(n, 1 / SR)

    def third_octave(y):
        p = np.mean([np.abs(np.fft.rfft(y[i : i + n] * np.hanning(n))) ** 2 for i in range(0, len(y) - n, n // 2)], 0)
        out = p.copy()
        for i, fi in enumerate(f[1:], 1):
            out[i] = p[(f >= fi / 2 ** (1 / 6)) & (f <= fi * 2 ** (1 / 6))].mean()
        return out

    pa = third_octave(x[int(span[0] * SR) : int(span[1] * SR)])
    pb = third_octave(ref)
    ratio = np.sqrt(pb / pa)
    ratio /= np.sqrt((ratio**2 * pa).sum() / pa.sum())
    db = np.clip(20 * np.log10(ratio), -max_db, max_db)
    db[f < 30] = db[np.searchsorted(f, 30)]
    db[f > 8000] = db[np.searchsorted(f, 8000)]
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    gain = 10 ** (np.interp(np.fft.rfftfreq(size, 1 / SR), f, db) / 20)
    y = np.fft.irfft(np.fft.rfft(x, size) * gain, size)[: len(x)]
    # A boosted band can push peaks over full scale; keep it below, and the source gain puts the level back.
    return (y * min(1, 0.95 / np.abs(y).max())).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('bank', choices=sorted(BANKS))
    ap.add_argument('sources', nargs='+', help='name=path.wav for each source the bank uses')
    ap.add_argument('--plot')
    args = ap.parse_args()
    config = BANKS[args.bank]
    sources = {}
    for item in args.sources:
        name, path = item.split('=', 1)
        sources[name] = load(path)
    if 'eqMatch' in config:
        eq = config['eqMatch']
        ref_src, r0, r1 = eq['like']
        sources[eq['source']] = eq_match(sources[eq['source']], eq['span'], sources[ref_src][int(r0 * SR) : int(r1 * SR)])

    out = []  # concatenated audio
    cursor = 0
    grains = []
    oneshots = {}
    plot_data = []
    rejected = {}

    def append(x):
        nonlocal cursor
        start = cursor
        out.append(x)
        cursor += len(x)
        return start

    for kind, src, t0, t1, (lo, hi) in config['segments']:
        x = sources[src][int(t0 * SR) : int(t1 * SR)]
        k = int(SR * 0.0008)
        fine_env = np.convolve(np.abs(x), np.ones(k) / k, mode='same')
        whole = kind == 'idle' and config.get('idleCycles')
        if whole:
            cuts = whole_cycle_cuts(x, lo, hi)
            if config.get('cycleSplit', 1) > 1:
                cuts = split_cycles(x, cuts, config['cycleSplit'])
        else:
            env = envelope(x, 0.0012)
            peaks = find_peaks(env, lo, hi)
            tracked = config.get('revTrack') and kind in ('accel', 'decel')
            if tracked:
                peaks = follow_track(env, peaks)
            cuts = cut_points(x, peaks, fine_env)
            if tracked:
                cuts = steady_cuts(x, peaks, cuts)
        flat = config.get('flatten')
        if flat and src in flat['sources']:
            x = flatten(x, cuts, flat['rms3000'], flat['slope'], flat['headroom'])
            fine_env = np.convolve(np.abs(x), np.ones(k) / k, mode='same')
        base = append(x)
        durs = np.diff(cuts) / SR
        for i in range(len(cuts) - 1):
            s, e = cuts[i], cuts[i + 1]
            if e <= s:
                continue  # a noisy stretch can give two cuts at one point: there's no pulse between them
            dur = (e - s) / SR
            # Overlap into the quiet stretch before the next thump, for crossfading at playback.
            tail = int(min(0.003, 0.12 * dur) * SR)
            seg_env = fine_env[s:e]
            n = len(seg_env)
            reason = None
            med = np.median(durs[max(0, i - 3) : i + 4])
            rev = kind in ('accel', 'decel')
            odd_limit = config.get('revOdd', 0.2) if rev else config.get('idleOdd', 0.2)
            tail_limit = config.get('revTail', 0.5) if rev else config.get('idleTail', 0.5)
            if config.get('periodCheck') and not 0.85 * lo <= dur <= 1.15 * hi:
                reason = 'out of range'  # the tracker slipped: no real pulse is this long or short here
            elif abs(dur - med) / med > odd_limit:
                reason = 'odd length'
            elif not whole and tail_limit and seg_env[int(n * 0.8) :].max() > tail_limit * seg_env[: int(n * 0.4)].max():
                # (A whole cycle has its other cylinders' beats in it, so this check doesn't apply. Nor does it where revTail is
                # None: a single at high revs never goes quiet before its next firing, and followed peaks can't carry it.)
                reason = 'next thump in tail'
            if reason:
                rejected[reason] = rejected.get(reason, 0) + 1
            seg = x[s:e]
            # Pulses that fail the checks stay in the chain, so playback can read
            # straight through them, but never start a grain ('ok': False).
            grain = {
                'kind': kind,
                'start': (base + s) / SR,
                'dur': round(dur, 5),
                'tail': round(min(tail, len(x) - e) / SR, 5),
                'rpm': round(120 / dur, 1),
                'src': src,
                'rms': round(float(np.sqrt(np.mean(seg**2))), 5),
            }
            if reason:
                grain['ok'] = False
            if whole and config.get('cycleSplit', 1) > 1:
                grain['slice'] = i % config['cycleSplit']  # 0 is the slice with the bang in it
            grains.append(grain)
        plot_data.append((kind, src, t0, x, np.array(cuts) / SR))

    for name, src, t0, t1, *extra in config['oneshots']:
        x = sources[src][int(t0 * SR) : int(t1 * SR)].copy()
        if name == 'shutdown':
            fade = int(0.05 * SR)
            x[-fade:] *= np.linspace(1, 0, fade)
        oneshots[name] = {'start': append(x) / SR, 'dur': round(len(x) / SR, 5), **(extra[0] if extra else {})}
        # crankRpm on a crank loop: the cranking speed it plays at its recorded pace (the vehicle's own, on a good battery).
        lvl = config.get('oneshotLevel', {}).get(src)
        if lvl:
            # Its own engine's idle, from the same recording, set to the bank's idle level: the starter keeps its loudness against it.
            own = sources[src][int(lvl[0] * SR) : int(lvl[1] * SR)]
            oneshots[name]['gain'] = round(TARGET_IDLE_RMS / float(np.sqrt(np.mean(own**2))), 3)

    audio = np.concatenate(out)
    # Level-match the two machines where they meet: the rev recording's idle against the quad's idle.
    def median_rms(k, src=None):
        return float(np.median([g['rms'] for g in grains if g['kind'] == k and g.get('ok', True) and (src is None or g['src'] == src)]))

    levels = config['level']
    norm = TARGET_IDLE_RMS / median_rms(levels[0][0])
    source_gain = {name: norm for name in sources}
    # (base kind, other kind, other source[, base source]): scale the other source so
    # its grains of that kind match the base's. Chained pairs build on earlier ones.
    for base_kind, other_kind, other_src, *base_src in levels:
        bs = base_src[0] if base_src else None
        base_gain = source_gain[bs] if bs else norm
        source_gain[other_src] = base_gain * median_rms(base_kind, bs) / median_rms(other_kind, other_src)
    if 'flatten' in config:
        for name in config['flatten']['sources']:
            source_gain[name] = config['flatten']['headroom']
    # Borrowed starter and shutdown recordings keep the gain they have in the bank the vehicle used before, so changing its
    # idle recording doesn't make its starter louder or quieter.
    source_gain.update(config.get('fixedGain', {}))

    os.makedirs(os.path.join(ROOT, 'public', 'audio'), exist_ok=True)
    with wave.open(os.path.join(ROOT, 'public', 'audio', f'{args.bank}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
    bank = {
        'file': f'audio/{args.bank}.wav',
        'sampleRate': SR,
        'strokes': 4,
        'crankRpm': 320,  # cranking speed the crank loop plays back at its natural rate
        'sourceGain': {name: round(g, 3) for name, g in source_gain.items()},
        'grains': grains,
        'oneshots': oneshots,
    }
    if config.get('idleCycles'):
        bank['readThrough'] = True  # idle grains are whole, matching cycles: play them in recording order (engineWorklet.js)
    with open(os.path.join(ROOT, 'public', 'audio', f'{args.bank}.json'), 'w') as f:
        json.dump(bank, f, indent=1, allow_nan=False)  # NaN isn't JSON: the browser would refuse the whole bank

    for k in ('idle', 'idle2', 'idle3', 'accel', 'decel'):
        rpms = [g['rpm'] for g in grains if g['kind'] == k and g.get('ok', True)]
        if not rpms:
            continue
        print(f'{k:6s} {len(rpms):4d} grains, rpm {min(rpms):.0f} to {max(rpms):.0f}')
    print(f'source gains {source_gain}, {len(audio) / SR:.1f} s, peak {np.abs(audio).max():.2f}, rejected {rejected}')

    if args.plot:
        import matplotlib

        matplotlib.use('Agg')
        import matplotlib.pyplot as plt

        fig, axes = plt.subplots(len(plot_data), 1, figsize=(16, 2.2 * len(plot_data)))
        for ax, (kind, src, t0, x, peaks) in zip(axes, plot_data):
            t = np.arange(len(x)) / SR
            ax.plot(t, x, lw=0.3)
            for p in peaks:
                ax.axvline(p, color='r', lw=0.5)
            ax.set_title(f'{kind} ({src} from {t0}s): {len(peaks)} cuts', loc='left', fontsize=9)
            ax.set_xlim(0, min(t[-1], 1.2))
        plt.tight_layout()
        plt.savefig(args.plot, dpi=60)


if __name__ == '__main__':
    main()
