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
        q: 'Can I play with a gamepad?',
        a: `Yes. Plug in an Xbox, PlayStation, Switch Pro or similar pad, press any button on it so the browser notices it, and the start
          card says "Gamepad found". Press <kbd>Start</kbd> to play (and again to pause). The left stick walks and steers, the right stick
          looks, <kbd>RT</kbd> is the throttle and <kbd>LT</kbd> the brake, and they go in as far as you press them. <kbd>A</kbd> does what
          <kbd>E</kbd> does, <kbd>B</kbd> gets you off or puts things down. Press <kbd>H</kbd> or the pad's Select button to see them all.`,
        tip: 'Gamepad: Start plays, sticks move and look, RT is throttle, LT brake, A interacts.',
      },
      {
        q: 'How do I work the choke, the lights or the ignition on a gamepad?',
        a: `Click the right stick in (<kbd>R3</kbd>) and a ring of the jobs the buttons have no room for comes up: ignition, crank, choke,
          fuel tap, lights, indicators, 4WD, diff lock, seat belt, the bucket list and more. Point with the D-pad or the right stick,
          press <kbd>A</kbd> to do it, <kbd>B</kbd> to cancel. Cranking, the choke and the pull-start hold themselves for a moment, since
          they need holding; press any button to let go early.`,
      },
      {
        q: 'How do I change gear on a gamepad?',
        a: `On a vehicle with a clutch, hold <kbd>LB</kbd> (the clutch) and press up on the D-pad for the next gear and down for the one
          below; down from first is neutral. <kbd>RB</kbd> is reverse, as <kbd>B</kbd> is on the keyboard.`,
      },
      {
        q: 'The game does not see my gamepad. What now?',
        a: `Browsers only show a pad to a page once a button has been pressed on it, so press one with the game open. The console
          (<kbd>\\</kbd>) says on loading whether one was found, and says again when one is plugged in or taken out. Pads that report
          the "standard" layout work; an odd one may need switching to its Xbox mode.`,
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
        a: `It's the same farm, a day later. Each time you load the game is the next day: the same vehicles in the condition you left them, and
          the girls remembering some of what happened. Where everything is parked, the weather, the temperature, the time of day and the girls'
          moods are new each day. "New farm" on the start screen deals a whole new one: which vehicles (four to all thirteen), their fuel, faults,
          quirks and history.`,
      },
      {
        q: 'Where are all the vehicles?',
        a: `At most four start in the yard, the quad a girl is stood by among them. The rest have been left about the farm: by the gates and
          hedges, out in the field, by the track or out east by the Dutch barn and the field shed. The tractor, the UTV and the Land Rovers are always
          out on the farm. Press <kbd>M</kbd> for the map, which shows every one.`,
        tip: 'Only a few vehicles start in the yard: press M to see where the rest were left.',
      },
      {
        q: 'Does the game save?',
        a: `Yes, in your browser, every thirty seconds while you play and when you close or leave the tab. There's nothing to press. The start
          screen then says "Continue" with the day you're on. It's kept in this browser only: another browser, or a private window, starts a new farm.`,
        tip: 'The farm saves itself as you play: each time you load it is the next day.',
      },
      {
        q: 'How do I start again with a new farm?',
        a: `Press "New farm" on the start screen and say yes. The farm you had, with everything it remembers, is gone for good. Before you've played
          at all there's no button: you're on a new farm already.`,
      },
      {
        q: 'What does the farm remember from one day to the next?',
        a: `Each vehicle's hours and miles, its wear, any fault you didn't put right, what you set with the toolbox, its tyres, fuel, oil and coolant,
          where the pods are, and how far you got with the barn find. Overnight a battery runs down a little (flat, if you left the key on with the engine stopped) and half
          the mud dries and drops off. The bucket list keeps its ticks, the records board its bests (with "today" on any set today), and Amy's logbook
          its last forty notes, by day. The girls keep half of how much they like you and all you've taught them.`,
        tip: 'Leave the key on with the engine off overnight and the battery is flat by morning.',
      },
      {
        q: 'Do the girls remember a row?',
        a: `Yes. If they fell out and hadn't made up when you stopped, they start the next day cool with each other, and one more race or borrowed
          quad sets it off again.`,
      },
      {
        q: 'Does the romance carry on?',
        spoiler: true,
        a: `Once a girl is yours (the quad, after two trips round the back of the barn) she still is the next day. Trips round the back that hadn't
          got that far start again. Throw her off a quad and she's still off you the next morning; by the day after it's forgotten.`,
      },
      {
        q: 'Can I play the same farm again?',
        a: `Yes. The browser console prints the game's seed when it loads. Add <code>?seed=</code> and that number to the address and you get
          the same layout, weather and luck again, as a first day: a seeded game doesn't touch your saved farm and isn't saved. <code>?weather=rain</code> (or <code>sunny</code>, <code>overcast</code>, <code>drizzle</code>,
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
          4.5 m. The Series III Land Rover has a starting handle too (the 200TDi hasn't: it wants the leads). Running an engine charges its battery again, but by the revs: about ten minutes revved, much longer at idle. A jumped petrol engine
          with a weak battery dies again at the first stop unless you keep the revs up. Leaving the key on with it stopped drains it flat in about eight minutes.`,
        tip: 'Leaving the key on with the engine off flattens the battery in about eight minutes.',
      },
      {
        q: 'How do I bump-start a quad or Land Rover?',
        a: `Only a manual (the red, yellow, green and old three-wheeler, the tractor and the Land Rovers) can be bump-started, and it works with a flat
          battery. Key on (<kbd>K</kbd>), hold the clutch (<kbd>Shift</kbd>), pick second gear, and get it rolling downhill, pushed by a girl or towed
          on the chain. At a walking pace let the clutch out and the wheels turn the engine over until it fires. First gear turns it over at a
          slower roll but is harder to get going; third wants more speed. A two-stroke catches easily. A four-stroke wants the choke when it is
          cold, and a longer roll. If it does not catch, put the clutch back in and have another go.`,
        tip: 'Flat battery on a manual? Key on, clutch in, second gear, roll it, then let the clutch out.',
      },
      {
        q: 'Can the girls push me to start it?',
        a: `Yes. Sit in a manual that is not running, with the clutch in and second gear selected, and talk to either girl: "Push start it".
          She walks round to the back and pushes, switching the key on if you have not. When it is going fast enough Jess shouts "Now!" (Amy says
          it more quietly): that is when you let the clutch out. Jess pushes harder, Amy tires sooner, and a Land Rover is slow to get moving. She
          stops when it fires or when she has had enough.`,
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
        q: 'How do I go gently, or just give it a little throttle?',
        a: `Tap <kbd>W</kbd>. The throttle opens the longer you hold the key: a quarter at first, wide open a little over a second later, and it snaps shut
          when you let go. Short taps creep you along or blip the engine; hold it down for everything it has.`,
        tip: 'Tap W for a little throttle; hold it down for the lot.',
      },
      {
        q: 'Why won\'t the brakes work after the ford?',
        a: `Wet brakes barely bite. Drive through the ford or a deep puddle and for a few seconds the quad runs on when you brake. Keep dabbing
          <kbd>S</kbd> as you go and they dry quickly; just driving dries them in about half a minute. Brake early after water. The parking brake still holds.`,
        tip: 'After the ford the brakes are wet. Dab S as you ride to dry them.',
      },
      {
        q: 'Why does my quad drag, then clunk?',
        a: `Some quads have stood so long that a brake binds, as if the handbrake were half on. It drags until a few metres of riding free it with a clunk,
          and then it is fine. It is nothing you did, and there is nothing to fix.`,
      },
      {
        q: 'How do I brake gently?',
        a: `Tap <kbd>S</kbd>. The brake squeezes in the longer you hold the key: the first moment is only a light brake, and it reaches full braking
          about a second later. Let go and it comes straight off. Short dabs slow you gently; hold it down to stop hard.`,
        tip: 'Tap S for a little brake; hold it down to stop hard.',
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
        q: 'Will the girls ride the mini moto?',
        a: `Jess will. Ask her to drive it from the wheel menu and she has a go: slow and wobbly at first, braver the longer she is on it, and
          sooner or later she comes off on the grass and lies there laughing. The bike stays on its side until you pick it up with <kbd>T</kbd>.
          The next go is steadier and quicker, and she comes off less. Amy won't touch it and says so.`,
      },
      {
        q: 'Do I have to lean on the old three-wheeler?',
        a: `No, there's no key for it. Your weight goes to the inside of a corner as you steer, a moment behind the bars. Ease into corners and it stays up.`,
      },
      {
        q: 'Why did the old three-wheeler fall over?',
        a: `One front wheel and a tall seat. Turning hard over about 8 m/s would roll it, but you lean into the corner by yourself as you steer, and that holds it up to about 12 m/s. Faster than that, or with the bars flung over late, it goes. Slow down for corners.`,
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
          way. Take the toolbox to it and pump the tank out (<kbd>P</kbd> on a quad), then fill it with the right fuel. Water in the fuel is a different job: that one drains at the tap.`,
      },
      {
        q: 'Why is my quad coughing and cutting out, and what is the glass bowl on the tap?',
        a: `Probably water in the fuel. A jerry can left out in the rain collects some, and an old tank can have it too; the can's prompt says when it has.
          Water is heavier than petrol, so it settles in the little glass bowl under the fuel tap, which goes cloudy and brown as it fills. While there is
          room in the bowl the quad runs fine; once it is full the water gets to the engine and it misses, loses power, is hard to start and cuts out.`,
      },
      {
        q: 'How do I get water out of the fuel?',
        a: `Take the toolbox to the quad and press <kbd>G</kbd> (Drain the water at the tap). It lets the water out of the bowl, the tank and the carb, with
          a little petrol, and the quad runs again at once. Keep the cans under the barn roof or the lean-to when it rains and it will not happen. Amy
          spots it and says so; Jess blames the quad. A diesel has no bowl and no tap, so there is nothing to drain.`,
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
        q: 'Why are the girls muddy, and how do I clean them up?',
        a: `Riding behind a muddy quad splashes their jeans, the girl on the back most of all, and dry stubble throws dust in their faces and hair.
          Amy minds and says so; Jess thinks it is hilarious. It dries and flakes off slowly, quicker while they walk about, or you can
          hose them (hold <kbd>E</kbd> with the hose pointed at her) and take the consequences. Going round the puddles helps.`,
      },
      {
        q: 'Why is everything white, and how do I get the frost off the seat?',
        a: `On a freezing morning the grass has a frost on it and so do the seats. Drive or ride across the grass and your tyres melt a dark track
          through it, which stays melted. A seat clears when someone sits on it, in a few seconds, though it is a cold start to the day. As the
          day warms up the frost thaws, and on a cold evening it comes back after dark, on the grass and on any seat nobody is sitting on.`,
      },
      {
        q: 'Why is it snowing, and why is my quad sliding about?',
        a: `Now and then the day is a snowy one, on a frosty or cold day. Snow settles on the ground in patches that join up the longer it falls,
          and the seats turn white too (sit on one to clear it). Your tyres leave tracks that stay, but the quad grips less and drags more
          on snow, so brake early and take bends gently. It melts slowly if the day turns mild, and rain washes it away. A frosty start
          is harder in the cold, so use the choke.`,
        tip: 'Snow means less grip: brake early, take bends gently, and use the choke on a cold start.',
      },
      {
        q: 'What time is it?',
        a: `Look at the clock on the barn wall, past the end of the workbench, or the clock on a dash that has one. Each game starts at its own
          time, some in the morning and some in the afternoon, and the day runs on about twelve times faster than real time, so a morning
          start reaches dusk in about forty minutes and an afternoon one in ten or so. Beside the clock are a thermometer and a barometer: the
          barometer drops before rain comes on.`,
        tip: 'The clock on the barn wall tells you how long until dark; the barometer beside it drops before rain.',
      },
      {
        q: 'Why is it getting dark?',
        a: `The day goes on. Late in the afternoon the sun gets low in the west and the light turns golden, then it sets and the dusk fades into
          night, and the night stays for the rest of the game. It gets colder too, so a mild afternoon can end in a frost. In the dark the
          headlights really light the way, the barn light comes on, and the girls start saying they want to go in.`,
      },
      {
        q: 'Do the headlights actually light anything?',
        a: `Yes. A lit headlamp throws real light on the ground and on whatever's in front of it, as bright as that vehicle's lamps are: the old
          quads' lamps run off the engine, dim and yellow at tickover and brighter with the revs, and flicker on a rough engine. The Land
          Rovers and the UTV have a light switch. In daylight you barely see it; after dark it's the only way to see where you're going.`,
        tip: 'After dark, rev an old quad and its headlights brighten.',
      },
      {
        q: 'How do I get some light to work by in the dark?',
        a: `Ask a girl: "Light me up" on her wheel, after dark. She fetches something with headlights (a Land Rover or the UTV if there's one
          about, otherwise a quad), drives it round to a few metres off facing you, and leaves it running with the lights on. Most of the time
          she then moves over to the passenger side (or onto the back of a quad); otherwise she gets out and stands by it. Amy does it without
          being asked if she sees you working at a quad or a gate in the dark for a while. Ride off, walk away, or tell her "That'll do" on her
          wheel and she puts it away.`,
        tip: 'After dark, ask a girl to "Light me up" and she brings a Land Rover round to shine its lights on you.',
      },
      {
        q: 'Why do the girls want to go in?',
        a: `It's dark and getting cold. As the light goes they say so, and once it's dark they'd rather wait in the barn doorway or sit in a
          Land Rover with the heater on than stand about outside. Ask them out from their wheel and they'll still come.`,
      },
      {
        q: 'Does the weather matter?',
        a: `Yes. Rain wets the ground, and wet grass and especially wet mud are slipperier and the bogs worse. It's colder in the morning and after dark than
          in the afternoon. Cold days want more choke, longer to warm
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
          hardly goes. A sticking throttle lingers after you let go, then sticks for good. A dirty carb hunts and runs rough. Valve clearances that have worn wide make a four-stroke tick from the top of the engine. A stretched chain (the sport quad, mini moto and three-wheeler) slaps over bumps and can jump off. Worn engine mounts (on any vehicle, but you feel it most on the tractor, the UTV and the Land Rovers) shake more through the seat and clonk when you stab the throttle. The girls see what you can't:
          ride off and one behind you may shout about smoke or a soft tyre. Amy's logbook on the workbench records what she has found.`,
        tip: 'Read Amy’s logbook on the workbench: it is always true, unlike what Jess tells you.',
      },
      {
        q: 'Why does the tractor, the UTV or the Land Rover shudder, and why has it started clonking?',
        a: `Their engines sit on rubber mounts, so the engine rocks on its own: a shudder at idle, and a lurch as it starts and stops. That is normal. If it
          has got much worse and clonks when you go on or off the throttle, the mounts have perished. A quick fix with the toolbox (<kbd>M</kbd>) tightens them;
          the workbench renews them for good.`,
      },
      {
        q: 'What is that slapping from the sport quad, the mini moto or the old three-wheeler?',
        a: `Those three are chain driven. A chain oils off as you ride and stretches until it hangs slack, and a slack one slaps the chainguard over bumps. Left
          alone it gets worse until a handful of throttle makes it jump off the sprocket: the engine races and nothing drives the wheels.`,
      },
      {
        q: 'How do I put a chain back on, and how do I stop it coming off?',
        a: `In the yard, take the toolbox to the quad and press <kbd>N</kbd>: it goes back on the sprocket and gets a squirt of oil, enough to ride home. To take the
          stretch out, use the workbench's "Adjust and oil the chain" (the minus key): slacken the axle nuts, draw the axle back to about a finger of play, oil it
          a little and do the nuts up. Look at the chain first and it will tell you how slack and how dry it is. Done carelessly some of the slack comes back.`,
      },
      {
        q: 'Why is my four-stroke ticking, and what does the feeler gauge do?',
        a: `Every four-stroke has valves whose clearance wears wide over the hours, and the engine starts to tick from the top, louder the longer it runs and
          a touch weaker. Use the workbench's "Set the valve clearances" (the equals key): look with the feeler gauge first and it will tell you whether the
          gap is wide, right or too tight, then slacken the locknuts, turn the screws until the gauge just drags and do the locknuts up. Turn too little and it
          still ticks; turn too far and the valves are too tight, which makes no noise at all but means a hard start when the engine is hot and a loss of power.
          Set it again properly to cure either. Two-strokes have no valves.`,
        tip: 'A tick from the top of a four-stroke is the valves: set the clearances at the workbench.',
      },
      {
        q: 'It started on the leads and then died again when I stopped. Why?',
        a: `Idling hardly charges a battery, and under about 40% a petrol engine can't keep its spark going at idle. Keep the revs up for a few minutes
          (a fast idle is enough to start with, more is better) and it charges; the loan quad's, tractor's, UTV's and Land Rover's lamps run off the battery
          and slow it further, so switch them off. Amy will sit on the back and hold the revs for you. Jess will for a minute.`,
        tip: 'After a jump start, keep the revs up for ten minutes or it dies again at the first stop.',
      },
      {
        q: 'Why are the girls arguing about which quad shakes best?',
        a: `Each girl keeps her own count of how much each quad has shaken her, so each has a favourite, and they do not always agree. Now and then, stood about together, they
          compare: one asks, each names hers, and when they differ they argue and sometimes swap quads to settle it. Amy writes the two counts added together in her logbook on the
          bench, as "Buzz ranking".`,
      },
      {
        q: 'Why has she got off the quad to walk about, saying her bum has gone numb?',
        a: `She has been sitting on the back of a running quad that shakes for a long time. The harder it shakes, the sooner her legs go tingly and her bum goes numb.
          She gets off, walks it off, stretches, and gets back on. A smooth warm engine takes a long time to do it; a cold or rough one is much quicker.`,
      },
      {
        q: 'Why does she want me to take her over the cattle grid, or the bumpy way, or start the tractor?',
        a: `The girls like the shake. Now and then, when you are on foot near her, she asks you to take her over the cattle grid again (on the back of a quad you ride),
          to go the bumpy way (a few good jolts on rough ground, with her on the back), or to start the tractor so she can sit on its mudguard while it idles.
          Doing it pleases her; ignoring it is remembered, like the other favours.`,
      },
      {
        q: 'Why does she go and sit on the worn-out quad?',
        spoiler: true,
        a: `A worn, rough engine shakes more, and she likes it. When she is bored she sometimes goes and sits on the back of the roughest quad near her, starting it
          first if it is off. Jess admits it. Amy picks it just as often and never says why.`,
      },
      {
        q: 'Why does she not like it when I service her favourite quad?',
        spoiler: true,
        a: `A worn, rough engine shakes more, and the girls like the shake. If you service or put right the quad that is her favourite after it has gone rough, she
          minds. Jess says you have made it boring. Amy wanted it fixed, but will miss it. It is only a remark: nothing is held against you.`,
      },
      {
        q: 'Why is she sat on my quad (or in the Land Rover) while it warms up?',
        a: `A cold engine shakes about twice as hard as a warm one, and the girls like that. When one starts your usual vehicle for you, she often sits on it while
          it warms (on the back of a quad, or in the passenger seat of a Land Rover or the UTV) and sometimes asks first. She is a little disappointed when it smooths out, and slow to get off
          when you arrive. Say "No, I'll take it" if you would rather she didn't.`,
      },
      {
        q: 'Why does the back seat of the Land Rover bounce so much?',
        a: `Each seat rides on its own spring, and the 200TDi's back bench is over the leaf springs: soft, bouncy and slow to settle, so it comes down hard on a
          big bump. The UTV's bed has no cushion at all, so a big bump (the cattle grid, say) can throw whoever is in it off the floor. The pillion pad and the
          front rack are firmer. The front seats are the smoothest. Whoever is sat in a seat that slams may say so.`,
        tip: 'The 200TDi\'s back bench and the UTV\'s bed are the bumpiest seats; the front seats are the smoothest.',
      },
      {
        q: 'How do I get her to warm a quad up for me?',
        a: `Talk to her and choose "I'll be a minute". She starts your usual quad (or her favourite, or the nearest with a free back seat), sits on the back
          with it running and revs it now and then. If you take your time she starts sounding the horn, Jess sooner than Amy, and in the end she gives up and
          gets off. Come back and take the front, and she is already on the back.`,
        tip: 'Tell a girl "I\'ll be a minute" and she warms up your quad and waits on the back.',
      },
      {
        q: 'Why is she sat alone in the Land Rover with the engine running, and how do I get her out?',
        a: `She is sulking. It happens after a falling out goes badly for her, or when she feels you favour her friend. Look at the Land Rover and press <kbd>E</kbd>
          to knock on the window. Amy ignores the first knock, answers on the second and forgives you on the third. Jess revs the engine at you three times and then
          gives in. Don't knock too fast: three in a row and she is worse. Or leave her, and she gets out on her own after a few minutes.`,
        tip: 'A girl sulking in the Land Rover? Knock on the window with E, but not too fast.',
      },
      {
        q: 'Why is she sitting on the back of a quad that is running, with nobody riding it?',
        a: `That quad is hard to keep going (it took a few goes to start, it is worn out, or its choke creeps on) and she does not dare switch it off, because it
          might not start again. She holds a fast idle with a hand on the throttle and catches it if it falters. You can get on the front and ride it away, but
          if it was properly sick it may die once she lets go. If nobody comes she gives up after a few minutes and gets off.`,
      },
      {
        q: 'Why does she say she is on the back for the sound, when she is really enjoying the shaking?',
        spoiler: true,
        a: `It does buzz more on the back, and she knows it. Jess owns up if she sits there long enough. Amy only does if you come up to her after a long sit.`,
      },
      {
        q: 'How do I fix things?',
        a: `Pick up the red toolbox from the workbench, take it to a switched-off quad and press <kbd>E</kbd>. <kbd>T</kbd> pumps and patches the tyres,
          <kbd>R</kbd> swaps the belt, <kbd>L</kbd> oils the cable, <kbd>C</kbd> cleans the carb, <kbd>M</kbd> nips up the engine mounts, <kbd>N</kbd> puts a chain back on and oils it, <kbd>I</kbd> (held) cleans the air filter, <kbd>V</kbd>
          services it. These are quick fixes that leave a mild fault behind; for a proper job, use the workbench. Each fix does its job if there is one and
          otherwise says all is well, so it doesn't give a fault away.`,
      },
      {
        q: 'What can the workbench do?',
        a: `Drive into the yellow bay in front of it, switch off, look at the bench and press <kbd>E</kbd>. <kbd>1</kbd> to <kbd>9</kbd>, <kbd>0</kbd>, <kbd>-</kbd> and <kbd>=</kbd> pick a job: a new plug,
          clean the carb, fix a tyre, two-stroke oil, engine oil, repack a silencer, coolant, a big-bore kit, new engine mounts, a top-end rebuild for a two-stroke that has seized, adjusting and oiling the chain on the three chain-driven quads, or setting the valve clearances on a four-stroke. Each is a short list of steps; on a hold step keep
          <kbd>E</kbd> down and let go inside the green band. Too soon or too long botches it and the fault comes back a little. Amy helps; Jess heckles.`,
      },
      {
        q: 'What does the old spark plug tell me?',
        a: `How it has been running. The plug job lets you look at it: a black, sooty plug means it has been running rich (too much choke, a clogged air filter,
          too much oil in the mix), a pale one lean.`,
      },
      {
        q: 'How do I set one tyre\'s pressure?',
        a: `Open the toolbox on a switched-off quad. Under the rows is the tyre pump and gauge, with a reading for each wheel. Click <kbd>−</kbd> to let a
          little air out of that tyre or <kbd>+</kbd> to pump it up. Softer tyres grip better in mud, harder ones roll easier on the track.`,
      },
      {
        q: 'Why does it pull to one side and feel draggy?',
        a: `A tyre let down too far (under about 2 psi, shown in orange on the pump) squashes off its rim: the bars pull towards it and it drags. Pump it
          back up. A slow puncture does much the same, and the pump's reading shows it going down.`,
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
        a: `No, but it's a bench job. A seized engine won't turn at all, and the toolbox can't help: park the quad in the bay, switch off and pick "Rebuild
          the top end". Undo the head, ease the barrel off, look at the piston, fit the new piston and rings and put it back together, doing the head nuts up
          evenly. Then sort out whatever caused it (straight petrol, too lean a jet, no oil). A rebuilt engine wants about ten minutes of gentle running before
          it's thrashed. An engine that has only started to nip up can still be stripped down with the toolbox (<kbd>F</kbd>).`,
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
        q: 'What are they looking at?',
        a: `Whatever catches their eye: whoever is talking, a quad starting, stalling, backfiring or being revved nearby, a horn, something going
          past or tipping over, and you now and then. With nothing going on they look about. A bang turns their heads at once, and if it goes
          on behind them they turn round to see. Before they walk off anywhere they look where they are going first, and while they are busy
          (starting a quad, driving) they mostly watch what they are doing.`,
        tip: 'Rev a quad near the girls and watch them turn to look.',
      },
      {
        q: 'Why don\'t they look round at a quad just idling?',
        a: `They only turn for a quad being revved: someone opening the throttle so the engine climbs well clear of its tickover. An engine
          sat idling, even one that hunts up and down, runs rough or idles fast on the choke, is just noise in the background, and a gentle
          whiff of throttle doesn't count either. A good blip does, and the harder it goes up the rev range the more it catches the eye.`,
      },
      {
        q: 'Why does she do what she does?',
        a: `Because of what she wants. Each girl gets cold on a dull or wet day, lonely with nobody about, restless for a bit of excitement,
          tired from being on the go, and bored stood about with nothing to do. Every couple of seconds while she's free she weighs up what
          she could do (warm her hands on an idling engine, get into a cab, sit on the bales, take a quad out, put the kettle on, ask you a
          favour) against what she wants most, and does the best of it, with a whim now and then. Leave a quad idling near them on a cold
          day and they'll come and warm their hands on it.`,
        tip: 'On a cold day, leave a quad idling near the girls and they come to warm their hands.',
      },
      {
        q: 'Why did she say she was busy when I called her over?',
        a: `She was on her way to something she'd decided to do: a sit down, a cup of tea, a drive. Whatever you ask her takes her from it, and
          she says so. It stays on her mind for a couple of minutes, she's keener on it than before, and when she gets back to it she says so.`,
      },
      {
        q: 'Why do the girls go and stand together?',
        a: `They're friends. A girl who wants company and sees her friend stood about a little way off goes over to her (and often says so),
          and the two stand and talk, facing each other. When one sets off for a look round, a sit down or a cup of tea, the other may tag
          along a step behind. Amy tends to follow Jess about to keep an eye on her; Jess can't stand on her own for long. Fallen out, they
          keep apart.`,
        tip: 'Walk up to the girls stood talking and they turn a little to let you in.',
      },
      {
        q: 'Why do they turn when I walk up to them?',
        a: `Stood talking together, the two open up to let you in: each turns a little from facing her friend towards you, so the three of you
          face the middle. Walk off and they turn back to each other.`,
      },
      {
        q: 'Why does she kick the tyres, or wipe the seat?',
        a: `Stood about, the girls pass the time with whatever is next to them. Beside a quad, Jess gives a tyre a kick and Amy wipes the seat
          down. On a cold day they rub their hands, in bright sun they shade their eyes, when a shower is coming on they look up at the sky,
          and now and then they check their phones (Jess far more than Amy).`,
        tip: 'Stood by a quad, Amy wipes its seat down and Jess kicks its tyres.',
      },
      {
        q: 'Why did she cover her ears, or flinch?',
        a: `They react to what happens near them. A backfire or a bang makes them flinch, a quad leaping forward right by them makes them hop
          back, and revving flat out beside them makes Amy cover her ears (Jess likes the noise). A quad going over gets a gasp, a good jump a
          cheer (Jess throws her arms up, Amy claps), and Amy turns away from two-stroke smoke.`,
        tip: 'Land a jump where the girls can see it and Jess will cheer.',
      },
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
        q: 'Why does she say I braked hard?',
        a: `With a girl on the back, it counts as braking hard when you keep the brake on hard for a moment from more than walking pace and lose a
          good bit of speed. A quick dab doesn't count, however sharp. Amy notices a little sooner than Jess. Tap <kbd>S</kbd> rather than holding it to
          slow down gently.`,
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
        q: 'Why won\'t the girls race when I ask?',
        a: `When you press <kbd>Enter</kbd> they drop what they are doing, find a quad and set off, so it should only take a few moments. If they can't, the game
          tells you why after about fifteen seconds: one of them is carrying something or getting off a quad, there's no quad free for her (the one you're on is
          never offered, and the little ones belong to one girl), a race is already on, or you've rung the bell. The lap race needs both of them, and two different quads; the drag race and the hill climb
          need only one. Ride up to the start line first: the lap race by the yard, the drag race at the gravel strip, the climb at the cones.`,
      },
      {
        q: 'How do I time a run up the hill?',
        a: `Go down the lane and across the ford to the hill pasture. Just past the stream there are two pairs of big orange cones: ride up to them on a quad and press
          <kbd>Enter</kbd>, then ride through them when you're ready. The clock runs from there. Go between the cones of each checkpoint in order (a cone
          either side, two on the way up) and on through the two pairs at the finish near the top. Anywhere between the cones counts, so the line is yours: the gentler ground in the east
          is the easy way, the steep banks in the west are quicker if you dare. Your time goes up as a toast, and the best ones go on the board in the barn.`,
        tip: 'Press Enter by the orange cones past the stream, then ride through them to time a hill climb.',
      },
      {
        q: 'Why did my hill climb stop counting?',
        a: `You're out if you get off or stall for ten seconds, or take more than two and a half minutes. Missing a gate (going round outside its cones, or
          skipping one) doesn't count it, so go back through. Press <kbd>Enter</kbd> at the start cones again to try another run. Pressing it also asks one of the girls to race you up, in the dark too.`,
      },
      {
        q: 'Where are the records kept?',
        a: `On the second chalkboard inside the barn, on the back wall next to the jobs board: the best lap of the track, drag run, hill climb and longest jump on the farm,
          and who set it. Press <kbd>E</kbd> at either board for a close view. You're told when you set a record, and when it's your best on the quad you're on.
          The girls set them too. They're kept from day to day, and one set today says so; only a new farm clears them.`,
        tip: 'The records for laps, drag runs, the hill climb and the longest jump are on the chalkboard in the barn.',
      },
      {
        q: 'Do the girls climb the hill too?',
        a: `Yes. In their free time Jess (more often) and Amy ride down to the cones past the stream, wait a moment and go up against the clock. They say
          something at the top, or when their quad dies on a bank, and whoever's near the top times you when you finish.`,
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
          line the quads up by the barn, leave a mug of tea on a rack, sit with you on the rock at the top of the hill with a flask, sit on the bales or the paddock fence on a fine day, run for the barn or climb into a Land Rover when it rains,
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
          view over the whole farm from the top. The sheep graze there.`,
        tip: 'Ride to the top of the hill pasture for a view over the whole farm.',
      },
      {
        q: 'Are there any animals?',
        a: `A flock of sheep on the hill pasture, past the stream. They graze, wander about, bunch up and call to each other now and then. Come close and they move off, further away the faster you are going, and the rest of the flock runs with them. You can't hurt them, and for now there's nothing to do with them but watch.`,
        tip: 'Ride up the hill pasture to find the sheep. They move off from a quad.',
      },
      {
        q: 'How do I have tea at the top of the hill?',
        a: `Ride up the hill pasture with a girl to the flat rock at the very top, by the far hedge. Get off, stand by the rock and press E. She gets off her quad if she is on
          it, sits on the rock and pours two mugs from her flask. Stay close and look at the view for about forty seconds and she will say a few things about it, and about
          the weather. A girl stood about up there when you arrive may suggest it herself. Finish the cup and she likes you a little more.`,
        tip: 'Take a girl to the rock at the top of the hill, get off, and press E for a flask of tea.',
      },
      {
        q: 'Why won’t she pour the tea, or why did she stop?',
        a: `It is off in rain and after dark, because the view is the point. Stand within about ten metres of the rock: walk away for a few seconds and she packs up,
          a bit put out. She also needs to be near you and not busy with something else. A cold day is better for it, and the girl who likes you more has a quieter line.`,
      },
      {
        q: 'Why do the sheep run away?',
        a: `They don't like quads, girls or you coming close, and a fast quad worries them from much further off than a slow one. Stop and keep quiet, and they go back to grazing within a few seconds.`,
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
        q: 'How do I load a quad onto the bale trailer?',
        a: `Stand by the back of the trailer and press <kbd>T</kbd> to fold the ramps down. Switch the quad off (it can't be running, ridden or tipped over) and hold <kbd>X</kbd>
          within reach of the ramps: the trailer's winch drags it across to the foot of the ramps and winds it up. Or line it up straight on the ramps and hold
          <kbd>V</kbd> to push it up yourself, and it rolls back if you let go. The tractor, the UTV and the Land Rovers are too big.`,
        tip: 'Ramps down with T, switch the quad off, hold X to winch it on.',
      },
      {
        q: 'How do I strap a quad down, and get it off again?',
        a: `Look at the quad once it's on the bed and press <kbd>E</kbd>. Press <kbd>E</kbd> again to undo it. To get it off, undo the strap, then hold <kbd>Shift</kbd> and
          <kbd>X</kbd> and the winch lowers it down the ramps. Fold the ramps up with <kbd>T</kbd> once it's strapped and you're ready to go.`,
      },
      {
        q: 'Why did the quad slide about on the trailer?',
        a: `It wasn't strapped. An unstrapped quad slides forward when you brake hard and back when you pull away hard, and with the ramps down it can go straight
          off the back. Strap it down with <kbd>E</kbd> before you tow it home behind the tractor.`,
      },
      {
        q: "Why won't the ramps fold up, or the winch take my quad?",
        a: `The ramps can't fold up with a quad on them or being winched to them: get it all the way up, or off. The winch only takes a quad that is switched off, with
          nobody on it, upright and not hooked to the green's winch or the chain, within about seven metres of the foot of the ramps with the ramps down.`,
      },
      {
        q: 'What can the little trailer do?',
        a: `Hook it to the tractor, the Land Rover or a quad with a rack (<kbd>J</kbd>), stand a jerry can, the toolbox or the jump leads in it (<kbd>E</kbd> at the tub),
          and tip it (<kbd>T</kbd>) when stopped. Jess may climb in against the rules.`,
      },
      {
        q: 'What are the chalkboards in the barn?',
        a: `Today's farm jobs. Walk into the barn to the back wall and press <kbd>E</kbd> for a close look. Done jobs get a tick, and a bucket list
          entry when you've cleared the lot. At the moment the only job is the muck, but the board lists up to two a day. The records are on the board beside it.`,
        tip: 'The chalkboard in the barn lists the day\'s farm jobs.',
      },
      {
        q: 'How do I tell which day I am on?',
        a: `Look at the calendar on the barn's back wall, between the two chalkboards. Every day gone is crossed off in red and today is circled. A page
          is thirty days, then it turns over to the next month. The start screen's "Continue" button also says which day you are about to play.`,
        tip: 'The calendar in the barn crosses off each day and circles today.',
      },
      {
        q: 'How do I do the muck job?',
        a: `Hitch the little trailer to the tractor or a quad with a rack and park it by the muck heap in the east wheat field (within about five metres).
          Hold <kbd>E</kbd> at the trailer, empty-handed, to fork muck in: the girls will have something to say about the smell. Drive onto the stubble, stop,
          press <kbd>T</kbd> (the tub tilts just enough and holds there) and drive off slowly. Muck runs out of the back in patches while you go slower than
          a brisk walk, and the job ticks off the board once there's a good strip down. A full tub is a drag on whatever pulls it.`,
      },
      {
        q: "Why won't the muck spread, or why did it all come out in a heap?",
        a: `It only spreads with the tub tipped up a little and you moving slowly (not stopped, not quicker than a brisk walk, or the tub lowers itself).
          It only counts on the stubble fields: on the road, the grass or the yard you waste it. Press <kbd>Shift</kbd>+<kbd>T</kbd> to tip the tub right up and the whole load slides out in one heap wherever you are.`,
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
          They drive both too (Amy only once she's had her day on the tractor), and you can ride beside the driver. The 200TDi has a back bench as well: ask a girl to "Get in the back", or look at its back half and press <kbd>B</kbd> to sit there yourself.`,
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
        a: `Quirks: each quad has one to three. A fuel gauge that reads high or sticks, a temperature needle that never moves, a choke that creeps out with the
          shaking, a stiff fuel tap that needs working (press <kbd>F</kbd> a few times), a split seat, a horn that works when it likes, brakes that pull or squeal, or a
          flickering headlight. Nobody fixes them, and a quad keeps its quirks from day to day. Amy's logbook may mention them.`,
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
