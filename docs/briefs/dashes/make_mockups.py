"""Draws the dash mockups for docs/briefs/dashes.md as SVGs in this folder.

Run from anywhere: python3 docs/briefs/dashes/make_mockups.py
Units are millimetres, seen from the rider's seat looking down the bars. The
mockups fix layout, proportions, colours and lettering; they are not artwork to
copy pixel for pixel.
"""

import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))

BLACK = '#1c1c1c'
CHARCOAL = '#2b2d30'
PLASTIC = '#26272a'
CHROME = '#cfd2d5'
CREAM = '#efe6cf'
INK = '#1d1d1b'
LCD_GREEN = '#a9b59d'  # Grizzly 660: grey-green positive LCD
LCD_DIGIT = '#1f261c'
LCD_GHOST = '#9aa68f'
LCD_COOL = '#b8c2c7'  # loan quad: cooler, crisper grey
LCD_COOL_DIGIT = '#151a1e'
LCD_COOL_GHOST = '#a9b3b8'
AMBER = '#ffad3a'
AMBER_BG = '#100c07'
AMBER_GHOST = '#3a2a12'
LAMP_GREEN = '#3fd36b'
LAMP_AMBER = '#ffb52e'
LAMP_RED = '#ff4a3a'
FONT = "font-family='Helvetica, Arial, sans-serif'"


def svg(name, w, h, body, title, note, pad=0):
    w += 2 * pad
    h += 4
    out = [
        f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {w} {h + 34}' width='{w * 3}' height='{(h + 34) * 3}'>",
        f"<rect width='{w}' height='{h + 34}' fill='#f4f4f2'/>",
        f"<text x='6' y='11' {FONT} font-size='7' font-weight='bold' fill='#222'>{title}</text>",
        f"<text x='6' y='20' {FONT} font-size='4.6' fill='#555'>{note}</text>",
        f"<g transform='translate({pad} 30)'>",
        body,
        '</g>',
        f"<text x='{w - 6}' y='{h + 31}' {FONT} font-size='4' fill='#888' text-anchor='end'>mm, rider's view</text>",
        '</svg>',
    ]
    with open(os.path.join(HERE, name), 'w') as f:
        f.write('\n'.join(out))


def pol(cx, cy, r, a):
    """Point at angle a (degrees, 0 = right, counter-clockwise, y up on screen)."""
    return cx + r * math.cos(math.radians(a)), cy - r * math.sin(math.radians(a))


def arc(cx, cy, r, a0, a1, stroke, width, extra=''):
    x0, y0 = pol(cx, cy, r, a0)
    x1, y1 = pol(cx, cy, r, a1)
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 1 if a1 < a0 else 0
    return f"<path d='M{x0:.2f},{y0:.2f} A{r},{r} 0 {large} {sweep} {x1:.2f},{y1:.2f}' fill='none' stroke='{stroke}' stroke-width='{width}' {extra}/>"


def ticks(cx, cy, r0, r1, a0, a1, n, colour, width):
    out = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        x0, y0 = pol(cx, cy, r0, a)
        x1, y1 = pol(cx, cy, r1, a)
        out.append(f"<line x1='{x0:.2f}' y1='{y0:.2f}' x2='{x1:.2f}' y2='{y1:.2f}' stroke='{colour}' stroke-width='{width}'/>")
    return ''.join(out)


def labels(cx, cy, r, a0, a1, texts, colour, size):
    out = []
    for i, t in enumerate(texts):
        a = a0 + (a1 - a0) * i / (len(texts) - 1)
        x, y = pol(cx, cy, r, a)
        out.append(f"<text x='{x:.2f}' y='{y + size * 0.36:.2f}' {FONT} font-size='{size}' fill='{colour}' text-anchor='middle'>{t}</text>")
    return ''.join(out)


def needle(cx, cy, r, a, colour='#e8541e', width=1.4):
    x, y = pol(cx, cy, r, a)
    bx, by = pol(cx, cy, r * 0.18, a + 180)
    return (f"<line x1='{bx:.2f}' y1='{by:.2f}' x2='{x:.2f}' y2='{y:.2f}' stroke='{colour}' stroke-width='{width}' stroke-linecap='round'/>"
            f"<circle cx='{cx}' cy='{cy}' r='{width * 1.8}' fill='#222'/>")


