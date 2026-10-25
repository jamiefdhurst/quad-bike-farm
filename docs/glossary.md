# Glossary

One name for each place, thing and job, used everywhere a player reads it: prompts, toasts, the girls' lines, the FAQ, `docs/game.md`, the console and the debug panel (`.claude/rules/controls.md`). Code identifiers can differ; what a player reads cannot.

`tests/glossary.test.js` reads the "Not" column (variants separated by commas) and fails on any of them in `src/` or `docs/game.md`, so a variant that is listed cannot come back. A new thing gets a row before it gets a prompt. Use the name in the first column, and add the variants you find to the last.

A row is for a name with a choice in it. A thing with one obvious name does not need one.

| Name | What it is | Not |
| --- | --- | --- |
| cork board | The board on the barn's back wall where photos are pinned | corkboard, cork-board |
| money tin | The tin on the shelf under the cork board that holds the farm's money | biscuit tin |
| workbench | The bench along the barn's north wall where jobs are done and the bay is | work bench |
| toolbox | The red box you carry and open at a quad | tool box |
| jerry can | The 20 litre can you carry and pour from | jerrycan, jerry-can |
| seat belt | The belt in the Land Rovers and the UTV, on `;` | seatbelt |
| tow rope | The rope on the Farm 300's and Bruin's racks | towrope, tow-rope |
