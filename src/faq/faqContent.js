// The hand-written half of the FAQ page (faq.html): questions and answers, a note for every vehicle and girl, and the tips the start
// screen shows. The other half is generated from the game's own data (the controls, the vehicles' specs, the bucket list and the
// recent commits), so it can't go stale. tests/faq.test.js fails if a vehicle or girl has no note here.
//
// Keep it for a player: what to do and what happens, not how it's built. British English, no em dashes, and the girls call the
// player "you". Answers are HTML (keys in <kbd>). `spoiler: true` folds an answer away behind a click; `tip` is a short line
// (under 140 characters) the start screen can show.

export const FAQ_SECTIONS = [
  {
    id: 'basics',
    title: 'Getting started',
    entries: [
      {
        q: 'What is this?',
        a: `A first-person farm in the British countryside with a yard full of temperamental old quads and other machines, a muddy track
          round a grass field, fields and a hill beyond, and two friends, Amy and Jess, who ride with you, drive, help, hinder and talk.
          There's no story and no fail state: start things, ride them, keep them running, and see what the girls get up to.`,
      },
      {
        q: 'How do I start playing?',
        a: `Click the start screen to lock the mouse, and you're stood in the yard. Walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>,
          look with the mouse, and press <kbd>E</kbd> at whatever you're looking at: a quad to get on, a girl to talk to, an item to pick up.
          <kbd>H</kbd> shows the controls at any time. Every engine starts stone cold, so read "Starting an engine" below before your first go.`,
        tip: 'Press H at any time for the controls.',
      },
      {
        q: 'Does the game pause?',
        a: `Yes. Press Esc and the mouse is let go and the card comes back: the whole farm stops where it is, sound and all, until you click
          to carry on. Nothing happens behind the start screen either, so you can open this page from it without missing anything. The tuning
          panel and the console are the exceptions: the game keeps running under those, so you can watch it.`,
        tip: 'Esc pauses the game. Click to carry on.',
      },
      {
        q: 'Where is everything?',
        a: `Press <kbd>M</kbd> for the farm map. It shows the fields, hedges and their gaps, the track and its bogs, the barns, the road and the
          hill, with you, the girls, every vehicle, the trailers, the jerry cans, the toolbox, the jump leads and the oil bottle marked on it.
          The game keeps going while it's open, so you can glance at it as you ride.`,
        tip: 'Lost? M shows the farm map, with the girls, the vehicles and the jerry cans on it.',
      },
      {
        q: 'Is it the same every game?',
        a: `No. Which vehicles are on the farm (four to all thirteen), where they're parked, how much fuel each has, the weather, the day's
          temperature, each quad's faults, quirks and history, and even the girls' moods are dealt fresh each game. Nothing carries over
          from one game to the next.`,
      },
      {
        q: 'Can I play the same farm again?',
        a: `Yes. The browser console prints the game's seed when it loads. Add <code>?seed=</code> and that number to the address and you get
          the same layout, weather and luck again. <code>?weather=rain</code> (or <code>sunny</code>, <code>overcast</code>, <code>drizzle</code>,
          <code>fog</code>) forces the weather, and <code>?temp=-3</code> sets the temperature in degrees.`,
        tip: 'Add ?seed= and a number to the address to play the same farm again.',
      },
      {
        q: 'Is there sound I should turn up?',
        a: `Yes, play with sound on. Every engine is built from real recordings and you'll often hear a problem (a misfire, a slipping belt,
          tappets ticking, pinking) long before anything shows. The girls speak too, with captions at the bottom of the screen. <kbd>N</kbd> mutes.`,
        tip: 'Listen to the engines: most faults are heard before they are seen.',
      },
    ],
  },
  {
    id: 'starting',
    title: 'Starting an engine',
    entries: [
      {
        q: 'How do I start a cold quad?',
        a: `<ol>
          <li>Get on with <kbd>E</kbd> (or work it from beside it: the same keys work stood at a quad).</li>
          <li>Hold <kbd>Q</kbd> to pull the choke right out. Watch the lever move: each quad's is in a different place.</li>
          <li>Turn the fuel tap on with <kbd>F</kbd>. They're left OFF; forget, and it starts, runs a few seconds on what's in the carb and dies.</li>
          <li><kbd>K</kbd> for the ignition.</li>
          <li>Hold <kbd>R</kbd> to crank in short goes. It should catch in a couple of seconds into a high, lumpy idle.</li>
          <li>As it warms, ease the choke off with <kbd>Z</kbd> a notch or two at a time. Too early and it stumbles and dies; too late and it
            hunts, runs rich and floods.</li>
          </ol>`,
        tip: 'Cold engine? Choke right out (Q), fuel tap on (F), key (K), then crank (R) in short goes.',
      },
      {
        q: 'It won’t start. What should I check?',
        a: `In order: is the fuel tap on (<kbd>F</kbd>), is there fuel in it, is there enough choke for how cold it is (more on a frosty day,
          little or none once warm), and does the starter sound strong? A slow, groaning starter or a single click is a flat battery.
          If it fired and then wouldn't, it's probably flooded. Crank near a girl for a while and she'll have a guess at the cause too.
          On a manual quad the starter won't turn in gear unless you hold the clutch (<kbd>Shift</kbd>).`,
        tip: 'A slow, groaning starter means the battery is going. Stop cranking and try the jump leads or a pull-start.',
      },
      {
        q: 'I think I’ve flooded it.',
        a: `Push the choke all the way in (<kbd>Z</kbd>) and crank with the throttle held wide open (<kbd>W</kbd> and <kbd>R</kbd> together) to clear it.
          A warm engine with lots of choke is the usual way to do it.`,
      },
      {
        q: 'The battery is flat. Now what?',
        a: `Three ways out. The yellow, orange, kids' quad, mini moto and old three-wheeler have a pull-start: with the ignition on, hold <kbd>P</kbd>
          for about half a second to a second and let go to yank (too short is weak, too long is botched). Or fetch the jump leads from the
          workbench, clamp the flat one (<kbd>E</kbd>) and then a running one (<kbd>E</kbd>), parked nose to nose since they only reach about
          4.5 m. The Series III Land Rover has a starting handle too (the 200TDi hasn't: it wants the leads). Running an engine charges its battery again; leaving the key on with it stopped drains it
          flat in about eight minutes.`,
        tip: 'Leaving the key on with the engine off flattens the battery in about eight minutes.',
      },
      {
        q: 'Why does it start badly when it’s hot?',
        a: `A hot engine boils the fuel in its carb, so it starts rich. Don't use the choke, and hold the throttle open while you crank.`,
      },
      {
        q: 'It coughs back through the carb when I open the throttle.',
        a: `That's a cold engine running lean: not enough choke for how cold it is. Put a bit more choke on or let it warm up. It doesn't hurt it,
          but anyone sat on it will jump.`,
      },
      {
        q: 'How do the diesels start?',
        a: `The tractor and the UTV have glow plugs: turn the key (<kbd>K</kbd>), wait for the GLOW lamp to go out, then hold <kbd>R</kbd>.
          In the cold the plugs take longer to heat. The UTV's key stops it again; the tractor's doesn't, you pull its stop knob (<kbd>O</kbd>).`,
      },
      {
        q: 'How does the Series III’s starting handle work?',
        a: `Stand at the front bumper. <kbd>1</kbd> holds the handle with your thumb round it, the natural way, and now and then the engine
          kicks back and you spend a few seconds nursing your hand. <kbd>2</kbd> holds it with your thumb alongside your fingers, which is safe.
          Then hold <kbd>P</kbd> and let go to swing it, with the same timing as a pull-start; each good swing turns it over once.`,
        tip: 'On the Series III’s starting handle, keep your thumb alongside your fingers (2), not round the handle.',
      },
    ],
  },
  {
    id: 'riding',
    title: 'Riding and driving',
    entries: [
      {
        q: 'How do the gears work?',
        a: `The blue, orange, kids' and loan quads, the mini moto and the UTV are automatics: <kbd>W</kbd> to go, <kbd>S</kbd> to brake.
          The red, green and yellow quads, the old three-wheeler, the tractor and both Land Rovers have a clutch: hold <kbd>Shift</kbd> and press
          <kbd>1</kbd> to <kbd>4</kbd> for a gear (the tractor has three, the 200TDi five), <kbd>B</kbd> for reverse and <kbd>0</kbd> for neutral. Pulling away
          in a high gear labours it and can stall it, and rushing a change can land you in a false neutral.`,
      },
      {
        q: 'Why do the revs follow my speed on the clutch vehicles?',
        a: `With the clutch up and a gear in, the engine is tied to the road: its revs are your speed in that gear (full revs at the gear's top speed),
          whatever the throttle does, so they climb as you speed up and fall as you slow, and each gear gives a different note. The throttle only
          decides how hard it pulls. Press <kbd>Shift</kbd> and they come free of the road, and you can rev it in neutral. It's the red, green and yellow
          quads, the old three-wheeler, the tractor and both Land Rovers; the automatics hold their revs in a band, like a CVT.`,
        tip: 'On a clutch vehicle the revs follow your speed in the gear you are in. Change up to bring them down.',
      },
      {
        q: 'How do I reverse?',
        a: `It's different on each, as on the real machines. Blue and loan: stopped, hold <kbd>S</kbd> and press <kbd>B</kbd>, then <kbd>S</kbd>
          backs it up. Red: <kbd>B</kbd> with the clutch in and the bars turned. Green: <kbd>B</kbd> with the clutch in, stopped. UTV: stopped,
          <kbd>B</kbd> flips the dash lever. The Land Rovers and the tractor: reverse is a gear. The yellow, orange, kids' quad, mini moto and three-wheeler
          have no reverse at all: get off and hold <kbd>V</kbd> to push it. In reverse, <kbd>S</kbd> is the throttle and <kbd>W</kbd> the brake.`,
        tip: 'The two-strokes have no reverse: get off and hold V to push them.',
      },
      {
        q: 'Why does it spin its wheels in the mud?',
        a: `The red and blue start every game in 2WD. <kbd>G</kbd> switches to 4WD (the rocker on the bars), which grips in the mud at the cost of a
          little steering. The blue's diff lock (<kbd>U</kbd>) pulls hardest of all in the mud but pushes wide on grass; the UTV and the Land Rover have
          a 4WD lever and a diff lock too. The green and the loan quad are always four-wheel drive; the yellow and orange are rear-wheel drive only.`,
        tip: 'The red and blue start in 2WD. Press G for 4WD before the mud, not in it.',
      },
      {
        q: 'It rolled away on its own.',
        a: `Every vehicle starts with its parking brake on (on a quad it is the left brake lever, squeezed in and held by a red catch, so look at the
          bars rather than for a message), but if you get off without setting it (<kbd>Space</kbd>) it can roll on a slope, and
          the girls will say whose fault it was. Stop on a bank off the throttle and it rolls back too: hold <kbd>S</kbd> or set the brake.`,
      },
      {
        q: 'I’ve tipped it over.',
        a: `<kbd>T</kbd> puts it back on its wheels. Side-on across a steep bank a quad rolls at about 35 degrees of lean (sooner with someone on the
          back), and nose-up it goes over backwards past about 45. Ride straight up the banks, not across them.`,
      },
      {
        q: 'What happens if I jump off while it’s moving?',
        a: `Above walking pace the quad carries on without you, at the same speed and steering, until it crashes, tips, stalls or runs dry. To stop a
          runaway, look at it and press <kbd>K</kbd>, or catch it once it's down below a jog and get back on. Get off stood still with the throttle
          open and it stays revving as if the cable had stuck. Leave a girl on the back of a runaway and she's either terrified or delighted.`,
      },
      {
        q: 'Can I take it through the ford?',
        a: `Slowly. Above about 15 mph the bow wave drowns the engine, and a drowned quad drips for a while afterwards.`,
        tip: 'Take the ford slowly: above about 15 mph the bow wave drowns the engine.',
      },
      {
        q: 'How do I jump the ramp?',
        a: `There's a plank ramp in the grass field with a long run-up behind it and room to land ahead. Hit it straight and fast and keep the bars
          straight in the air. The bucket list counts a jump, a long one and a clean landing.`,
      },
      {
        q: 'How does the mini moto ride?',
        a: `Like a bike, not a quad: the bars ask for a lean and the lean turns it, and faster corners need more lean. Power in a deep lean pushes the
          rear out (ease off and it comes back), and grabbing the brake mid-corner tucks the front. Overdo either, or lean hard in the mud, and it goes
          down: <kbd>T</kbd> or <kbd>E</kbd> beside it picks it up. Under walking pace a foot is down, so it can't fall.`,
      },
      {
        q: 'Why did the old three-wheeler fall over?',
        a: `One front wheel and a tall seat. A hard turn at speed (over about 12 m/s with the lock on) rolls it, while 9 m/s is fine. Slow down for corners.`,
      },
      {
        q: 'How do I see the dash properly?',
        a: `Hold <kbd>V</kbd> on a vehicle to lean in to the dash. Hold <kbd>C</kbd> (or the middle mouse button) to look back over your shoulder.
          Most quads' own dashes show very little, as on the real machines; fit an accessory pod with the toolbox to see revs, fuel and temperature.`,
      },
      {
        q: 'Is there a horn?',
        a: `Hold <kbd>L</kbd>. A girl sat on or driving a quad nearby beeps back (Jess always, Amy usually).`,
        tip: 'Hold L for the horn. The girls beep back.',
      },
    ],
  },
  {
    id: 'fuel',
    title: 'Fuel and oil',
    entries: [
      {
        q: 'How do I refuel?',
        a: `Find a jerry can (the map shows them), pick it up with <kbd>E</kbd>, look at the vehicle and hold <kbd>E</kbd> to pour. Refill the
          can by holding <kbd>E</kbd> at the green petrol tank. <kbd>G</kbd> puts it down; you can't ride holding it.`,
      },
      {
        q: 'It coughed and died with fuel in the tank.',
        a: `On ON the tap can't reach the last couple of litres. Flick it to RESERVE (<kbd>F</kbd>) when it starts to cough, and head for fuel.
          Some games a quad starts below its reserve and only runs on RESERVE until it's filled.`,
        tip: 'Coughing and dying? Flick the fuel tap to RESERVE with F and go for fuel.',
      },
      {
        q: 'What do the two-strokes need?',
        a: `The yellow, orange, kids' quad, mini moto and three-wheeler run on pre-mix, about 50:1 oil in petrol. There's a yellow can of pre-mix
          somewhere on the farm, and a bottle of two-stroke oil: hold <kbd>E</kbd> on the bottle with a can in your hands to add oil. Straight
          petrol in a two-stroke runs hot, nips up and in the end seizes solid. Too much oil, or pre-mix in a four-stroke, smokes like a bonfire
          and fouls the plug. The prompts tell you what's in the can you're holding; nothing tells you what's in a tank except how it runs.`,
        tip: 'The two-strokes need pre-mix. Straight petrol will seize them.',
      },
      {
        q: 'What about red diesel?',
        a: `The dark green bowser holds red diesel, for the tractor and the UTV, with a dark green can somewhere about the farm. Diesel in a petrol quad
          is slow poison: it runs rougher and weaker, smokes grey and stalls for good at about a fifth diesel. Petrol in a diesel does the same the other
          way. Take the toolbox to it and pump the tank out (<kbd>P</kbd> on a quad), then fill it with the right fuel.`,
      },
      {
        q: 'How do I check the engine oil?',
        a: `On a four-stroke (the red, blue, green and loan quads, the tractor, the UTV and both Land Rovers), stand at it and press <kbd>Y</kbd> to pull the
          dipstick. To top up, park near the oil bottle by the petrol tank and hold <kbd>Y</kbd>, or carry the bottle over. One of them burns oil each game
          and puffs smoke on the overrun. Run one low and the tappets tick, then it knocks, and dry it seizes.`,
        tip: 'Tappets ticking? Check the oil with Y. One four-stroke burns oil every game.',
      },
    ],
  },
  {
    id: 'mud',
    title: 'Mud, weather and the ground',
    entries: [
      {
        q: 'I’m stuck in a bog.',
        a: `Go into a bog slowly, or stop in one, and it drags you down. Not too deep: rock it, forwards, backwards, forwards, and each change of direction
          works it looser. Too deep: use the green quad's winch (look at the green, <kbd>X</kbd> to take the hook, walk it over, <kbd>E</kbd> on the stuck
          quad, then hold <kbd>X</kbd> by the green to wind in), or the tractor's tow chain. Next time, charge it with a run-up.`,
        tip: 'Stuck? Rock it: forwards, backwards, forwards. Each change of direction works it looser.',
      },
      {
        q: 'Where are the bogs?',
        a: `Two on the track and one in the low ground of the field, dark churned patches with a wet shine, all on the map. New ones form wherever quads
          keep driving over wet grass, and rain swells them, so late in a long game the field isn't the one you started with.`,
      },
      {
        q: 'How do I wash a quad?',
        a: `Pick up the hose on its reel at the end of the petrol tank (<kbd>E</kbd>; it reaches 25 m) and hold <kbd>E</kbd> at the quad: the wheels come
          clean first, then the bodywork. <kbd>G</kbd> puts the hose back. Mind where you point it.`,
      },
      {
        q: 'Why is everything white, and how do I get the frost off the seat?',
        a: `On a freezing morning the grass has a frost on it and so do the seats. Drive or ride across the grass and your tyres melt a dark track
          through it, which stays melted. A seat clears when someone sits on it, in a few seconds, though it is a cold start to the day.`,
      },
      {
        q: 'Does the weather matter?',
        a: `Yes. Rain wets the ground, and wet grass and especially wet mud are slipperier and the bogs worse. Cold days want more choke, longer to warm
          up and drain batteries faster; a hard frost whitens the grass and the seats (your tyres melt a track through the grass, and sitting on a seat clears it). Dry stubble throws up dust that clogs air filters fast. Hot, sunny days make the
          air-cooled quads overheat if you idle them or crawl through mud.`,
      },
      {
        q: 'Why is my quad losing power and rattling on a hot day?',
        a: `It's too hot and pinking. The air-cooled quads (red, blue, yellow and green) cook if left idling for ages in the sun or crawled through the mud
          with the throttle open. Ride along at a decent speed to cool it. The orange has a radiator and a fan, and stays cooler unless it's leaking.`,
      },
      {
        q: 'What does the tarmac road do?',
        a: `It grips harder and rolls easier than grass, and the tyres squeal on it. Mud you carry onto it from the track leaves slippery brown smears
          until the rain washes them off.`,
      },
    ],
  },
  {
    id: 'fixing',
    title: 'Keeping them running',
    entries: [
      {
        q: 'How do I know something’s wrong?',
        a: `Mostly by feel and sound; nothing on screen tells you. A slow puncture pulls the bars towards the soft tyre. A slipping belt flares the revs and
          hardly goes. A sticking throttle lingers after you let go, then sticks for good. A dirty carb hunts and runs rough. The girls see what you can't:
          ride off and one behind you may shout about smoke or a soft tyre. Amy's logbook on the workbench records what she has found.`,
        tip: 'Read Amy’s logbook on the workbench: it is always true, unlike what Jess tells you.',
      },
      {
        q: 'How do I fix things?',
        a: `Pick up the red toolbox from the workbench, take it to a switched-off quad and press <kbd>E</kbd>. <kbd>T</kbd> pumps and patches the tyres,
          <kbd>R</kbd> swaps the belt, <kbd>L</kbd> oils the cable, <kbd>C</kbd> cleans the carb, <kbd>I</kbd> (held) cleans the air filter, <kbd>V</kbd>
          services it. These are quick fixes that leave a mild fault behind; for a proper job, use the workbench. Each fix does its job if there is one and
          otherwise says all is well, so it doesn't give a fault away.`,
      },
      {
        q: 'What can the workbench do?',
        a: `Drive into the yellow bay in front of it, switch off, look at the bench and press <kbd>E</kbd>. <kbd>1</kbd> to <kbd>8</kbd> pick a job: a new plug,
          clean the carb, fix a tyre, two-stroke oil, engine oil, repack a silencer, coolant, or a big-bore kit. Each is a short list of steps; on a hold step keep
          <kbd>E</kbd> down and let go inside the green band. Too soon or too long botches it and the fault comes back a little. Amy helps; Jess heckles.`,
      },
      {
        q: 'What does the old spark plug tell me?',
        a: `How it has been running. The plug job lets you look at it: a black, sooty plug means it has been running rich (too much choke, a clogged air filter,
          too much oil in the mix), a pale one lean.`,
      },
      {
        q: 'What can I tune with the toolbox?',
        a: `The idle screw, the carb mixture, the throttle stop (screw it out for more top speed), the rev limiter, the clutch springs and the tyre pressures, plus
          a jet kit on the yellow and orange. Each shows its stock value and the trade-off. Taking the silencer off (<kbd>X</kbd>) makes it louder, rawer and
          a little stronger. "Back to stock" undoes everything.`,
      },
      {
        q: 'Why is it running rough and stumbling?',
        a: `Wear. Engines wear as they run, faster when worked hard, and much faster if you thrash them cold or while they're running in after a rebuild. A worn
          engine idles lumpy and shakes, and past a point it stumbles through misfires and dies now and then. A service (<kbd>V</kbd> at the toolbox) brings it back.
          The game keeps count of who did the damage, and the girls know.`,
        tip: 'Rev a cold engine hard and it wears several times faster. Let it warm up first.',
      },
      {
        q: 'My two-stroke seized. Is it ruined?',
        a: `No. Take the toolbox to it and strip it down (<kbd>F</kbd>), which frees it but leaves it worn, then sort out whatever caused it (straight petrol,
          too lean a jet, no oil). A rebuilt engine wants about ten minutes of gentle running before it's thrashed.`,
      },
      {
        q: 'What are the pods?',
        a: `Two accessory dashes, one analogue and one digital, that show revs, fuel and temperature for whatever they're fitted to. At a switched-off quad
          or the tractor with the toolbox, <kbd>Y</kbd> fits the analogue one, <kbd>U</kbd> the digital one and <kbd>O</kbd> takes it off.`,
      },
      {
        q: 'What do the little pictures on the dash and pods mean?',
        a: `A thermometer in water is the engine temperature, a petrol pump is fuel, an oil can is the oil, and two axles joined by a shaft is four-wheel drive
          (with a ring in the middle when the diff lock is in). A coil is the glow plugs, a battery is charging, a P in a circle is the handbrake. They light
          when something needs your attention and are dull grey otherwise. N and R stay as letters.`,
      },
    ],
  },
  {
    id: 'girls',
    title: 'Amy and Jess',
    entries: [
      {
        q: 'How do I talk to them?',
        a: `Look at one and press <kbd>E</kbd> to open her wheel. Move the mouse to a slice and click, or press its number. The first ring has a slice
          for each vehicle she could do something with; a vehicle's slice opens a second ring of what she could do with it. Right-click or Backspace
          goes back; <kbd>E</kbd> closes it.`,
      },
      {
        q: 'What can I ask them to do?',
        a: `Get on the back of a quad, start one, take you for a ride, follow you, drive one, stand by one, sit on the front rack, climb onto the tractor
          or into the UTV and the Land Rover, and more. The wheel only shows what makes sense at the time.`,
      },
      {
        q: 'How do I get a girl to drive me about?',
        a: `Ask her from the wheel ("Take me for a ride"), or just sit on the back of a parked quad (<kbd>B</kbd>) and wait: after a while a free girl
          comes over and drives you about in big loops. On the back, <kbd>E</kbd> opens a wheel to ask her to stop, slow down, speed up, let you off,
          let you drive, or coach her.`,
        tip: 'Sit on the back of a parked quad with B and wait: one of the girls will come and drive you.',
      },
      {
        q: 'Can I teach them to ride better?',
        a: `Yes. Each is better or worse at starting, the choke, cornering and mud. Riding on the back while she drives, the wheel has "Coach her" when there's
          something to coach. Advice at the right moment teaches her a good step; the same advice again straight away is nagging and annoys her. They also
          coach each other when they share a quad.`,
      },
      {
        q: 'Do they like me?',
        a: `They each keep a score of how you treat them, though you never see it: rides, talking to her, riding her favourite quad, washing it, favours done,
          and how much you leave her out while her friend gets your time. The one who likes you more is kinder and keener; the neglected one sulks, may
          refuse a request and takes quads off alone. Treat them evenly and they stay even.`,
      },
      {
        q: 'She asked me to do something. What was it?',
        a: `A favour: wash her quad, take her to the straw bales, or fetch the jerry can. Nothing on screen reminds you, but talk to her and she will.
          Do it and she likes you a lot more; leave it six minutes and it lapses and she's put out.`,
      },
      {
        q: 'Why have they stopped talking to each other?',
        a: `They've fallen out, after a bad race, one taking the other's quad, or too many digs. For a few minutes they won't share a quad and the banter
          turns sharp. Each tells you her side; her wheel then has "You're right" (she likes you more, the row lasts longer) and "Make it up" (shortens it,
          and doing it to both quickly ends it).`,
      },
      {
        q: 'Can I race them?',
        a: `Yes. Ride up to the start line by the yard and press <kbd>Enter</kbd>, or sit there with the engine running and Jess may dare you. Line up in the
          middle lane. A lap only counts if you go round the track. For a drag race, ride to the gravel strip in the middle of the field and press
          <kbd>Enter</kbd>, or answer Jess when she blips her throttle at you. They also race each other.`,
        tip: 'Press Enter at the start line by the yard to race the girls.',
      },
      {
        q: 'How do I get them back?',
        a: `Ring the bell on the post by the barn doors (<kbd>E</kbd>). They hear it anywhere on the farm, stop what they're doing and gather at the barn.`,
        tip: 'Ring the bell by the barn doors and the girls come back from anywhere on the farm.',
      },
      {
        q: 'Why won’t Amy ride that quad?',
        a: `She knows it has a fault, from her walk-round or her logbook. She won't ride it until it's put right, in the yard or at the bench. Jess rides it anyway.`,
      },
      {
        q: 'Jess has gone off with my quad.',
        a: `Get off a quad and leave it running, and Jess may hop on and ride off with it. She brings it back after a minute or so, muddier and with less fuel.
          Switch it off when you get off if you want it left alone.`,
        tip: 'Leave a quad running and Jess may ride off with it. Switch it off if you want it where you left it.',
      },
      {
        q: 'What do they do when I leave them alone?',
        a: `All sorts: wander off for a look round, start a quad, take one for a drive, race each other, go for a ride together, spin doughnuts, show off to you,
          line the quads up by the barn, leave a mug of tea on a rack, sit on the bales or the paddock fence on a fine day, run for the barn or climb into a Land Rover when it rains,
          warm their hands over a running engine, start a Land Rover and sit in it to warm up, or fetch jumpers when it's cold.`,
      },
      {
        q: 'Why is a girl sitting in the Land Rover?',
        a: `She's sheltering. When it rains, a girl stood about sometimes climbs into the UTV or a Land Rover (they have roofs) instead of running for the barn.
          On a cold day she may walk over to a Land Rover, start it and sit in it for a minute or two with the engine running. When the weather turns or she has had enough
          she gets out again, and switches off an engine she started herself. If you want the vehicle, just get in: she shuffles up and comes along.`,
      },
      {
        q: 'Can I hide from them?',
        a: `Climb the ladder to the hayloft inside the barn doors and press <kbd>E</kbd> at the stack of hay to duck into it. They can't find you while you're
          hidden and call for you now and then, until one finds you.`,
      },
    ],
  },
  {
    id: 'farm',
    title: 'Around the farm',
    entries: [
      {
        q: 'What’s in the barn?',
        a: `The workbench with the toolbox, the jump leads, the oil bottle and Amy's logbook; the jumper rack; straw bales; the ladder to the hayloft. A quad parked
          inside stays dry and cools more slowly, so it starts better later. Running an engine in there fills it with fumes.`,
      },
      {
        q: 'What’s beyond the grass field?',
        a: `East, over the cattle grid, a tarmac farm road between two stubble fields, a Dutch barn full of round bales, an old stone field shed, a muck heap and a
          water trough. South, through the field gate, a sunk green lane down to a ford and a rough hill pasture with gorse, bracken and a small oak wood, and a
          view over the whole farm from the top.`,
        tip: 'Ride to the top of the hill pasture for a view over the whole farm.',
      },
      {
        q: 'Do the girls go up the hill?',
        a: `Not on a quad. Following you, they come down the lane and through the ford, then wait at the foot of the hill. On the back with you, they tell you when it gets steep.`,
      },
      {
        q: 'What’s the bucket list?',
        a: `Press <kbd>Tab</kbd> for a notebook of about 60 things to do, each worth 1 to 3 points, ticked off as you do them. Things for vehicles that aren't on the
          farm this game are left off. The full list is further down this page, folded away.`,
      },
    ],
  },
  {
    id: 'big',
    title: 'The tractor, the UTV, the Land Rovers and the trailers',
    entries: [
      {
        q: 'How do I drive the tractor?',
        a: `Glow plugs to start (<kbd>K</kbd>, wait for GLOW to go out, <kbd>R</kbd>), the stop knob (<kbd>O</kbd>) to stop. Three gears with the clutch.
          <kbd>Q</kbd> and <kbd>Z</kbd> work the hand throttle, which also works from the ground beside it. Leave it in first with the hand throttle open and get
          off, and it creeps away on its own.`,
        tip: 'Leave the tractor in first with the hand throttle open and it walks off on its own.',
      },
      {
        q: 'How do I give the girls a hay ride?',
        a: `Back the tractor's drawbar up to the bale trailer's ring and press <kbd>J</kbd>. Stop with it hitched and the girls climb on by themselves.
          On the tractor alone, they may climb onto the rear mudguards.`,
      },
      {
        q: 'What can the little trailer do?',
        a: `Hook it to the tractor, the Land Rover or a quad with a rack (<kbd>J</kbd>), stand a jerry can, the toolbox or the jump leads in it (<kbd>E</kbd> at the tub),
          and tip it (<kbd>T</kbd>) when stopped. Jess may climb in against the rules.`,
      },
      {
        q: 'Will the girls drive into a trailer?',
        a: `No. Both trailers are solid to them now: on foot they walk round one, and driving they steer round a trailer parked in the way (but not the one
          they are pulling). You can't walk through them either. Quads and the tractor still pass through an empty trailer if you drive them into it.`,
      },
      {
        q: "Can I carry things in the UTV's bed?",
        a: `Yes. Hold a jerry can, the toolbox, the jump leads or the oil bottle, look into the bed and press <kbd>E</kbd> (the bed has to be down). It holds six.
          They ride along, and you pick one up again the same way as from the floor. Tip the bed (<kbd>T</kbd>, stopped) and everything slides out of the back.`,
      },
      {
        q: 'How do I use the tow chain?',
        a: `Look at the tractor and press <kbd>X</kbd> to take the chain, <kbd>E</kbd> on a stuck quad to hook it, then back the tractor up and drive off.`,
      },
      {
        q: 'Can the girls ride in the UTV and the Land Rover?',
        a: `Yes. Stop with the engine running and they may climb in, squabbling over the middle seat. Jess may ride in the UTV's bed, which is against the rules.
          They drive both too (Amy only once she's had her day on the tractor), and you can ride beside the driver.`,
      },
      {
        q: 'What is the other Land Rover, the 200TDi?',
        a: `A faded pastel green early-90s 90 station wagon with a rattly turbo diesel, a square back and the spare wheel on its rear door. Either Land Rover,
          both or neither may be on the farm. Start it like the UTV: <kbd>K</kbd>, wait for the GLOW lamp to go out, then hold <kbd>R</kbd>. It has a clutch
          and a five-speed gearbox (<kbd>1</kbd> to <kbd>5</kbd>) with synchromesh, so it never crunches, and it has no choke, hand throttle or starting handle. Its dash
          has a rev counter and a flashing BELT lamp. It uses red diesel only.`,
        tip: 'The 200TDi is a diesel: wait for the GLOW lamp to go out, then hold R. Red diesel only.',
      },
      {
        q: 'Do I have to wear a seat belt in the UTV or a Land Rover?',
        a: `Not to drive. The UTV and the 200TDi nag: with the key on and your belt off (or nobody in the driver's seat at all) the BELT lamp flashes and it bongs every
          couple of seconds (quieter the further you are) until you press <kbd>;</kbd> to do it up. The Series III is old enough to have no lamp and no bong, but it has belts if you want
          one (<kbd>;</kbd> too): a diagonal and lap belt in the driver's and the left-hand seat, a lap belt in the middle. The girls buckle up a moment after
          they sit down in either.`
      },
      {
        q: 'How do I turn the lights on in the UTV or a Land Rover?',
        a: `Sit in it with the key on and press <kbd>P</kbd>: dipped, then main beam, then off again. The UTV has one lamp on its dash that goes green for
          dipped and blue for main beam. The 200TDi has a green lamp for the lights and a blue one for the main beam. The Series III has no lights lamp, only the
          blue main beam one. The quads' lights come on with the engine and have no switch.`,
        tip: 'P switches the lights in the UTV and both Land Rovers: dipped, main beam, off.',
      },
      {
        q: 'How do I use the indicators and hazard lights?',
        a: `In the UTV or either Land Rover with the key on: <kbd>,</kbd> is left, <kbd>.</kbd> is right and <kbd>=</kbd> is the hazards (both sides). There is also a stalk on the left of the steering column that drops down for left and goes up for right, and a red hazard button on the dash that flashes with the hazards. The lamps at the
          front and back of that side flash orange and the relay ticks. The Series III has one green "<- ->" lamp on its dash; the UTV and the 200TDi have a separate arrow for each side. Press the same key again to switch them off. A left or right
          indicator also cancels itself once you have turned the wheel that way and straightened up, like a real stalk. The hazards stay on until you press <kbd>=</kbd>.`,
        tip: "Comma and full stop are the left and right indicators in the UTV and Land Rovers, equals the hazards.",
      },
      {
        q: 'Do the UTV and Land Rovers have a reverse light?',
        a: `Yes. A clear lamp at the back lights up (the Series III has just the one, on the driver's side; the UTV and the 200TDi have one each side) when you select reverse with the key on: the lever on the UTV's console, or reverse gear in a Land Rover.
          Look over your shoulder (<kbd>C</kbd>) or watch someone else back up at dusk to see it.`,
      },
      {
        q: 'How do I put the Land Rover\'s handbrake on?',
        a: `<kbd>Space</kbd>, as on any vehicle. The lever between the seats comes up and the red BRAKE lamp on the dash lights; <kbd>Space</kbd> again lets it off.`,
      },
    ],
  },
  {
    id: 'secrets',
    title: 'Secrets',
    intro: 'Things the game never tells you. Each is folded away; open only what you want to know.',
    entries: [
      {
        q: 'What’s under the tarp at the back of the barn?',
        spoiler: true,
        a: `In about one game in five, the rusty quad: an old barn find, not run for years. Take the tarp off at the workbench, then do the three or four jobs it needs
          (from draining the varnished fuel to charging the battery, which takes about five minutes). It won't catch until every one is done. Try seeds 7, 8, 12 or 13.`,
      },
      {
        q: 'What happens round the back of the barn?',
        spoiler: true,
        a: `A girl who likes you a lot more than her friend, and hasn't fallen out with anyone, may ask you round the back of the barn. Say yes from her wheel. After twice,
          she asks you to meet her at her favourite quad, and after that she's yours for the game: her favour can't drop, and her friend sulks. The one thing she won't
          forgive is tipping a quad over with her on it.`,
      },
      {
        q: 'Why does each quad behave a bit oddly?',
        spoiler: true,
        a: `Quirks: each quad gets one to three each game. A fuel gauge that reads high or sticks, a temperature needle that never moves, a choke that creeps out with the
          shaking, a stiff fuel tap that needs working (press <kbd>F</kbd> a few times), a split seat, a horn that works when it likes, brakes that pull or squeal, or a
          flickering headlight. Nobody fixes them. Amy's logbook may mention them.`,
      },
      {
        q: 'Someone has been messing with my quads.',
        spoiler: true,
        a: `Pranks. While you're away, Jess turns off a parked quad's fuel tap or pulls its choke, and Amy hides the jerry can or the toolbox. Hidden things come back after ten
          minutes. The culprit gives herself away when you find out. A girl who likes you best never pranks you.`,
      },
      {
        q: 'Why is there an L plate on Amy’s quad?',
        spoiler: true,
        a: `Jess tapes it there to wind her up. Amy peels it off; Jess puts it back. Coach Amy well enough and she sticks it on the tractor herself, for good.`,
      },
      {
        q: 'Is there anything special about the yellow and the orange?',
        spoiler: true,
        a: `The yellow has a big-bore kit waiting at the workbench (job <kbd>8</kbd>): Jess's dream, about 18% more pull, more heat and much more wear. In about half of games
          the orange has a weeping coolant hose: watch for a green damp patch under it, and fix it at the bench (job <kbd>7</kbd>) before it boils over.`,
      },
      {
        q: 'Why does Jess call the green quad Grandad?',
        spoiler: true,
        a: `Early in a game Jess gives every quad a nickname, picked from a short list each time. Amy says she won't use them, and holds out for a while.`,
      },
    ],
  },
  {
    id: 'tinkerers',
    title: 'For tinkerers',
    entries: [
      {
        q: 'Is there a way to see what’s going on under the bonnet?',
        a: `The tuning panel (<kbd>&#96;</kbd>, the key above Tab) shows each vehicle's live state and faults, each girl's mood and skills, and every tunable number,
          with buttons to set things up or put them right. It releases the mouse but the game keeps running under it; click the game to carry on.`,
      },
      {
        q: 'Is there a console?',
        a: `Backslash (<kbd>\\</kbd>, the <kbd>#</kbd> key on a UK keyboard) opens a command line. <code>help</code> lists the commands. You can read and set any value
          (<code>vehicle.red.temperature 0.4</code>), move things (<code>tp red barn</code>), reset them, change the weather (<code>weather rain</code>), fly
          (<code>fly</code>) and switch the girls' autonomy and speech off.`,
      },
    ],
  },
];