def drum(x, y, digits, tenths=True, h=7):
    """Mechanical counter: white digits on black, last digit (tenths) inverted."""
    w = 4.6
    out = [f"<rect x='{x - 1}' y='{y - 1}' width='{len(digits) * w + 2}' height='{h + 2}' rx='0.8' fill='#0b0b0b' stroke='#555' stroke-width='0.4'/>"]
    for i, ch in enumerate(digits):
        last = tenths and i == len(digits) - 1
        out.append(f"<rect x='{x + i * w + 0.3}' y='{y}' width='{w - 0.6}' height='{h}' fill='{'#f2f2f2' if last else '#151515'}'/>")
        out.append(f"<text x='{x + i * w + w / 2}' y='{y + h * 0.78}' {FONT} font-size='{h * 0.8}' fill='{'#111' if last else '#f2f2f2'}' text-anchor='middle'>{ch}</text>")
    return ''.join(out)


def lamp(x, y, colour, label, lit=True, r=3.4, shape='circle', label_below=True):
    fill = colour if lit else '#3a3a3a'
    glow = f"<circle cx='{x}' cy='{y}' r='{r * 1.8}' fill='{colour}' opacity='0.25'/>" if lit else ''
    body = (f"<circle cx='{x}' cy='{y}' r='{r}' fill='{fill}' stroke='#777' stroke-width='0.5'/>" if shape == 'circle'
            else f"<rect x='{x - r}' y='{y - r}' width='{2 * r}' height='{2 * r}' rx='0.8' fill='{fill}' stroke='#777' stroke-width='0.5'/>")
    lab = f"<text x='{x}' y='{y + r + 5}' {FONT} font-size='3.6' fill='#ddd' text-anchor='middle'>{label}</text>" if label_below else ''
    return glow + body + lab


def key(x, y, on=True, ring='#9a9a9a'):
    a = 0 if on else -90
    return (f"<circle cx='{x}' cy='{y}' r='6.5' fill='#111' stroke='{ring}' stroke-width='1'/>"
            f"<rect x='{x - 1.2}' y='{y - 5}' width='2.4' height='10' rx='0.6' fill='#bbb' transform='rotate({a} {x} {y})'/>"
            f"<text x='{x - 9}' y='{y - 6}' {FONT} font-size='3.4' fill='#ccc'>O</text><text x='{x + 7.5}' y='{y - 6}' {FONT} font-size='3.4' fill='#ccc'>I</text>")


def seg_text(x, y, text, size, colour, ghost=None, anchor='start', weight='normal'):
    """Stand-in for seven-segment digits (the game draws real segments; dash.js drawDigit)."""
    g = f"<text x='{x}' y='{y}' font-family='DSEG7 Classic, Menlo, monospace' font-size='{size}' fill='{ghost}' text-anchor='{anchor}' font-style='italic'>{'8' * len(text)}</text>" if ghost else ''
    return g + f"<text x='{x}' y='{y}' font-family='DSEG7 Classic, Menlo, monospace' font-size='{size}' fill='{colour}' text-anchor='{anchor}' font-style='italic' font-weight='{weight}'>{text}</text>"


def bar_tube(y, x0, x1, d=22):
    return f"<rect x='{x0}' y='{y - d / 2}' width='{x1 - x0}' height='{d}' rx='{d / 2}' fill='#3a3c3f'/><rect x='{x0}' y='{y - d / 2 + 2}' width='{x1 - x0}' height='3' fill='#55585c' opacity='0.6'/>"


def mount_mark(x, y, w, label='pod mount'):
    return (f"<rect x='{x - w / 2}' y='{y - 4}' width='{w}' height='8' fill='none' stroke='#2a7fff' stroke-width='0.8' stroke-dasharray='2 1.5'/>"
            f"<text x='{x + w / 2 + 3}' y='{y + 1.5}' {FONT} font-size='4' fill='#2a7fff'>{label}</text>")


# Red: Honda Foreman-style cover and speedo --------------------------------------

