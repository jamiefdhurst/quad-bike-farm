// What the Moor's plants look like on a given day of the farm's year (#713). Pure: no Three.js. The colours are linear-ish 0xRRGGBB numbers the view
// multiplies the plants' own light and dark by; `date` is the farm's date (`seasons.js` `farmDate`), of which only `month` (0..11) and `dom` are read.

const lerpHex = (a, b, t) => {
  const ch = (shift) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** How far through the year (in months, 0 to 12) the date is: June 1st is 5, August 15th about 7.5. */
export const monthPosition = (date) => date.month + (date.dom - 1) / 30;

/** `stops` as [month, colour] in order; the colour at month `m`, mixed between its neighbours, the year wrapping round. */
function colourAt(stops, m) {
  const n = stops.length;
  const list = [[stops[n - 1][0] - 12, stops[n - 1][1]], ...stops, [stops[0][0] + 12, stops[0][1]]];
  for (let i = 0; i < list.length - 1; i++) {
    if (m >= list[i][0] && m <= list[i + 1][0]) return lerpHex(list[i][1], list[i + 1][1], (m - list[i][0]) / (list[i + 1][0] - list[i][0] || 1));
  }
  return stops[0][1];
}

// Heather is brown most of the year and purple in August and September.
const HEATHER = [[0, 0x7a6448], [3.5, 0x7d6c48], [6.4, 0x846a50], [7.2, 0xa8689c], [8.7, 0xa2679c], [9.6, 0x86684f]];
// Bracken is bright green in the spring, green through the summer, rust in the autumn and dead brown in winter.
const BRACKEN = [[0, 0x8a6a46], [3.3, 0x96683a], [4.2, 0x8cc058], [5, 0x62933f], [8.6, 0x6a9640], [9.6, 0xc06f35], [10.8, 0x93653a]];
// Coarse moor grass and rushes: green-yellow in the growing season, straw after.
const TUSSOCK = [[0, 0xb8aa78], [3.6, 0xa8a868], [4.5, 0x9cb062], [9, 0x9ca868], [10, 0xb8aa78]];

/**
 * The colours today: `heather`, `bracken` and `tussock` (the plants' colour), and `cotton` (the grass's white heads: 0 to 1 how many show, full through
 * June and gone by August).
 */
export function moorColours(date) {
  const m = monthPosition(date);
  const cotton = m < 4.8 ? 0 : m < 5.1 ? (m - 4.8) / 0.3 : m < 6.6 ? 1 : m < 7.6 ? 1 - (m - 6.6) : 0;
  return { heather: colourAt(HEATHER, m), bracken: colourAt(BRACKEN, m), tussock: colourAt(TUSSOCK, m), cotton: Math.max(0, Math.min(1, cotton)) };
}
