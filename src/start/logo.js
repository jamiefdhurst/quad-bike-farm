// The game's logo: a painted farm sign on two posts. "QUAD BIKE FARM" in cream on a weathered green board, a red quad side-on
// kicking up mud, and "by Jamie Hurst" on a small plank nailed across the posts below. Drawn in code, so there's no asset to credit
// and it stays sharp at any size. Pure: returns an SVG string. Ids are prefixed so two logos on one page don't share filters.

const CREAM = '#efe4c4';
const BOARD = '#355f37';
const BOARD_DARK = '#284a2a';
const POST = '#6b4a2e';
const POST_DARK = '#4e3520';
const QUAD = '#b2382a';
const MUD = '#5a3f26';
const FONT = "Rockwell, 'Rockwell Extra Bold', 'Roboto Slab', 'Arvo', 'Courier New', Georgia, serif";

/** The quad, side-on facing right, about 200 wide with its wheels on y = 0: fenders arched over both wheels, a long seat, racks
 * front and back, the bars up at the front. */
function quadSilhouette(prefix) {
  const wheel = (cx) => {
    const lugs = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = cx + Math.cos(a) * 23, y = -24 + Math.sin(a) * 23;
      lugs.push(`<rect x="${(x - 3.5).toFixed(1)}" y="${(y - 2.5).toFixed(1)}" width="7" height="5" transform="rotate(${((a * 180) / Math.PI).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
    }
    return `<g fill="#1e1a16"><circle cx="${cx}" cy="-24" r="23"/>${lugs.join('')}</g>`
      + `<circle cx="${cx}" cy="-24" r="10" fill="#b9b2a0"/><circle cx="${cx}" cy="-24" r="4" fill="#1e1a16"/>`;
  };
  const dark = '#1e1a16';
  return `
    <g filter="url(#${prefix}-paint)">
      <path d="M2 -66 H 50 M 8 -66 V -56 M 44 -66 V -58 M 152 -66 H 200 M 158 -66 V -58 M 194 -66 V -56" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>
      <rect x="66" y="-48" width="58" height="18" rx="3" fill="#3a332c"/>
      <path d="M78 -30 H 124" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>
      ${wheel(40)}${wheel(162)}
      <path d="M2 -40 C 2 -58, 16 -62, 40 -62 C 64 -62, 78 -58, 80 -42 L 86 -44 L 116 -44 L 122 -42
               C 124 -58, 138 -62, 162 -62 C 186 -62, 200 -58, 200 -40 L 190 -40 C 188 -50, 178 -54, 162 -54
               C 146 -54, 136 -50, 134 -38 L 70 -38 C 68 -50, 58 -54, 40 -54 C 22 -54, 12 -50, 12 -40 Z" fill="${QUAD}"/>
      <path d="M26 -62 C 28 -74, 40 -76, 56 -76 L 104 -76 C 116 -76, 120 -70, 118 -62 Z" fill="#26211c"/>
      <path d="M112 -62 L 124 -78 L 142 -76 L 146 -62 Z" fill="${QUAD}"/>
      <path d="M138 -76 L 132 -96" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>
      <path d="M122 -98 L 146 -94" stroke="${dark}" stroke-width="6" stroke-linecap="round"/>
      <rect x="186" y="-58" width="12" height="9" rx="2" fill="${CREAM}"/>
    </g>`;
}

/** Clods of mud flung up behind the back wheel, biggest nearest it. */
function mudSpray() {
  const clods = [[-14, -40, 7], [-30, -54, 5.5], [-26, -26, 5], [-46, -66, 4.5], [-50, -38, 4], [-64, -78, 3.5], [-68, -54, 3], [-82, -88, 2.6], [-84, -66, 2.4], [-38, -84, 2.8], [-98, -96, 2]];
  return clods.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r * 1.3}" ry="${r}" transform="rotate(-30 ${x} ${y})"/>`).join('');
}

export function logoSvg({ byline = 'by Jamie Hurst', prefix = 'qbf' } = {}) {
  const p = prefix;
  const grain = [];
  // Faint grain along each of the three planks.
  for (let plank = 0; plank < 3; plank++) {
    for (let i = 0; i < 4; i++) {
      const y = 34 + plank * 66 + 12 + i * 13;
      grain.push(`<path d="M30 ${y} C 180 ${y - 4}, 330 ${y + 5}, 570 ${y - 2}" stroke="${BOARD_DARK}" stroke-width="1.2" fill="none" opacity="0.55"/>`);
    }
  }
  const bolt = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#8f8a7a"/><circle cx="${x - 1.2}" cy="${y - 1.2}" r="2" fill="#c9c3b0"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" role="img" aria-labelledby="${p}-title">
  <title id="${p}-title">Quad Bike Farm, by Jamie Hurst</title>
  <defs>
    <filter id="${p}-paint" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="${p}-worn" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.06 0.12" numOctaves="3" seed="11" result="w"/>
      <feColorMatrix in="w" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -16 0 0 0 11.6" result="wearMask"/>
      <feComposite in="d" in2="wearMask" operator="in"/>
    </filter>
    <linearGradient id="${p}-board" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3d6b3e"/><stop offset="1" stop-color="${BOARD}"/>
    </linearGradient>
  </defs>
  <g>
    <rect x="96" y="40" width="26" height="300" fill="${POST}"/><rect x="96" y="40" width="7" height="300" fill="${POST_DARK}"/>
    <rect x="478" y="40" width="26" height="300" fill="${POST}"/><rect x="478" y="40" width="7" height="300" fill="${POST_DARK}"/>
  </g>
  <g>
    <rect x="20" y="30" width="560" height="204" rx="8" fill="url(#${p}-board)" stroke="${BOARD_DARK}" stroke-width="4"/>
    <path d="M22 98 H 578 M 22 166 H 578" stroke="${BOARD_DARK}" stroke-width="3"/>
    ${grain.join('')}
    <rect x="26" y="36" width="548" height="192" rx="5" fill="none" stroke="${CREAM}" stroke-width="3" opacity="0.8" filter="url(#${p}-worn)"/>
    ${bolt(40, 48)}${bolt(560, 48)}${bolt(40, 216)}${bolt(560, 216)}
  </g>
  <g fill="${CREAM}" font-family="${FONT}" font-weight="800" filter="url(#${p}-worn)">
    <text x="300" y="112" text-anchor="middle" font-size="76" letter-spacing="4">QUAD BIKE</text>
    <text x="52" y="208" font-size="88" letter-spacing="6">FARM</text>
  </g>
  <g transform="translate(368 214) scale(0.92)">
    <g fill="${MUD}" opacity="0.9" filter="url(#${p}-paint)">${mudSpray()}</g>
    ${quadSilhouette(p)}
  </g>
  <g>
    <rect x="150" y="262" width="300" height="50" rx="5" fill="${POST}" stroke="${POST_DARK}" stroke-width="3"/>
    <path d="M154 287 C 250 283, 350 291, 446 286" stroke="${POST_DARK}" stroke-width="1.2" fill="none" opacity="0.6"/>
    ${bolt(166, 287)}${bolt(434, 287)}
    <text x="300" y="296" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="26" letter-spacing="1" fill="${CREAM}">${byline}</text>
  </g>
</svg>`;
}