def red():
    b = [bar_tube(30, 0, 360)]
    # the cover
    b.append(f"<path d='M105,18 Q105,8 118,8 L242,8 Q255,8 255,18 L262,140 Q262,150 250,150 L110,150 Q98,150 98,140 Z' fill='{PLASTIC}' stroke='#111' stroke-width='1'/>")
    # speedo window and face
    b.append(f"<rect x='118' y='18' width='124' height='78' rx='6' fill='#111' stroke='#444' stroke-width='1.2'/>")
    b.append(f"<rect x='122' y='22' width='116' height='70' rx='4' fill='#0c0d0e'/>")
    cx, cy, r = 196, 70, 40
    b.append(ticks(cx, cy, r - 6, r, 170, 10, 9, '#e9e9e9', 0.9))
    b.append(ticks(cx, cy, r - 3, r, 170, 10, 18, '#bbb', 0.5))
    b.append(labels(cx, cy, r - 11, 170, 10, [str(v) for v in range(0, 50, 5)], '#e9e9e9', 4.6))
    b.append(f"<text x='{cx + 30}' y='{cy + 12}' {FONT} font-size='4' fill='#bbb'>mph</text>")
    b.append(needle(cx, cy, r - 2, 128))
    b.append(f"<text x='128' y='37' {FONT} font-size='3.6' fill='#ccc'>HOUR METER</text>")
    b.append(drum(128, 40, '01024', True))
    b.append(f"<text x='128' y='57' {FONT} font-size='3.6' fill='#ccc'>ODOMETER</text>")
    b.append(drum(128, 60, '04172', True))
    b.append(f"<text x='128' y='86' {FONT} font-size='6.5' font-weight='bold' fill='#e8e8e8' letter-spacing='1'>HONDA</text>")
    # lamps and key
    b.append(f"<rect x='126' y='104' width='68' height='26' rx='3' fill='#18191b'/>")
    b.append(lamp(138, 114, LAMP_AMBER, 'R', lit=False, shape='rect'))
    b.append(lamp(160, 114, LAMP_GREEN, 'N', lit=True, shape='rect'))
    b.append(lamp(182, 114, LAMP_RED, 'OIL °C', lit=False, shape='rect'))
    b.append(key(222, 118))
    b.append(mount_mark(180, 0, 70))
    svg('red.svg', 360, 156, ''.join(b), 'Red: Honda Foreman-style cover: speedo with hour meter and odometer drums, three lamps, key',
        'Stock, after a TRX400FW Foreman. No rev counter, fuel or temp gauge: those come from a pod.')


# Blue: Grizzly 660-style LCD in its pod ---------------------------------------------

def lcd_blue(x, y, w, h, bg, on, ghost, wide=False):
    b = [f"<rect x='{x}' y='{y}' width='{w}' height='{h}' rx='3' fill='{bg}' stroke='#0b0b0b' stroke-width='1.5'/>"]
    # fuel bar across the top left
    b.append(f"<text x='{x + 4}' y='{y + 8}' {FONT} font-size='3.6' fill='{on}'>E</text>")
    for i in range(6):
        b.append(f"<rect x='{x + 9 + i * 6}' y='{y + 4}' width='4.6' height='5' fill='{on if i < 4 else ghost}'/>")
    b.append(f"<text x='{x + 46}' y='{y + 8}' {FONT} font-size='3.6' fill='{on}'>F</text>")
    # temp blocks top right
    tx = x + w - 44
    b.append(f"<text x='{tx}' y='{y + 8}' {FONT} font-size='3.6' fill='{on}'>C</text>")
    for i in range(5):
        b.append(f"<rect x='{tx + 5 + i * 6}' y='{y + 4}' width='4.6' height='5' fill='{on if i < 2 else ghost}'/>")
    b.append(f"<text x='{tx + 36}' y='{y + 8}' {FONT} font-size='3.6' fill='{on}'>H</text>")
    # gear letter box
    b.append(f"<rect x='{x + 4}' y='{y + 14}' width='11' height='14' fill='none' stroke='{on}' stroke-width='0.6'/>")
    b.append(f"<text x='{x + 9.5}' y='{y + 25}' {FONT} font-size='10' font-weight='bold' fill='{on}' text-anchor='middle'>H</text>")
    # big speed
    b.append(seg_text(x + w / 2 + 14, y + 36, '18', 26, on, ghost, 'end'))
    b.append(f"<text x='{x + w / 2 + 17}' y='{y + 35}' {FONT} font-size='4.4' fill='{on}'>MPH</text>")
    # clock
    b.append(seg_text(x + w - 5, y + 21, '10:42', 7, on, None, 'end'))
    # bottom line: trip / odo / hours in turn
    b.append(f"<line x1='{x + 3}' y1='{y + h - 13}' x2='{x + w - 3}' y2='{y + h - 13}' stroke='{ghost}' stroke-width='0.5'/>")
    b.append(f"<text x='{x + 5}' y='{y + h - 4}' {FONT} font-size='4.2' font-weight='bold' fill='{on}'>TRIP</text>")
    b.append(seg_text(x + w - 5, y + h - 3.5, '12.4', 8, on, None, 'end'))
    return ''.join(b)


