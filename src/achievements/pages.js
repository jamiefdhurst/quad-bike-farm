// Lays the bucket list out in a notebook: pages of at most `rows` lines (a group's heading takes one), groups run on to the next page
// with "(cont.)" on the heading, and the pages come two to a spread. Pure.

export const NOTEBOOK_ROWS = 9;

/** Entries (as Achievements.entries gives them, unavailable ones left out) into pages: [{ lines: [{ heading } | { entry }] }]. */
export function paginate(entries, rows = NOTEBOOK_ROWS) {
  const pages = [];
  let page = null;
  let group = null;
  const fresh = () => {
    page = { lines: [] };
    pages.push(page);
  };
  const size = {};
  for (const e of entries) if (e.available) size[e.group] = (size[e.group] ?? 0) + 1;
  for (const e of entries) {
    if (!e.available) continue;
    // A group that would fit on a page whole starts a new one rather than splitting; a longer one needs room for its heading and an item.
    const starts = e.group !== group;
    const needs = starts && size[e.group] + 1 <= rows ? size[e.group] + 1 : 2;
    if (!page || (starts && page.lines.length + needs > rows) || page.lines.length >= rows) fresh();
    if (e.group !== group || page.lines.length === 0) {
      const continued = e.group === group;
      group = e.group;
      page.lines.push({ heading: continued ? `${group} (cont.)` : group });
    }
    page.lines.push({ entry: e });
  }
  return pages;
}

/** Pages into spreads of two: [[left, right], ...]. */
export function spreads(pages) {
  const out = [];
  for (let i = 0; i < pages.length; i += 2) out.push([pages[i], pages[i + 1] ?? null]);
  return out;
}