// A note for every vehicle, keyed by spec id (QUAD_SPECS, EXTRA_SPECS and the tractor, UTV and Land Rover specs). The facts strip
// (engine, gearbox, tank, reverse) is generated from the spec; this is what a spec can't say.
export const VEHICLE_NOTES = {
  red: {
    blurb: 'The Honda-style farm quad: soft, steady and the smoothest of the lot, with a low warm idle, racks front and back and a pillion seat.',
    tips: ['Starts every game in 2WD: G for 4WD.', 'Reverse wants the bars turned as you press B.', 'Has an OIL lamp on its little dash.'],
  },
  blue: {
    blurb: 'The Yamaha-style farm quad: idles fast and keen, revs harder and higher, and has an LCD dash with fuel and temperature bars.',
    tips: ['Floods if you leave the choke on once it’s warming, so ease it off early.', 'U is the diff lock, which pulls hardest in the mud.'],
  },
  yellow: {
    blurb: 'A Blaster-style two-stroke sport quad. Weak low down, then comes on hard around 6,000 rpm and revs past 10,000, trailing blue smoke.',
    tips: ['Loads up its plug if left idling: blip the throttle.', 'Pre-mix only.', 'Room for one on a slim pad at the back.'],
  },
  green: {
    blurb: 'The Kawasaki-style workhorse: older, heavier and slower, with a big lazy four-stroke that idles low and lumpy and pulls hard low down.',
    tips: ['Has the winch: X to take the hook.', 'Takes an age to warm up and wants plenty of choke.', 'Always four-wheel drive.'],
  },
  orange: {
    blurb: 'An LT250R-style two-stroke race quad: lighter and lower than the yellow, revs to 11,500 and smokes like a chimney.',
    tips: ['Single race seat: nobody on the back.', 'Water-cooled, so it stays cooler, unless the hose is weeping.', 'Kill switch on the left bar.'],
  },
  kids: {
    blurb: 'A 50cc kids’ quad, two thirds the size of the others, that Jess insists on riding anyway.',
    tips: ['One seat, no reverse.', 'Pull-start as well as the key.'],
  },
  moto: {
    blurb: 'A sun-faded 50cc pit bike. Two wheels, one seat, and it leans into corners like a proper bike.',
    tips: ['Lean it to turn it.', 'Grab the brake mid-corner and the front tucks.', 'T picks it up when it goes down.'],
  },
  atc: {
    blurb: 'The neighbour’s worn-out old three-wheeler: one front wheel, two fat tyres, a taped seat and a rusty silencer.',
    tips: ['Pull-start only.', 'Tips over in a fast tight turn.', 'Lumpy and smoky at idle, and hard to start.'],
  },
  loan: {
    blurb: 'A smart new quad on loan for the day: fuel injected, starts on the button, idles smooth and quiet, and has almost no wear.',
    tips: ['Hardly needs any choke.', 'Full tank and a bit more power than the old farm quads.'],
  },
  tractor: {
    blurb: 'An old grey-and-red Fergie on red diesel: heavy, slow and strong, with three gears, a hand throttle and a lot of hours.',
    tips: ['Wait for the GLOW lamp before cranking.', 'The stop knob (O) stops it, not the key.', 'Pulls the bale trailer and the tow chain.'],
  },
  utv: {
    blurb: 'A green Gator-style side-by-side on red diesel, with a bench seat, a roll cage and a tipping bed.',
    tips: ['Reverse is the dash lever: B when stopped.', 'T tips the bed.', 'The key stops it, unlike the tractor.'],
  },
  landrover: {
    blurb: 'An old Series III 88-inch pick-up in Bronze Green with a white roof: a 2.25 litre petrol four with a lot of miles on it.',
    tips: ['First and second crunch on the move: nearly stop first.', 'A starting handle for a flat battery.', '] and [ work the hand throttle.'],
  },
  landrover200: {
    blurb: 'An early-90s Land Rover 90 station wagon in faded pastel green, the 200TDi: a rattly 2.5 litre turbo diesel, a square back with the spare on its door and a newer dash.',
    tips: ['Wait for the GLOW lamp before cranking.', 'Every gear has synchromesh: no crunching.', 'The belt lamp flashes and it bongs until you do your belt up.', 'Listen for the turbo whistling as it pulls, and chattering when you lift off.'],
  },
};

// A note for each girl, keyed by character id (characters.js).
export const GIRL_NOTES = {
  amy: {
    blurb: 'Blonde, navy polo. Careful, kind with an edge, and the one who knows what she’s doing with an engine.',
    traits: ['Checks the oil and walks round a quad before she rides it.', 'Won’t ride a quad she knows is faulty.', 'Hates two-stroke smoke.',
      'Keeps a true logbook of every fault on the bench.', 'Corners better than Jess.'],
  },
  jess: {
    blurb: 'Black hair, burgundy polo. Cheeky, competitive and braver behind the bars, and gets bored sooner.',
    traits: ['Takes quads off on her own, and yours if you leave it running.', 'Names the quads.', 'Loves the smoke, the noise and the mud.',
      'Better in mud than Amy, and never checks the oil.', 'Blames the quad.'],
  },
};

/** Every tip in the hand-written answers, for the start screen. */
export function faqTips(sections = FAQ_SECTIONS) {
  return sections.flatMap((s) => s.entries.filter((e) => e.tip && !e.spoiler).map((e) => e.tip));
}