def blue():
    b = [bar_tube(34, 0, 330)]
    b.append(f"<path d='M70,22 Q70,10 84,10 L246,10 Q260,10 260,22 L266,104 Q266,114 254,114 L76,114 Q64,114 64,104 Z' fill='{CHARCOAL}' stroke='#111' stroke-width='1'/>")
    b.append(f"<path d='M96,16 L234,16 L228,24 L102,24 Z' fill='#202124'/>")  # small brow
    b.append(f"<rect x='103' y='26' width='124' height='72' rx='6' fill='#151617'/>")
    b.append(lcd_blue(109, 31, 112, 62, LCD_GREEN, LCD_DIGIT, LCD_GHOST))
    for y, (c, l, lit) in zip((44, 72), ((LAMP_GREEN, 'N', False), (LAMP_AMBER, 'R', False))):
        b.append(lamp(86, y, c, l, lit, r=4.2))
    for y, (c, l, lit) in zip((44, 72), ((LAMP_RED, 'TEMP', False), (LAMP_AMBER, 'FUEL', False))):
        b.append(lamp(244, y, c, l, lit, r=4.2))
    b.append(f"<rect x='146' y='100' width='14' height='6' rx='2' fill='#444'/><rect x='170' y='100' width='14' height='6' rx='2' fill='#444'/>")
    b.append(f"<text x='153' y='111' {FONT} font-size='3.2' fill='#aaa' text-anchor='middle'>SELECT</text><text x='177' y='111' {FONT} font-size='3.2' fill='#aaa' text-anchor='middle'>RESET</text>")
    b.append(mount_mark(165, 2, 70))
    svg('blue.svg', 330, 118, ''.join(b), 'Blue: Yamaha Grizzly 660-style LCD in its handlebar pod',
        'Grey-green positive LCD, black segments. Fuel and temp bars, gear letter, speed, clock, a line that cycles trip, odometer and hours. No rev counter.')


# Loan: newer, wider LCD ---------------------------------------------------------------

def loan():
    b = [bar_tube(34, 0, 340)]
    b.append(f"<path d='M62,24 Q62,8 80,8 L260,8 Q278,8 278,24 L284,104 Q284,116 270,116 L70,116 Q56,116 56,104 Z' fill='#1b1c1e' stroke='#0a0a0a' stroke-width='1'/>")
    b.append(f"<path d='M80,12 L260,12' stroke='#8d949a' stroke-width='1.2'/>")  # thin silver trim
    b.append(f"<rect x='88' y='20' width='164' height='76' rx='8' fill='#0e0f10'/>")
    x, y, w, h = 94, 25, 152, 66
    on, ghost = LCD_COOL_DIGIT, LCD_COOL_GHOST
    b.append(f"<rect x='{x}' y='{y}' width='{w}' height='{h}' rx='5' fill='{LCD_COOL}'/>")
    # fuel as a sweep of segments across the top
    for i in range(8):
        b.append(f"<rect x='{x + 34 + i * 10.5}' y='{y + 4}' width='8.5' height='4.6' rx='0.6' fill='{on if i < 6 else ghost}'/>")
    b.append(f"<text x='{x + 28}' y='{y + 8.4}' {FONT} font-size='4' fill='{on}' text-anchor='end'>E</text><text x='{x + 120}' y='{y + 8.4}' {FONT} font-size='4' fill='{on}'>F</text>")
    # gear column
    for i, g in enumerate('HLNRP'):
        lit = g == 'H'
        b.append(f"<text x='{x + 8}' y='{y + 18 + i * 9}' {FONT} font-size='6.4' font-weight='bold' fill='{on if lit else ghost}' text-anchor='middle'>{g}</text>")
    b.append(f"<rect x='{x + 3.5}' y='{y + 12}' width='9' height='8' fill='none' stroke='{on}' stroke-width='0.6'/>")
    b.append(seg_text(x + 92, y + 46, '24', 32, on, ghost, 'end'))
    b.append(f"<text x='{x + 95}' y='{y + 44}' {FONT} font-size='5' fill='{on}'>mph</text>")
    # temp bars vertical on the right
    for i in range(6):
        b.append(f"<rect x='{x + w - 12}' y='{y + 46 - i * 6}' width='7' height='4.4' fill='{on if i < 3 else ghost}'/>")
    b.append(f"<text x='{x + w - 8.5}' y='{y + 56}' {FONT} font-size='3.6' fill='{on}' text-anchor='middle'>°C</text>")
    b.append(f"<text x='{x + w - 30}' y='{y + 20}' {FONT} font-size='4.6' font-weight='bold' fill='{on}'>4WD</text>")
    b.append(seg_text(x + w - 18, y + 31, '10:42', 7.5, on, None, 'end'))
    b.append(f"<line x1='{x + 18}' y1='{y + 52}' x2='{x + w - 18}' y2='{y + 52}' stroke='{ghost}' stroke-width='0.5'/>")
    b.append(f"<text x='{x + 20}' y='{y + 62}' {FONT} font-size='4.6' font-weight='bold' fill='{on}'>TRIP A</text>")
    b.append(seg_text(x + w - 20, y + 62.5, '12.4', 9, on, None, 'end'))
    for bx in (126, 162, 198):
        b.append(f"<rect x='{bx}' y='100' width='18' height='7' rx='2.5' fill='#3a3d40'/>")
    b.append(lamp(74, 50, LAMP_AMBER, 'R', False, r=3.6) + lamp(74, 76, LAMP_GREEN, 'N', False, r=3.6))
    b.append(lamp(266, 50, LAMP_RED, 'TEMP', False, r=3.6) + lamp(266, 76, LAMP_AMBER, 'FUEL', False, r=3.6))
    b.append(mount_mark(170, 0, 70))
    svg('loan.svg', 340, 120, ''.join(b), 'Loan: a newer Yamaha-style multifunction LCD',
        'Wider and crisper than the blue: cooler grey LCD, gear column, fuel sweep, temp bars, 4WD, clock, trip line, three buttons. Silver trim.')


