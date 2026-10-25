# Performance check-ups

Each `/perf check` adds a line here: the date, the commit on main it measured, and the headline numbers and what it proposed (`.claude/commands/perf.md`). A session-start reminder (`tools/checkupDue.mjs`) says when the last one is more than a week old.

- 2026-10-25, 8af901e3: the starting point (#396). Spawn 2,204 calls, 3.40M triangles, 12.5 ms a frame; village street 3,955 calls, 15.2 ms; every spot over the local 8 ms. Load 2.7 s to Ready. Next: #405 (shadows only where you can see them).
