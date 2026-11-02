---
paths:
  - "src/npc/*Lines.js"
  - "tools/generate_companion_voice.py"
  - "public/audio/**"
---

## Voice lines

- Spoken lines are recorded into `public/audio/companion-voice*-NNN.mp3` (files of about a minute, decoded by the game only when a line in one is needed) by `tools/generate_companion_voice.py` (see the "voice-generation-setup" memory). After adding or editing lines, re-record in the background (cached, so only new lines take time):
  - `TQDM_DISABLE=1 PYTHONWARNINGS=ignore .scratch/cb/bin/python tools/generate_companion_voice.py --character amy --cache .scratch/voice-cache --fallback .scratch/piper/en_GB-cori-high.onnx --piper .scratch/venv/bin/piper` (for a whole new voice or settings, add `--workers 2`, about 1.7 times as fast, and run it under `caffeinate -i` so the Mac does not sleep)
  - the same with `--character jess` and no fallback.
- You do the waiting and the committing, never Jamie. Start the recording so you are told when it ends (`run_in_background`), or poll it, and when both girls have finished check `git status` for the changed `public/audio/companion-voice*` files, stage them by name and commit ("Record the new lines for ...") on the item's branch, before its PR merges. Do this in the same session, before you give your final summary, and never hand the step back as "commit the banks when it's done". If the recording fails, fix it or say so plainly.
- `--bank-only` rebuilds a bank from the cache without recording anything (about 12 s a girl), for when only the bank's format or packing changes.
- Unrecorded lines fall back to browser speech, so the game works before recording finishes; commit the banks when it's done.

- **A new vehicle that can be on the farm** needs a phrase and nicknames in `quadNames.js`, and its id goes in `LATE_QUAD_IDS` there, not `EARLY_QUAD_IDS`: the lines about each quad are written out per quad and nickname, and putting a new quad among them re-packs the banks. Late ones are expanded after the rest and merged last (`AMY_LATE_*`, `JESS_LATE_*`), so only new banks change (#75).