# Green: Bayou-style nacelle with two lamps ----------------------------------------------

def green():
    b = [bar_tube(46, 0, 300)]
    b.append(f"<path d='M70,64 Q66,30 96,22 L204,22 Q234,30 230,64 Q228,96 150,100 Q72,96 70,64 Z' fill='#2f6b2f' stroke='#1f421f' stroke-width='1'/>")  # nacelle in the body colour
    b.append(f"<path d='M104,18 Q104,10 114,10 L186,10 Q196,10 196,18 L198,40 Q198,46 190,46 L110,46 Q102,46 102,40 Z' fill='{PLASTIC}' stroke='#111' stroke-width='1'/>")
    b.append(lamp(132, 26, LAMP_GREEN, 'N', True, r=4.6, shape='rect'))
    b.append(lamp(156, 26, LAMP_AMBER, 'R', False, r=4.6, shape='rect'))
    b.append(key(182, 28))
    b.append(f"<text x='150' y='86' {FONT} font-size='6' font-weight='bold' fill='#d9e7d0' text-anchor='middle' letter-spacing='1'>KAWASAKI</text>")
    b.append(mount_mark(150, 2, 70, 'pod mount (the analogue pod sits here well)'))
    svg('green.svg', 300, 104, ''.join(b), 'Green: Kawasaki Bayou-style headlight nacelle with two lamps and the key',
        'Stock is just neutral and reverse lamps and a key on a small cover on top of the nacelle. Everything else comes from a pod.')


# Yellow: Blaster-style headlamp on the bars ---------------------------------------------

def yellow():
    b = [bar_tube(40, 0, 300)]
    b.append(f"<rect x='80' y='6' width='140' height='14' rx='7' fill='#c9c34a' stroke='#8a8530'/>")  # crossbar pad (in a yellow cover)
    b.append(f"<path d='M106,52 L194,52 Q204,52 204,62 L200,100 Q198,108 188,108 L112,108 Q102,108 100,100 L96,62 Q96,52 106,52 Z' fill='#151515' stroke='#444' stroke-width='1'/>")  # back of the lamp shell
    b.append(f"<rect x='104' y='48' width='92' height='6' rx='3' fill='{CHROME}'/>")  # rim showing over the top
    b.append(lamp(150, 60, LAMP_RED, 'power', True, r=3.6))
    b.append(key(150, 86))
    b.append(mount_mark(150, 13, 60, 'pod mount on the crossbar pad'))
    svg('yellow.svg', 300, 112, ''.join(b), 'Yellow: Yamaha Blaster-style headlamp on the bars',
        'No instruments. One small red-capped lamp on top of the lamp shell that lights with the ignition, and the key in the back of the shell.')


# Orange: bare race bars --------------------------------------------------------------------

def orange():
    b = [bar_tube(40, 0, 320)]
    b.append(f"<rect x='90' y='6' width='140' height='14' rx='7' fill='#e07a1f' stroke='#9a5212'/>")
    b.append(f"<rect x='34' y='28' width='26' height='24' rx='3' fill='#202020'/>")  # left switch block
    b.append(f"<rect x='40' y='31' width='14' height='8' rx='2' fill='{LAMP_RED}'/>")
    b.append(f"<text x='47' y='47' {FONT} font-size='3.6' fill='#ddd' text-anchor='middle'>RUN</text>")
    b.append(f"<path d='M47,52 q-6,18 6,30 q10,10 0,24' fill='none' stroke='#d33' stroke-width='1.4'/>")  # tether
    b.append(mount_mark(160, 13, 60, 'pod mount on the crossbar pad'))
    svg('orange.svg', 320, 112, ''.join(b), 'Orange: Suzuki LT250R-style bare race bars',
        'Nothing to read. A red kill switch on the left bar that flips RUN / OFF with the ignition (K), and a tether. A pod is the only way to see anything.')


# Kids: a key and nothing else ------------------------------------------------------------

def kids():
    b = [bar_tube(36, 0, 220, 18)]
    b.append(f"<rect x='70' y='22' width='80' height='14' rx='7' fill='#d98fb0' stroke='#a86486'/>")  # foam pad
    b.append(f"<rect x='96' y='44' width='28' height='22' rx='4' fill='#151515'/>")
    b.append(key(110, 55))
    b.append(mount_mark(110, 14, 46, 'pod mount (small quad, full-size pod)'))
    svg('kids.svg', 220, 80, ''.join(b), "Kids': a key switch on the bar clamp",
        'Nothing else. A fitted pod keeps its full size, so it looks comically big here.')


# Analogue pod --------------------------------------------------------------------------------

def dial(cx, cy, r, kind):
    out = [f"<circle cx='{cx}' cy='{cy}' r='{r + 6}' fill='{CHROME}' stroke='#8d9195' stroke-width='0.8'/>",
           f"<circle cx='{cx}' cy='{cy}' r='{r + 2}' fill='#9a9ea2'/>",
           f"<circle cx='{cx}' cy='{cy}' r='{r}' fill='{CREAM}'/>"]
    a0, a1 = 210, -30
    if kind == 'speed':
        out.append(ticks(cx, cy, r - 6, r - 1, a0, a1, 12, INK, 0.9))
        out.append(ticks(cx, cy, r - 3.5, r - 1, a0, a1, 24, INK, 0.5))
        out.append(labels(cx, cy, r - 12, a0, a1, [str(v) for v in range(0, 70, 10)], INK, 5))
        out.append(f"<text x='{cx}' y='{cy - 12}' {FONT} font-size='4' fill='{INK}' text-anchor='middle'>MPH</text>")
        out.append(drum(cx - 11.5, cy + 15, '04172', True, 6))
        out.append(f"<text x='{cx + 13}' y='{cy + 20}' {FONT} font-size='3' fill='#555'>ODO</text>")
        out.append(drum(cx - 9.2, cy + 24, '0124', True, 6))
        out.append(f"<text x='{cx + 13}' y='{cy + 29}' {FONT} font-size='3' fill='#555'>TRIP</text>")
        out.append(needle(cx, cy, r - 3, 150, '#d2321e', 1.3))
    else:
        out.append(arc(cx, cy, r - 3.5, -6, -30, '#d2321e', 5))  # red from the fitted quad's redline
        out.append(ticks(cx, cy, r - 6, r - 1, a0, a1, 12, INK, 0.9))
        out.append(labels(cx, cy, r - 12, a0, a1, [str(v) for v in range(0, 13)], INK, 4.2))
        out.append(f"<text x='{cx}' y='{cy - 12}' {FONT} font-size='3.6' fill='{INK}' text-anchor='middle'>×1000 r/min</text>")
        out.append(drum(cx - 11.5, cy + 17, '01024', True, 6))
        out.append(f"<text x='{cx + 13}' y='{cy + 22}' {FONT} font-size='3' fill='#555'>HRS</text>")
        out.append(needle(cx, cy, r - 3, 190, '#d2321e', 1.3))
    return ''.join(out)


def mini(cx, cy, r, kind):
    out = [f"<circle cx='{cx}' cy='{cy}' r='{r + 3}' fill='{CHROME}' stroke='#8d9195' stroke-width='0.6'/>",
           f"<circle cx='{cx}' cy='{cy}' r='{r}' fill='{CREAM}'/>"]
    if kind == 'fuel':
        out.append(arc(cx, cy, r - 3, 160, 135, '#d2321e', 2))
        out.append(ticks(cx, cy, r - 5, r - 1.5, 160, 20, 4, INK, 0.7))
        out.append(labels(cx, cy, r - 9, 160, 20, ['E', '', '', '', 'F'], INK, 3.8))
        out.append(f"<text x='{cx}' y='{cy + 9}' {FONT} font-size='3' fill='{INK}' text-anchor='middle'>FUEL</text>")
        out.append(needle(cx, cy, r - 2, 75, '#d2321e', 0.9))
    else:
        out.append(arc(cx, cy, r - 3, 160, 130, '#2f6fd6', 2))
        out.append(arc(cx, cy, r - 3, 40, 20, '#d2321e', 2))
        out.append(ticks(cx, cy, r - 5, r - 1.5, 160, 20, 4, INK, 0.7))
        out.append(labels(cx, cy, r - 9, 160, 20, ['C', '', '', '', 'H'], INK, 3.8))
        out.append(f"<text x='{cx}' y='{cy + 9}' {FONT} font-size='3' fill='{INK}' text-anchor='middle'>TEMP</text>")
        out.append(needle(cx, cy, r - 2, 95, '#d2321e', 0.9))
    return ''.join(out)


def pod_analogue():
    b = [f"<rect x='92' y='150' width='16' height='22' fill='#333'/><rect x='70' y='166' width='60' height='10' rx='5' fill='#555'/>"]  # stem and bar clamp
    b.append(f"<path d='M12,40 Q12,12 40,12 L160,12 Q188,12 188,40 L188,118 Q188,150 160,150 L40,150 Q12,150 12,118 Z' fill='#1a1a1a' stroke='#000' stroke-width='1'/>")  # black steel bracket plate
    b.append(dial(55, 58, 34, 'speed'))
    b.append(dial(145, 58, 34, 'revs'))
    b.append(mini(40, 125, 15, 'fuel'))
    b.append(mini(160, 125, 15, 'temp'))
    for x, (c, l, lit) in zip((76, 92, 108, 124), ((LAMP_GREEN, 'N', True), (LAMP_AMBER, 'R', False), (LAMP_RED, 'TEMP', False), (LAMP_AMBER, 'FUEL', False))):
        b.append(f"<circle cx='{x}' cy='122' r='5.6' fill='{CHROME}'/>" + lamp(x, 122, c, l, lit, r=3.8))
    b.append(f"<text x='100' y='143' {FONT} font-size='3.4' fill='#888' text-anchor='middle' font-style='italic'>a cable runs down from the back</text>")
    svg('pod-analogue.svg', 200, 178, ''.join(b), 'Analogue pod: older aftermarket, two chrome-cupped cream dials',
        'Speedo (0-60 mph, odometer and trip drums), rev counter (0-12, red from the fitted quad\'s redline, hour drum), fuel, temp, four lamps.', pad=110)


# Digital pod ---------------------------------------------------------------------------------

def pod_digital():
    b = [f"<circle cx='100' cy='112' r='7' fill='#2a2a2a'/><rect x='96' y='112' width='8' height='34' fill='#2a2a2a'/><circle cx='100' cy='146' r='7' fill='#2a2a2a'/><rect x='76' y='150' width='48' height='10' rx='5' fill='#555'/>"]  # ball-and-arm mount
    b.append(f"<rect x='14' y='14' width='172' height='92' rx='12' fill='#121314' stroke='#000' stroke-width='1'/>")
    b.append(f"<rect x='32' y='10' width='12' height='5' rx='2' fill='#3a3d40'/><rect x='156' y='10' width='12' height='5' rx='2' fill='#3a3d40'/>")
    x, y, w, h = 22, 22, 156, 76
    b.append(f"<rect x='{x}' y='{y}' width='{w}' height='{h}' rx='6' fill='{AMBER_BG}'/>")
    # bar-graph rev counter across the top, rising to the right, red at the end
    n = 30
    for i in range(n):
        hh = 3 + i * 0.32
        c = '#ff4a22' if i >= 26 else (AMBER if i < 17 else AMBER_GHOST)
        b.append(f"<rect x='{x + 8 + i * 4.6}' y='{y + 16 - hh}' width='3.4' height='{hh:.1f}' fill='{c}'/>")
    b.append(f"<text x='{x + 8}' y='{y + 22}' {FONT} font-size='3.2' fill='{AMBER}'>0</text><text x='{x + 140}' y='{y + 22}' {FONT} font-size='3.2' fill='{AMBER}'>12 ×1000</text>")
    b.append(seg_text(x + 92, y + 52, '27', 30, AMBER, AMBER_GHOST, 'end'))
    b.append(f"<text x='{x + 95}' y='{y + 50}' {FONT} font-size='5' fill='{AMBER}'>MPH</text>")
    # fuel vertical on the left
    for i in range(6):
        b.append(f"<rect x='{x + 6}' y='{y + 56 - i * 6}' width='9' height='4.6' fill='{AMBER if i < 4 else AMBER_GHOST}'/>")
    b.append(f"<text x='{x + 10.5}' y='{y + 66}' {FONT} font-size='3.4' fill='{AMBER}' text-anchor='middle'>FUEL</text>")
    # temp blocks and gear on the right
    for i in range(6):
        b.append(f"<rect x='{x + w - 15}' y='{y + 56 - i * 6}' width='9' height='4.6' fill='{AMBER if i < 3 else AMBER_GHOST}'/>")
    b.append(f"<text x='{x + w - 10.5}' y='{y + 66}' {FONT} font-size='3.4' fill='{AMBER}' text-anchor='middle'>TEMP</text>")
    b.append(f"<text x='{x + w - 30}' y='{y + 36}' {FONT} font-size='11' font-weight='bold' fill='{AMBER}' text-anchor='middle'>N</text>")
    b.append(seg_text(x + w - 22, y + 48, '10:42', 6.5, AMBER, None, 'end'))
    b.append(f"<line x1='{x + 20}' y1='{y + 60}' x2='{x + w - 20}' y2='{y + 60}' stroke='{AMBER_GHOST}' stroke-width='0.6'/>")
    b.append(f"<text x='{x + 22}' y='{y + 71}' {FONT} font-size='4.6' font-weight='bold' fill='{AMBER}'>HRS</text>")
    b.append(seg_text(x + w - 22, y + 71.5, '1024.6', 8.5, AMBER, None, 'end'))
    # warning icons along the bottom edge of the housing
    for i, (c, l) in enumerate(((LAMP_GREEN, 'N'), (LAMP_AMBER, 'R'), (LAMP_RED, 'TEMP'), (LAMP_AMBER, 'FUEL'))):
        b.append(f"<text x='{54 + i * 30}' y='104' {FONT} font-size='3.6' fill='{c if i == 0 else '#5a5a5a'}' text-anchor='middle'>{l}</text>")
    svg('pod-digital.svg', 200, 164, ''.join(b), 'Digital pod: brand-new aftermarket display on a ball-and-arm mount',
        'Amber-on-black, like the blue\'s current dash: bar rev counter, speed, fuel and temp bars, gear letter, clock, a line cycling ODO, TRIP and HRS, lamps.', pad=110)


def index():
    items = ['red', 'blue', 'loan', 'green', 'yellow', 'orange', 'kids', 'pod-analogue', 'pod-digital']
    html = ["<!doctype html><meta charset='utf-8'><title>Dash mockups</title>",
            "<style>body{font:15px -apple-system,sans-serif;background:#ddd;margin:16px}img{display:block;max-width:100%;margin:0 0 18px;background:#fff;box-shadow:0 1px 4px #0003}</style>",
            '<h1>Dash mockups</h1><p>See dashes.md for the brief.</p>']
    html += [f"<img src='{i}.svg' alt='{i}'>" for i in items]
    with open(os.path.join(HERE, 'index.html'), 'w') as f:
        f.write('\n'.join(html))


if __name__ == '__main__':
    for fn in (red, blue, loan, green, yellow, orange, kids, pod_analogue, pod_digital, index):
        fn()
    print('written to', HERE)
