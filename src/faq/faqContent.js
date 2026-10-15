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
        q: 'How do I call a girl over, or tell her to stop?',
        a: `Look at her and press <kbd>E</kbd> to open her wheel. Whatever she is up to, it has "Come here" (she gets off whatever she is on and
          walks over to you), "Stop there" (when she is on her way somewhere) and "I'll be a minute" (she gets a quad going and waits on the back
          for you). The quads she could ride come on the wheel as well. If she is in the middle of something she will not drop, such as carrying
          something, the game says what she is doing instead.`,
        tip: 'Press E at a girl: "Come here" works whatever she is doing.',
      },
      {
        q: 'Why is an option on the girl\'s wheel greyed out?',
        a: `The wheel always shows every quad, Land Rover and car (the quads under "Quads", the rest under "Other vehicles"), so it never changes shape under you. An option she can't do just now is
          greyed with the reason underneath: she is busy, someone is driving it, it is running already, or it is her friend's car. Her own
          car is the one she drives. With you and her friend already sat in it, she can still take the wheel, as long as nobody is at it.`,
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
        q: 'Can I change the keys?',
        a: `Yes. Press <kbd>Esc</kbd> to pause and click "Change keys" on the card (it is on the start screen too). Click what you want to
          change, then press the key you'd like for it. If another job already has that key the two swap, so nothing is ever on two keys at
          once. Changed keys show gold, and the help page (<kbd>H</kbd>) shows your keys from then on. The game remembers them in your
          browser. "Put them all back" undoes the lot. <kbd>Esc</kbd>, <kbd>Tab</kbd>, <kbd>Enter</kbd>, the arrows, <kbd>Shift</kbd>,
          <kbd>Alt</kbd> and the tuning and console keys stay where they are. This page, and the odd line the girls say, still name the usual keys.`,
        tip: 'Pause with Esc and click "Change keys" to put any key where you like it.',
      },
      {
        q: 'I changed a key and now something does nothing. What happened?',
        a: `A key moved to a spare one leaves its old key doing nothing, and a key you moved onto another job's swaps with it. Open "Change
          keys" on the pause card: the ones you have moved are gold. Click one and press the old key again, or use "Put them all back".`,
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
        q: 'What has changed since I last played?',
        a: `The start screen lists what is new since the last time you clicked into the game: the six latest changes, with a link to the
          full list under "Recently changed" on this page. It is blank the first time you play, and when nothing has changed.`,
      },
      {
        q: 'Where is everything?',
        a: `Press <kbd>M</kbd> for the farm map. It shows the fields, hedges and their gaps, the track and its bogs, the barns, the road, the
          hill and the wood, with you, the girls, every vehicle, the trailers, the jerry cans, the toolbox, the jump leads and the oil bottle marked on it.
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
        q: 'Why do the hours on the dash go up so fast?',
        a: `The hour meter counts game time, the same as the clock on the dash: the day runs about twelve times faster than real life, so five minutes
          of the engine running adds an hour. The miles are real distance and aren't sped up.`,
      },
      {
        q: 'Why are the numbers on the odometer half-way between two digits?',
        a: `The drums on the older dashes turn like real ones: the last one rolls round steadily as you go, and each drum before it only moves
          as the one beside it comes round from 9 to 0. The LCD dashes just change.`,
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
          <code>fog</code>, <code>snow</code>, <code>storm</code>) forces the weather, <code>?temp=-3</code> sets the temperature in degrees, and <code>?outfit=plaid</code> (or <code>polo</code>, <code>doublePolo</code>, <code>cropTop</code>) puts both girls in that outfit.`,
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
        q: 'Where is the choke on each quad?',
        a: `Look at the left bar. On the red and the green it is a ridged black slider in a slot on the switch housing, under the CHOKE label: <kbd>Q</kbd>
          slides it towards the label and <kbd>Z</kbd> eases it back. The blue's is a lever hanging under its switch housing. The yellow's is not on the
          bars at all: it is a black knob with the choke symbol on the left of the carb, down in the open engine bay, so you have to be all but stopped to
          reach it, and it takes a hand off the bars. The fuel tap is beside it, on the tank's lower edge. The others have a knob or a lever of their own,
          so stand at the quad and watch what moves when you hold <kbd>Q</kbd>.`,
      },
      {
        q: 'How do I read the green quad’s speedo?',
        a: `It is a round dial on a bracket over the bars. The white figures round the edge are miles an hour, up to 40; the blue ring inside is
          kilometres an hour. The window at the top is the odometer, and the little lamps under the needle's hub are N for neutral and R for
          reverse, with the key beside them. It has no rev counter, fuel gauge or temperature gauge.`,
      },
      {
        q: 'It coughed and died going up a steep bank. Why?',
        a: `With the tank nearly empty, the petrol slops to the back of it on a steep climb and runs away from the tap, so the engine starves.
          The lower the tank, the gentler the bank that does it. It picks up again when the quad levels out (give it a moment to refill),
          or you can put the tap on RESERVE (<kbd>F</kbd>) or fill the tank. The cars and the tractor aren't bothered.`,
        tip: 'Nearly empty and dying on a bank? The fuel has run away from the tap. Level out, or fill up.',
      },
      {
        q: 'It keeps losing power at a steady throttle on a cold, damp day. Why?',
        a: `That is carb icing: petrol evaporating in the carburettor chills it, and on a cold, damp day (rain, or wet ground, and a few degrees
          above freezing) the moisture freezes round the throttle plate. It builds when you hold a steady part throttle and the engine
          slowly loses its pull. Give it a good blip (open the throttle quickly) and the ice breaks off, or stop and let it idle for a bit.
          A warm engine is slower to ice up. Amy knows what it is; Jess is sure you have broken it. The diesels have no carb to freeze.`,
        tip: 'Losing power at a steady throttle in the cold and wet? Carb ice. Blip the throttle, or stop for a minute.',
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
        a: `Three ways out. The yellow, orange, kids' quad, mini moto and old three-wheeler have a pull-start: with the ignition on, hold <kbd>O</kbd>
          for about half a second to a second and let go to yank (too short is weak, too long is botched). Or fetch the jump leads from the
          workbench, clamp the flat one (<kbd>E</kbd>) and then a running one (<kbd>E</kbd>), parked nose to nose since they only reach about
          4.5 m. The Series III Land Rover has a starting handle too (the 200TDi hasn't: it wants the leads). Running an engine charges its battery again, but by the revs: about ten minutes revved, much longer at idle. The leads are slow: a flat battery wants a minute or two joined to a running quad before it will turn the engine. Or lift the battery out, charge it on the workbench charger and put it back (see the battery questions below). A jumped petrol engine
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
        q: 'Why does the Series III crunch when I go into first or second?',
        a: `Those two gears have no synchromesh, so the box can't match them to the road for you. Nearly stop and they go in. To change down
          on the move, double-declutch: press the clutch (<kbd>Shift</kbd>) and go into neutral (<kbd>0</kbd>), let the clutch up, blip the throttle
          until the revs suit the speed (higher for second at a given speed than you might think), then clutch down and pick the gear. Wrong
          revs and it crunches and stays in neutral. Amy does it without thinking; Jess grinds it every time. Third and fourth are fine.`,
        tip: 'To change down into first or second on the move: neutral, clutch up, blip the throttle, clutch down, gear.',
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
        q: 'Why is the tractor (or UTV, or Land Rover) coughing and dying on a very frosty day?',
        a: `In a hard frost the diesel waxes: it goes thick in the filter. A diesel left out in the open, especially with the engine off, loses power, runs
          roughly and cuts out, and when it is really waxed it won't start at all. Nothing is broken. Warm it: a running engine melts the wax, and so does a
          milder spell or the sun. Quicker, take the diesel anti-gel from the ground by the coolant bottle (<kbd>E</kbd> to pick it up), look at the
          vehicle and hold <kbd>Y</kbd> to treat the tank. Treated fuel won't wax and clears what has. Keep it in the barn on a hard frosty night and it is
          fine. Petrol quads never wax.`,
        tip: 'A diesel dying on a hard frost has waxed. Warm it up, or treat the tank with the anti-gel by the coolant.',
      },
      {
        q: 'Why won\'t the throttle open (or shut) on a frosty morning?',
        a: `On a frosty morning a quad left out in the open can have a frozen throttle cable. Either it won't open past a crack, so the engine idles and
          you can't go anywhere, or it opens and then stays open when you let go. Don't fight it. Keep the engine running and the heat will free it in a
          minute or two (a warm engine is quicker), or wait for the sun, or the day to warm up. Quads in the barn or lean-to never freeze, and one left out
          in a hard frost with the engine off can freeze again. If it is stuck open, switch off.`,
        tip: 'Frosty morning and the throttle will not move? The cable is frozen. Let the engine run, or wait for the sun.',
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
        q: 'Why is the ford deeper than it was?',
        a: `The stream comes up with the rain. After a few minutes of steady rain it stands higher, runs browner and faster, and the ford is nearly twice as deep, so a quad drowns more easily in it. It drops back over ten minutes or more once the rain stops. Wait for it to go down, or cross very slowly. A girl nearby will tell you when it is up and when it has gone down.`,
        tip: 'After rain the stream rises and the ford drowns engines more easily. Wait, or go very slowly.',
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
        q: 'How do I stop a two-stroke fouling its plug?',
        a: `Treat the pre-mix with plug-saver. The green-labelled bottle stands a little way from the oil bottle by the petrol tank: carry the yellow
          can over and hold <kbd>E</kbd> on it for a few seconds. The prompts then call the pre-mix "with plug-saver". Fill a two-stroke from that can and
          its plug loads up far less when it idles, or when the pre-mix is a little oily. It lasts as long as the treated fuel does: top the tank up with
          ordinary petrol and it thins out, and once that fuel is burnt it is gone, so treat the can each time you mix it. It doesn't help a flooded
          engine or too much choke; for those, open the throttle while you crank.`,
        tip: 'Two-stroke plug keeps fouling at idle? Treat the pre-mix with plug-saver from the bottle by the oil.',
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
      {
        q: 'I put too much oil in. What happens?',
        a: `Keep holding <kbd>Y</kbd> by the bottle past the top mark and the pour carries on, so you can overfill it. Over the mark the dipstick says so, the
          exhaust smokes blue even on a light throttle, and the longer you work it the more oil gets blown into the air box, which leaves it sluggish and
          rich. Park away from the bottle and hold <kbd>Y</kbd> to let the extra out at the drain plug until it is back at the line; the air box dries out
          over a few minutes after that. A job at the bench does the same. Amy drains an overfilled one before she rides it.`,
        tip: 'Over the top mark on the dipstick? Hold Y away from the oil bottle to drain it back.',
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
        q: 'Why won’t the hose get the old dirt out of the corners?',
        a: `That dirt is years old. Every vehicle shows its age: paint and plastic rubbed through on the sharp edges, colour faded by the sun, rust
          starting in the folds of the metal and old dried mud packed into the nooks where parts meet. Washing takes off the day's mud, not the
          years. Fresh mud gathers in those same nooks first. Where hands and feet go is worn differently: the gear knob and the pedal rubbers
          polished smooth, the footboards rubbed, the edge of the seat you slide onto gone shiny. The newer vehicles (the loan quad above all)
          are clean; the three-wheeler and the barn find are the worst.`,
        tip: 'Hosing takes off today’s mud, not the years: the old dirt in the corners and the rust stay.',
      },
      {
        q: 'Does mud get inside the cars and Land Rovers?',
        a: `No. Mud builds up on the outside, on the wheels, arches, sills and doors, and the inside of the cab stays clean: seats, dash, carpet, and the
          painted door panels, pillars and roof lining too.`,
      },
      {
        q: 'Why are the girls muddy, and how do I clean them up?',
        a: `Riding behind a muddy quad splashes their jeans, the girl on the back most of all, and dry stubble throws dust in their faces and hair.
          Amy minds and says so; Jess thinks it is hilarious. It dries and flakes off slowly, quicker while they walk about, or you can
          hose them (hold <kbd>E</kbd> with the hose pointed at her) and take the consequences. Going round the puddles helps.`,
      },
      {
        q: 'Why has mud appeared on my view, and how do I wipe it off?',
        a: `On a quad, the mini moto, the three-wheeler or the tractor, riding close behind another vehicle on the mud, through a puddle or the ford
          at speed, or fast in hard rain splatters your view. Press <kbd>X</kbd> to wipe: the first wipe only smears it wide and thin, the second
          clears the smear, and raindrops go in one. Left alone it dries and drops off in a few minutes. The UTV, the Land Rovers and the cars
          have a windscreen, so they stay clean. Hanging back, or going round the puddles, keeps it off.`,
        tip: 'Mud on your view? Press X to wipe it. Once smears, twice clears.',
      },
      {
        q: 'Where do I get a helmet and goggles, and do I need them?',
        a: `On the hooks on the barn's south wall, inside the door: yours (red), your goggles, and the girls' own helmets when they are not wearing them.
          Look at a hook and press <kbd>E</kbd> to put yours on, and again to hang it back up. You do not need them, but Amy minds if you ride an open
          vehicle without a helmet and says so, and thinks better of you when you put one on. Goggles keep most of the mud off your view, and show a
          rubber frame round the edges. They stay on, and are remembered from one day to the next, until you hang them up.`,
        tip: 'Helmet and goggles hang inside the barn door. Press E at the hook. Amy minds if you ride without.',
      },
      {
        q: 'Why does Amy keep going on about my helmet?',
        a: `Riding a quad, the mini moto, the three-wheeler or the tractor without a helmet, moving, with Amy close enough to see, gets you a telling-off,
          and then not again for a couple of minutes. Fetch yours from the hooks in the barn and she will say thank you instead. Jess does not mind.`,
      },
      {
        q: 'Why are the girls\' helmets lying about?',
        a: `Each girl fetches her helmet from the hooks and wears it on an open vehicle, then mostly takes it off again as soon as she gets off: Amy
          puts hers neatly on the seat, Jess drops hers on the grass or wears it pushed back on her head. They pick it up again when they get on, if
          it is near. A helmet left on a seat falls off if the vehicle drives away, so if you take their quad, expect it in the grass. Amy would like it hung up.`,
      },
      {
        q: 'Why is the puddle white, and why did my quad slide across it?',
        a: `On a freezing day the puddles on the track freeze over. Ice grips like glass, so a quad on it slides and the wheels just spin: slow down
          before it, or go round. It won't hold for long. Each wheel that crosses it cracks it a little more, with a sharp crack and white lines, and
          then it gives way with a splash. The puddle under is an ordinary puddle, so slow down for that too. Thin ice, a heavy quad and speed
          break it sooner. The open water stays open for a minute or two, and when the day warms up the ice melts.`,
        tip: 'A white puddle on a frosty day is ice: no grip at all. Slow down, or go round.',
      },
      {
        q: 'Why is everything white, and how do I get the frost off the seat?',
        a: `On a freezing morning the grass has a frost on it and so do the seats. Drive or ride across the grass and your tyres melt a dark track
          through it, which stays melted. A seat clears when someone sits on it, in a few seconds, though it is a cold start to the day. As the
          day warms up the frost thaws, and on a cold evening it comes back after dark, on the grass and on any seat nobody is sitting on.`,
      },
      {
        q: 'Which way is the wind blowing, and what does it do?',
        a: `Each game has its own wind, a different way every time, and gusts come and go. Watch the exhaust smoke, the dust off the stubble or the rain and
          snow: they all lean downwind. The hedges and trees rock in it, and on a strong day with the wind blowing out through the barn's hay door (towards the east) its shutter is lifted
          off the wall and bangs about, which makes the girls jump. Foggy days are the stillest; rainy and overcast ones are the windiest.`,
      },
      {
        q: 'Why did hay blow out of the loft?',
        a: `On a gusty day with the wind blowing out of the hay door, loose hay lifts off the loft floor and drifts into the yard. It is only for show, and it
          doesn't happen again for a minute or two.`,
      },
      {
        q: 'Why is a door banging in the barn?',
        a: `That is the hay door's shutter, on the end of the barn. It sits hooked back against the wall, but a strong gust blowing out of the door lifts it off,
          and it slams back. It stops when the wind drops or turns.`,
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
        q: 'What is the mist in the barley field?',
        a: `On a cool, still morning (about six games in ten) a low mist lies in the barley field's hollow, past the east gateway, where the
          damp collects. It is thickest just after sunrise and burns off over the next couple of hours, sooner if the day is warm. Wind
          and rain blow it away, so if there is none to see, it was too late in the day, too breezy or too warm.`,
      },
      {
        q: 'Why was there a rainbow, and why can I not find one?',
        a: `A rainbow can follow a shower while the sun is out: look for it in the sky opposite the sun, once the rain has eased. The lower the
          sun, the taller the bow, so you will not see one around midday. It fades after a few minutes. It needs a real shower and clear sun,
          so it will not appear on a dull day or when it is still pouring.`,
      },
      {
        q: 'What time is it?',
        a: `Look at the clock on the barn wall, past the end of the workbench, or the clock on a dash that has one. Each game starts at its own
          time, some in the morning and some in the afternoon, and the day runs on about twelve times faster than real time, so a morning
          start reaches dusk in about forty minutes and an afternoon one in ten or so. Beside the clock are a thermometer and a barometer (the
          barometer drops before rain comes on) and, hung under them, the forecast board.`,
        tip: 'The clock on the barn wall tells you how long until dark; the barometer beside it drops before rain.',
      },
      {
        q: 'Does the weather change during the day?',
        a: `Sometimes. Most days stay as they began, but about two in five turn: a fine morning clouds over to rain by the afternoon, a grey
          one drizzles, a wet one clears, fog burns off. The sky eases across over a few minutes, the rain follows part-way through, and a wet
          turn cools the day a little. The barometer on the barn wall falls as it turns. Snow is the exception and stays what it is. A thunderstorm always blows over, within an hour or two of the game's clock.`,
        tip: 'Some days turn: a fine morning can go to rain by the afternoon. Check the board in the barn.',
      },
      {
        q: 'What happens in a thunderstorm?',
        a: `Rarely (about one game in thirty) the day starts as a storm: the sky goes dark, the rain is heavy, the wind gets up and lightning
          flickers across the sky with thunder after it, later the further off it was. The closer ones crack and make the girls jump. It
          never strikes anything and it can't hurt you or a quad, and it blows over to rain after a few minutes. Amy won't get on a quad
          or drive in it (she gets off one stood still, and says why); Jess loves it and would go out in it. The girls without
          somewhere to be run for the barn doorway as they do in any heavy rain, or get into a cab. Wait it out in the barn, or ride
          on with Jess if you like.`,
        tip: 'In a thunderstorm Amy will not ride: wait in the barn for it to blow over, or take Jess out.',
      },
      {
        q: 'How do I read the forecast board?',
        a: `It hangs in the barn under the clock, on the north wall past the end of the workbench. It has three chalk pictures, for the morning,
          the afternoon and the evening, with the part of the day it is now boxed and the ones gone by faded. Plan the jobs round it: do the
          muck before the rain it shows, or wait for the sun it promises. Amy reads it and tells you what it says; Jess hardly looks.`,
        tip: 'The forecast board under the barn clock shows morning, afternoon and evening. Plan the jobs round it.',
      },
      {
        q: 'Why was the forecast wrong?',
        a: `It usually isn't, but it is only a forecast: now and then it promises a change that never comes, or misses one that does. The sky
          and the barometer are the truth. When it turns on you, the girls say so, and Jess enjoys it.`,
      },
      {
        q: 'Why is it getting dark?',
        a: `The day goes on. Late in the afternoon the sun gets low in the west and the light turns golden, then it sets and the dusk fades into
          night, and the night stays for the rest of the game. Stars and the moon come out. It gets colder too, so a mild afternoon can end in a frost. In the dark the
          headlights really light the way, the barn light comes on (if the generator is running), and the girls start saying they want to go in.`,
      },
      {
        q: 'Are there stars and a moon at night?',
        a: `Yes. Once it is properly dark the stars come out, and the moon rises in the east, crosses the south and sets in the west. Each game
          has its own phase. A full moon comes up at about sunset, is highest at midnight and lights the farm well enough to ride by without
          headlights on a clear night; a thin crescent or a new moon gives hardly more than starlight. Cloud hides the stars and dims the moon,
          so on an overcast night you will want your lights.`,
        tip: 'A full moon on a clear night is bright enough to see the farm by; cloud hides it.',
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
          air-cooled quads overheat if you idle them or crawl through mud. The cars, Land Rovers, UTV and tractor have radiators and stay cool on any day, unless
          something is wrong with their cooling.`,
      },
      {
        q: 'Why is my quad losing power and rattling on a hot day?',
        a: `It's too hot and pinking. The air-cooled quads (red, blue, yellow and green) cook if left idling for ages in the sun or crawled through the mud
          with the throttle open. Ride along at a decent speed to cool it. The orange has a radiator and a fan, and stays cooler unless it's leaking.`,
      },
      {
        q: 'The temperature needle is in the red on a car or the tractor. What is wrong?',
        tip: 'Needle in the red on a car? Switch off. It is low on coolant or has a stuck thermostat.',
        a: `A healthy cooling system keeps the needle in the middle on every vehicle, all day, even idling in the sun. In the red means something is wrong: the coolant
          is low (look for a damp patch on the ground under it) or the thermostat has stuck shut, which can be there from the start or come on after a long run.
          It loses power and runs rough, steams if it gets worse, and past the top it cuts out and won't start until it has cooled for a minute or two. The red
          lamp or red symbol on the dash lights as the needle goes in. Switch it off and let it cool. Then take the coolant bottle (it stands by the oil bottle
          at the petrol tank), look at the vehicle with the engine off and cool, and hold <kbd>Y</kbd> to top up. With the radiator full, keep holding it and the
          coolant flushes through, which frees a stuck thermostat. A weeping hose keeps weeping until it is mended at the workbench, which also changes the thermostat.`,
      },
      {
        q: 'Why won\'t it let me pour coolant in?',
        a: `Not while the engine is running or still hot: the cap would spit scalding water. Switch it off and wait a minute or two. An air-cooled quad has no radiator to fill.`,
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
          hardly goes. A sticking throttle lingers after you let go, then sticks for good. A dirty carb hunts and runs rough. A worn clutch on a manual quad flares the revs when you pull away or climb, hardly drives, and smells hot. A split intake boot makes the idle rise and fall by itself and the exhaust pop when you lift off (not on a diesel). Valve clearances that have worn wide make a four-stroke tick from the top of the engine. A hard knock on a post or a bad landing can bend a track rod (the bars pull to one side and a front wheel points out of line) or a rim (a wheel wobbles). A stretched chain (the sport quad, mini moto and three-wheeler) slaps over bumps and can jump off. Worn engine mounts (on any vehicle, but you feel it most on the tractor, the UTV and the Land Rovers) shake more through the seat and clonk when you stab the throttle. The girls see what you can't:
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
        q: 'I hit a post and now it pulls to one side, or a wheel wobbles. What happened?',
        a: `A hard hit on a gatepost or wall, or a bad landing off the ramp, can bend a track rod or a rim. A bent track rod pulls the bars towards its side and
          you can see the front wheel pointing out of line; a bent rim makes its wheel wobble and costs you a little drive. The harder the knock, the likelier
          and the worse. Braking hard or bumping something slowly does no harm. You can't mend either in the yard: use the workbench's "Mend the crash damage"
          (the <kbd>[</kbd> key). Look it over first and it will tell you which wheel, then take the wheel and rod off, straighten the rod or fit a straight rim
          (firm, not forced) and do the nuts up. Done carelessly it comes back a little bent.`,
        tip: 'A pull after a hard knock is a bent track rod: the workbench straightens it.',
      },
      {
        q: 'How do I mend a bent rod or rim on the tractor, the UTV, a Land Rover or a car?',
        a: `The same way as on a quad, in the big bay in the barn's second span. Drive it in through the second door (the one nearer the generator), nose to the back
          wall, switch it off and use the bench with the toolbox on it. The big bay is the one with the trolley jack and axle stands beside it. The quads use the small bay
          in front of the bench. Jobs that don't apply (spark plugs on a diesel, a carb on the Corsa) are greyed out.`,
        tip: 'The tractor, UTV, Land Rovers and cars are mended in the barn’s big bay, through the second door.',
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
          <kbd>R</kbd> swaps the belt (using a spare from the rack), <kbd>L</kbd> oils the cable, <kbd>C</kbd> cleans the carb, <kbd>M</kbd> nips up the engine mounts, <kbd>N</kbd> puts a chain back on and oils it, <kbd>I</kbd> (held) cleans the air filter, <kbd>V</kbd>
          services it. These are quick fixes that leave a mild fault behind; for a proper job, use the workbench. Each fix does its job if there is one and
          otherwise says all is well, so it doesn't give a fault away.`,
      },
      {
        q: 'Why does the idle keep rising and falling, and why does it pop when I lift off?',
        a: `Most likely the rubber intake boot between the carb and the engine has split and is sucking in air it shouldn't. The idle drifts up and down by itself, it runs lean, and it pops in the exhaust when you come off the throttle at speed. It settles a little once you open up. It only gets worse, and the toolbox can't mend it: renew the boot at the workbench (spray water round it with the engine revving to find the split). Diesels have no carb boot.`,
        tip: 'An idle that rises and falls by itself and pops on the overrun is a split intake boot: renew it at the workbench.',
      },
      {
        q: 'Why do the revs flare and the quad hardly pull on my manual quad?',
        a: `The clutch plate is worn. Holding the clutch at the bite while you give it throttle, setting off up a hill with the pedal half up, or creeping along in first
          or second all rub the plate away, and a worn one slips under power: the revs rise, the quad doesn't go, and the girls say it smells hot. The more you slip it the quicker it goes, so
          let the pedal up cleanly once it bites. The toolbox can't mend it: fit a new clutch plate at the workbench (look at the plates first to see how bad they are). The automatic quads
          have a drive belt instead.`,
        tip: 'Revs flaring without the speed on a manual quad means a worn clutch: do not hold it at the bite, and fit a new plate at the workbench.',
      },
      {
        q: 'What can the workbench do?',
        a: `Drive into the yellow bay in front of it, switch off, look at the bench and press <kbd>E</kbd>. <kbd>1</kbd> to <kbd>9</kbd>, <kbd>0</kbd>, <kbd>-</kbd>, <kbd>=</kbd>, <kbd>[</kbd>, <kbd>]</kbd>, <kbd>;</kbd> and <kbd>'</kbd> pick a job: a new plug,
          clean the carb, fix a tyre, two-stroke oil, engine oil, repack a silencer, coolant, a big-bore kit, new engine mounts, a top-end rebuild for a two-stroke that has seized, adjusting and oiling the chain on the three chain-driven quads, setting the valve clearances on a four-stroke, renewing a split intake boot on a petrol engine, or fitting a new clutch plate on a manual quad. Each is a short list of steps; on a hold step keep
          <kbd>E</kbd> down and let go inside the green band. Too soon or too long botches it and the fault comes back a little. Amy helps; Jess heckles.`,
      },
      {
        q: 'Why did a girl wander off with her phone?',
        a: `Her phone rang. Now and then, when she has nothing to do, a girl goes off out of earshot to take a call, talks for a bit, and comes back to tell you the news. Stand near her when she comes back and she says it.
          Most calls are good news. A bad one leaves her in a mood for a few minutes (Amy longer than Jess): she is sulkier with you, more likely to say no when you ask and keener to take a quad off on her own.
          A little time, or a ride together, brings her round. Jess's phone goes more than Amy's.`,
        tip: 'If a girl comes back from a phone call in a mood, give her a few minutes. It wears off.',
      },
      {
        q: 'Why is a girl working on a quad at the bench?',
        a: `With a quad parked in the yellow bay and switched off, and the toolbox on the bench, a girl may decide to work on it herself, doing whatever it needs most (a puncture,
          a dirty carb, low oil in a two-stroke, a tired plug). Amy is the keener. She will stop and ask you for a hand: "Pass me the ten millimetre" or "Hold the torch". Go to the bench and press <kbd>E</kbd> when the prompt shows.
          Be quick and she likes you for it; ignore her and she fetches it herself, which takes longer and makes her likelier to slip. Amy writes what she did in her logbook.`,
        tip: 'Amy asks for the ten millimetre or the torch at the bench. Go to it and press E to help.',
      },
      {
        q: 'Jess has left a job half done at the bench. What do I do?',
        a: `She has a go, botches a step and asks you to finish it. Look at the bench and press <kbd>E</kbd>: the job carries on from the step she got to. Because she slipped it will come out
          rough, but she is pleased you finished it. Leave it for about four minutes and she gives up, and the quad is left as it was. Park a different quad in the bay and nothing happens until the job is cleared.`,
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
        q: 'Where do the girls drive when they go off on a quad?',
        a: `Mostly somewhere. More often than not a girl driving a quad on her own picks a place on the farm, such as the drag strip, the muck heap, the
          trough, the end of the road, the foot of the hill or a field, goes there by the gateways, stops for a moment and drives back. The rest of the time
          she potters about in loops near where she started.`,
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
          never offered, and the little ones belong to one girl), a race is already on, or you've rung the bell. The lap race needs both of them, and two different quads; the drag race, the hill climb and the cone course
          need only one. Ride up to the start line first: the lap race by the yard, the drag race at the gravel strip, the climb at the cones past the stream, the cone course at the cones in the field.`,
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
        q: 'How do I time a run round the cone course?',
        a: `Amy's cone course is a slalom of orange cones across the grass, west of the middle of the field, inside the track. Ride up to the first pair of cones on any vehicle and
          press <kbd>Enter</kbd>, then ride through them when you're ready. The clock runs from there. Weave through each pair of cones in order, left then right, and on through
          the finish pair. Every cone you knock down adds two seconds and every gap you miss adds five. Your score goes up as a toast, and the best ones go on the board in the barn.`,
        tip: 'Press Enter by the first orange cones in the field, west of the middle, then weave through them to be timed.',
      },
      {
        q: 'How do I stand the cones back up?',
        a: `Walk up to the first cones and press <kbd>E</kbd> when it says so. Amy also stands them up herself a few seconds after a run, and they are all put up again when anyone starts another.
          A cone only goes over if something is moving when it touches it.`,
      },
      {
        q: 'Do the girls run the cone course too?',
        a: `Yes. Amy and Jess both ride to it in their free time and weave round against the clock. Amy goes slowly and carefully. Jess goes fast and now and then
          aims for the cones on purpose, so her score has the penalties in it. Whoever is near the finish times you when you finish.`,
      },
      {
        q: 'Why did my hill climb stop counting?',
        a: `You're out if you get off or stall for ten seconds, or take more than two and a half minutes. Missing a gate (going round outside its cones, or
          skipping one) doesn't count it, so go back through. Press <kbd>Enter</kbd> at the start cones again to try another run. Pressing it also asks one of the girls to race you up, in the dark too.`,
      },
      {
        q: 'Where are the records kept?',
        a: `On the second chalkboard inside the barn, on the back wall next to the jobs board: the best lap of the track, drag run, hill climb, cone course and longest jump on the farm,
          and who set it. Press <kbd>E</kbd> at either board for a close view. You're told when you set a record, and when it's your best on the quad you're on.
          The girls set them too. They're kept from day to day, and one set today says so; only a new farm clears them.`,
        tip: 'The records for laps, drag runs, the hill climb, the cones and the longest jump are on the chalkboard in the barn.',
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
        q: 'Why did Jess yelp getting off a quad?',
        a: `A quad's silencer runs down its right side, and Jess sometimes swings off that side without looking. If the engine has been working or is still hot, her calf catches the pipe: she yelps, jumps back and says so. It doesn't hurt her for good, and she'll do it again another day. Amy always gets off the other side. Let a quad cool before you get off if you'd rather she didn't.`,
      },
      {
        q: 'What do they do when I leave them alone?',
        a: `All sorts: wander off for a look round, start a quad, take one for a drive, race each other, go for a ride together, spin doughnuts, show off to you,
          line the quads up by the barn, leave a mug of tea on a rack, sit with you on the rock at the top of the hill with a flask, sit on the bales or the paddock fence on a fine day (or doze on the bales when they are sleepy), run for the barn or climb into a Land Rover when it rains,
          warm their hands over a running engine, start a Land Rover and sit in it to warm up, fetch jumpers when it's cold or wax jackets when it rains, or get their helmets from the hooks.`,
      },
      {
        q: 'Why has a girl gone to sleep on the bales?',
        a: `Each girl gets sleepier as the day goes on (Jess sooner than Amy, and quicker still when she has been on the go), and the only cure is a doze.
          On a warm, bright, dry afternoon a sleepy girl sits on the straw bales, nods off and snores softly: you can hear it if you stand close.
          The sleepier she gets, the less she does and the longer she takes to think of anything, so a girl who has been sitting about doing nothing may simply be worn out.
          She wakes herself when she has rested, after a few minutes, or when the sun goes in. Amy swears she was only resting her eyes.`,
        tip: 'A sleepy girl dozes on the bales on a sunny afternoon. She wakes by herself when she has rested.',
      },
      {
        q: 'How do I wake a girl who is dozing?',
        a: `Gently: walk up, press <kbd>E</kbd> and talk to her. She wakes, a bit embarrassed, and climbs down. Or rudely: rev a quad, sound the horn or make some other loud noise close by and she jumps awake.
          Jess laughs it off. Amy minds, and is cross with you for a while afterwards, so wake her gently if you want her on your side.`,
      },
      {
        q: 'How do I get a photo of a girl asleep?',
        a: `Find one dozing on the bales, stand in front of her and press <kbd>5</kbd>. She sleeps on through the shutter, and the picture goes on the corkboard like any other. It also ticks "Caught napping" on the bucket list.`,
      },
      {
        q: 'Why are the girls wearing different coloured shirts from my last farm?',
        a: `Each girl's polo is the colour of the quad she likes best, which is dealt with the farm, so a new farm can mean new shirts.
          How many buttons each has undone is dealt with the farm too: Amy keeps hers done up or undoes the top one, and Jess can have
          anything from none to all of them undone. Both stay the same on that farm from day to day.`,
        tip: "The girls' polos match the quads they like best.",
      },
      {
        q: "Why are the girls wearing something different today?",
        a: `What they have on top is dealt each day. Most days it's their polo. Some days it's a plaid flannel shirt over the polo, either
          buttoned, with the polo's collar out over the shirt's, or worn open; some days a second polo, white or black and a size bigger, over their own, so you
          can see the one underneath at the collar and the sleeves; and now and then a collar is popped. Jess is likelier than Amy to
          pop hers. On a very warm day (over 20°C at its warmest) Jess may turn up in just a string crop-top. A day's outfit stays the
          same all day, and a jumper or a wax jacket goes on over whatever they're wearing.`,
        tip: 'The girls dress differently from day to day: a polo, a plaid shirt, two polos, or on a hot day a crop-top for Jess.',
      },
      {
        q: 'Why are the jumpers on the rack different colours from my last farm?',
        a: `Each farm has its own two jumpers on the rail in the barn, in colours dealt when the farm is new: grey and beige among
          them, or navy, bottle green, burgundy, mustard, oatmeal, charcoal, heather blue, rust or moss. They stay the same on that
          farm from day to day. The girls put one on when they've been cold or wet for a while and hang it back up once it's warm and dry.`,
      },
      {
        q: 'Where do the girls get their coats from?',
        a: `Two Barbour-style wax jackets hang at the far end of the clothes rack in the barn, past the jumpers. When it has been raining
          on a girl for a little while and she is stood about, she hurries over and puts one on, over her jumper if she has one. The front
          is done up two thirds of the way, so you can still see her polo's collar and her jumper at the neck. Once it has been dry for a
          couple of minutes she goes back and hangs it up. Each farm deals the coats' colours (olive, sage, navy or rustic brown) and keeps them.
          A girl in a coat doesn't get wet, so she wants shelter less.`,
        tip: 'When it rains for a while, the girls fetch wax jackets from the rack in the barn.',
      },
      {
        q: 'When do the girls put their hoods up?',
        a: `When it's raining properly and they have a coat on. The hood comes down again when the rain has nearly stopped, when they put a
          helmet on, and when they're under a roof: in the barn, or in a car, a Land Rover or the UTV.`,
      },
      {
        q: 'Why is a girl sitting in the Land Rover?',
        a: `She's sheltering. When it rains, a girl stood about sometimes climbs into the UTV, a Land Rover or one of their cars (they have roofs) instead of running for the barn.
          On a cold day she may walk over to a Land Rover, climb in, start it from her seat (choke and all, not stood out in the cold) and sit in it for a minute or two with the engine running. Only a flat battery makes her swing the starting handle outside. When the weather turns or she has had enough
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
        a: `The workbench with the toolbox, the jump leads, the oil bottle and Amy's logbook; the jumper rack; the hooks for the helmets and goggles; straw bales; the ladder to the hayloft. A quad parked
          inside stays dry and cools more slowly, so it starts better later. Running an engine in there fills it with fumes.`,
      },
      {
        q: 'What’s beyond the grass field?',
        a: `East, over the cattle grid, a tarmac farm road between two stubble fields, a Dutch barn full of round bales, an old stone field shed, a muck heap and a
          water trough. South, through the field gate, a sunk green lane down to a ford and a rough hill pasture with gorse, bracken and a small oak wood, and a
          view over the whole farm from the top. The sheep graze there. Beside the lane, with no hedge between, there is a wet meadow with a pond to the west and a rolling
          sheep field with a drystone wall to the east. North, through the gate in the grass field's north hedge, there is a wood with a narrow twisting
          track through it, the Hollow Run.`,
        tip: 'Ride to the top of the hill pasture for a view over the whole farm.',
      },
      {
        q: 'What is the Hollow Run, and how do I get to it?',
        a: `A track through the wood north of the grass field, nothing like the Home Loop (the dirt track in the grass field). Go through the gate in the grass field's
          north hedge (it starts tied open; look at it and press <kbd>E</kbd> to shut it or open it). A short muddy track leads in from the gate and joins the loop, which
          is narrower, twistier and hillier than the Home Loop, about 590 m round with the trees close on both sides. Along it there are four whoops (small humps one after another on the first straight), banked bends, a
          swell the middle rows climb over, two bogs, and logs lying across the track in pairs, a chicane to steer through. Ride it either way round. There is a pond in the
          wood, with reeds, that works like the meadow's: don't drive into it. There is no timed race on it yet.`,
        tip: 'The Hollow Run is the narrow, twisty wood track through the gate in the grass field\'s north hedge.',
      },
      {
        q: 'Why have the leaves turned orange, and why is the wood so slippery?',
        a: `About one game in six is an autumn day. The oaks, hazel and hedges turn orange and gold, leaves fall round you under the trees and the floor of the wood is
          deep in them, with conkers lying round the foot of every oak. Wet leaves are slippery: on the Hollow Run and between the trees you get less grip, a little
          when it is dry and a good deal after rain, so brake early and take the bends gently.`,
        tip: 'On an autumn day the wood is deep in leaves: they are slippery, especially when wet, so take the Hollow Run gently.',
      },
      {
        q: 'Why is Jess throwing conkers at me?',
        a: `On an autumn day, if Jess is stood about in the wood a few metres from you, she may pick up a conker and throw it. She is not a good shot, and it never
          hurts: a hit is a thock and a laugh, a miss a groan. Amy tells her off. Ride off or keep moving and they mostly miss.`,
      },
      {
        q: 'Why do the girls stop at the wood\'s gate?',
        a: `They will follow you through the gate, but not in among the trees on a quad. A girl following you waits just inside it until you come back out. They don't ride
          the Hollow Run themselves yet.`,
      },
      {
        q: 'How do I get to the pond and the sheep field?',
        a: `Go through the south gate and down the lane. The lane has no hedge on either side, and halfway down its banks are eased into a ramp each way. West is a wet meadow: a muddy track
          leads down to a pond with reeds and oaks round it, and the mud is deep enough to catch you out. East is a rolling field with two humps to climb, a drystone
          wall across it (go through the gap, or round the end) and thorn bushes. The girls follow you into both, but do not go there on their own yet.`,
      },
      {
        q: 'Are there any animals?',
        a: `Rabbits and pheasants round the hedges (see “What are the rabbits and pheasants for?”), and a flock of sheep on the hill pasture, past the stream, and a smaller one in the sheep field beside the lane, on the big side of its drystone wall. They graze, wander about, bunch up and call to each other now and then. Come close and they move off, further away the faster you are going, and the rest of the flock runs with them. You can't hurt them, and for now there's nothing to do with them but watch.`,
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
        q: 'What are the rabbits and pheasants for?',
        a: `Just the farm being alive. Rabbits sit about on the grass field, a few metres out from the hedges, and bolt for the hedge when you come close; the faster you come, the earlier they go. Pheasants lie hidden at the foot of the hedges and burst out with a clatter if you ride close or walk up to one. Amy jumps almost every time; Jess usually laughs. A new pheasant turns up somewhere else after a minute or two.`,
        tip: 'Pheasants lie in the hedge feet and burst out if you pass close. Amy jumps.',
      },
      {
        q: 'Where is the cat, and why is it on my quad?',
        a: `The farm has a tabby cat that prowls the yard and the barn. It likes somewhere warm: it will curl up asleep on an engine that has just been run, or on a seat in the sun, on any open quad. It keeps asleep however close you walk. To get it off, look at it and press E to shoo it; it hisses, hops down and runs, and keeps off that quad for a few minutes. Starting the quad or sitting on it also sends it packing. It is out and about on mild, dry days and goes into the barn when it is raining, snowing, frosty or dark.`,
        tip: 'The cat sleeps on warm engines and sunny seats. Look at it and press E to shoo it off.',
      },
      {
        q: 'Why did the cat run off?',
        a: `It does not like noise. A quad coming at it quickly, or an engine revved close to it, sends it running for a good fifteen metres or so, where it sits wary for a bit before it comes back. Start an engine it is lying on and it jumps off. The girls notice, and Jess tells you off.`,
      },
      {
        q: 'What do the girls think of the cat?',
        a: `Jess adores it and says so. The cat sometimes goes over to a girl who is stood about and rubs round her legs. Amy says she does not like cats, and she tells it off for rubbing on her, but give her a little while with it and she gives in. They both comment when it settles on a quad, and when you shoo it or frighten it.`,
        spoiler: true,
      },
      {
        q: 'Where is the dog, and how do I get her on my quad?',
        a: `Meg, the farm's border collie, keeps you company but has her own business: she sits, sniffs and mooches about near you, and comes after you only when you have gone a dozen metres or so (she runs to catch up if you ride off). To get her up, pull up on a quad with a rear rack (the utility quads and the farm ones, not the sports quads, the cars or the tractor) and stay still for a moment; she runs over and hops up on the rack. She hops down when you get off, or when a girl sits on the back. She keeps off the rack for a few seconds after she gets down.`,
        tip: 'Stop on a utility quad and Meg hops up on the rear rack. She follows you everywhere else.',
      },
      {
        q: 'Why is the dog chasing the quad, or Amy and Jess?',
        a: `It is what collies do. Now and then she goes after a quad a girl is riding, running alongside and barking until she tires of it, and she goes after the heels of a girl who is walking. She keeps to the side of a vehicle and nothing hurts her: if you drive at her she yelps and jumps out of the way.`,
      },
      {
        q: 'What do the girls think of the dog?',
        a: `Jess loves her and says so. Amy tells her off for chasing and for getting on your rack, and then goes a bit soft about it.`,
        spoiler: true,
      },
      {
        q: 'What is the ticking fence on the hill, and what happens if I touch it?',
        a: `It is an electric fence across the hill pasture, two strands of yellow tape on white stakes, with a gap in it for you to ride through (look for the pair of stout posts and the sign with the lightning bolt). The box on the hedge at the east end ticks and blinks. Touch the tape with the front or back of a quad, or walk into it, and it jolts you: the view shakes, you lose some speed, and whoever is on the quad yelps. A girl who sees it will say something about it. It only zaps once for each brush, so you won't be stuck in a loop.`,
        tip: 'The fence across the hill pasture is live. Go through the gap by the sign, not the tape.',
      },
      {
        q: 'How do I get past the electric fence?',
        a: `Ride through the gap between the two stout posts, the one with the sign. It is wide enough for a quad, and it is where the hill climb goes. The tape runs from the wood in the west to the hedge in the east, so use the gap.`,
      },
      {
        q: 'Why is Jess daring me to do things?',
        a: `She gets restless. Now and then, with you in earshot, she dares you to jump the ramp in the field, take the ford flat out, touch the electric fence, or ride the mini moto down the steepest bank on the hill pasture. You do not have to answer: just do it, within about two minutes. Do it and she cheers, likes you a little more and Amy a little less. Leave it and she calls you a chicken, and that is all. Amy has her say either way, and checks you are all right if it goes wrong.`,
        tip: 'Jess dares you now and then: the ramp, the ford, the fence, the mini moto on the big bank. Just do it.',
      },
      {
        q: 'What counts as taking a dare?',
        a: `The ramp: a proper jump off it, in the air for half a second or more, landing counted even if you fall off. The ford: through it at a good speed on a quad, not wading. The fence: it has to jolt you or the quad you are on. The bank: on the mini moto, down the steepest bank on the hill pasture (the big one the fence runs along), rolling and upright. The mini moto dare only comes up if the mini moto is on the farm. Each one goes on the bucket list.`,
      },
      {
        q: 'How do I open and shut the gates?',
        a: `Get off, look at the gate and press E: it swings open or shut. There are three: the field gate in the south hedge (it starts tied open), the big gate in the east hedge at the end of the farm road (it starts shut) and the gate just past the cattle grid (it starts shut). A shut gate is solid, and the girls won't route through the south or big gate, so shut the south gate and they stay on the farm side. It won't shut with a quad, a girl or you within a few metres of it.`,
        tip: 'Look at a gate on foot and press E to open or shut it.',
      },
      {
        q: 'Who is that on the lane, and why has someone come in at the gate?',
        a: `Beyond the big gate is a quiet public lane. A van, a Land Rover, a tractor or a UTV goes by now and then, less after dark. Now and then a visitor turns in: the post van, whose driver opens the gate, drives up to the barn and leaves a parcel by the door, or a neighbour who parks at the barn and stands about for a while. Jess waves at them, Amy less often. If you are in their way they wait, then hoot, so pull over.`,
        tip: 'The post van and neighbours come in at the big gate. Pull over for them.',
      },
      {
        q: 'Why is the barn dark, and why has the charger gone dead?',
        a: `The barn light and the bench charger both run off the generator along the barn's south wall, round the back, and it is switched off every morning. Walk up to it and press <kbd>E</kbd> to pull the cord. It may take a few pulls. If nothing happens at all and it only wheezes, the tank is empty.`,
        tip: 'The barn light and the charger need the generator running: pull its cord with E.',
      },
      {
        q: 'How do I refuel the generator?',
        a: `Switch it off (<kbd>E</kbd>), pick up the dark green diesel can, and hold <kbd>E</kbd> at the generator. It takes red diesel only, so the red petrol can and the yellow pre-mix can are refused, and it will not take fuel while it is running. The can fills at the diesel tank by the barn like the others. A full tank (5 litres) lasts about forty minutes, a little less while the charger is on. It puffs a little grey smoke from its stack while it runs, more when it catches and when the charger is on.`,
      },
      {
        q: 'Why did the generator stop?',
        a: `It ran out of diesel: the lights go out, the charger stops and a girl nearby will say so. Fill it from the diesel can and pull the cord again. The fuel in the tank is kept from one day to the next, but the generator itself is always off in the morning.`,
      },
      {
        q: 'Will the girls start the generator for me?',
        a: `Sometimes. If the barn is dark, or a battery is sitting on the charger, a girl who is free may go and pull the cord, Amy more often than Jess. They cannot fill it, so if there is no diesel in it they leave it.`,
      },
      {
        q: 'How do I charge a flat battery on the bench?',
        a: `Park the quad in the yellow bay, switch it off and open the workbench. The last job on the list is "Take the battery out": lift the seat, undo the terminals (hold <kbd>E</kbd>) and the battery is in your hands. Look at the charger on the bench (the blue box at the far west end) and press <kbd>E</kbd> to stand the battery on its mat. The charger runs off the generator, so start that first (see the question on the generator). The needle climbs and the red lamp comes on; about five minutes from flat the green lamp lights and a message tells you. Pick it up again with <kbd>E</kbd>, carry it back, open the bench and do "Fit the battery you are carrying", or just look at the quad and press <kbd>E</kbd>. It slows down near the top, like a real trickle charger.`,
        tip: 'A flat battery takes about five minutes on the bench charger. The needle shows how far it has got.',
      },
      {
        q: 'Can I take a battery out in the yard, and carry one in the UTV?',
        a: `Yes, for any vehicle with a starter. Take the toolbox to it, switched off, press <kbd>E</kbd> to open it and then <kbd>H</kbd>: the battery stands by your feet. Pick it up with <kbd>E</kbd> and carry it like a can: look into the UTV's bed and press <kbd>E</kbd> to stand it in with the rest of your things, take it to the barn, charge it, and bring it back. Fit it by looking at its own vehicle, switched off, and pressing <kbd>E</kbd>, or by pressing <kbd>H</kbd> in the toolbox panel when it is lying close. A battery belongs to its vehicle, so the prompt tells you if you have the wrong one.`,
        tip: 'Toolbox, then H takes a battery out. Carry it in the UTV bed.',
      },
      {
        q: 'Why is the quad completely dead with no clicking?',
        a: `Its battery is out. With no battery there is no dash and no starter noise at all (a flat one only clicks), and the jump leads do nothing. Fit the battery, or find where it is: the Vehicles tab says, and a battery you left in the barn is on the floor by the bench the next morning. A quad with a pull-start will still fire on the cord.`,
      },
      {
        q: 'Why does the bench say there is no spark plug (or tube, or piston) on the shelf?',
        a: `The parts rack on the barn's back wall, past the end of the workbench, is counted. A new plug, an inner tube, a drive belt, a main jet and a piston and rings are each used up when you fit one: a plug change or the top-end rebuild at the bench, or a service with the toolbox (<kbd>V</kbd>) which wants a plug, a tube for a puncture or a belt swap with the toolbox in the yard, and a main jet when you fit a size other than the stock one (put the stock one back and the other goes back on the rack). With none left the job is greyed out and says what is missing. Look at the rack and press <kbd>E</kbd> to see what is there and order a pack with <kbd>1</kbd> to <kbd>5</kbd>.`,
        tip: 'Spares are counted. Order more at the parts rack on the barn wall.',
      },
      {
        q: 'How do I order spare parts, and when do they come?',
        a: `Look at the parts rack in the barn (back wall, beyond the workbench), press <kbd>E</kbd> and press the number of the part to order a pack. About five minutes later the post van comes in at the big gate (if no one else is visiting, and only in daylight) and leaves a parcel by the barn door. Look at the parcel and press <kbd>E</kbd> to open it and put what is in it on the rack. An order you have not had by the end of the day is still on its way the next morning, and so is a parcel you have not opened. You can only order what the rack would have room for.`,
      },
      {
        q: 'How do I take a photo?',
        a: `Press 5, on foot or on a quad. The camera comes up, any girl in front of you reacts, and a moment later the shutter goes. The shot is pinned on the corkboard on the barn's back wall, south of the chalkboards. It throws away a shot of nothing but sky or a blank wall, and there is a short wait between shots.`,
        tip: 'Press 5 to take a photo. They get pinned on the corkboard in the barn.',
      },
      {
        q: 'Why did she put her hand up and tell me to put the camera away?',
        a: `Amy does that when she is feeling neglected, and now and then anyway; Jess does it rarely. Spend some time with her and she will pose instead. Jess is the one who pulls faces. The shot still counts, with a hand in it.`,
      },
      {
        q: 'Where do my photos go, and how many stay?',
        a: `On the corkboard in the barn, each at a random spot and a little crooked, with its day. Look at the board and press E for a bigger view that says when each was taken and who is in it. The last twelve stay up and the oldest comes down to make room. They are kept from one day to the next, with the rest of the farm.`,
      },
      {
        q: 'Why can\'t I ride out over the cattle grid?',
        a: `There is a steel gate across the farm road just past the grid, and it starts shut. Get off, look at it and press E to open it, then ride through. Shut it behind you if you like: the girls open it as they reach it and shut it again once they and you are well clear, but they leave a gate you opened for you to shut, and it won't shut with anyone within a few metres. The post van opens it and shuts it behind them each way.`,
        tip: 'The gate past the cattle grid starts shut. Get off and press E at it.',
      },
      {
        q: 'Why is the big gate open?',
        a: `Either you left it, or a visitor did: they shut it behind them most of the time, but about one visit in four they leave it open and Amy or Jess says so. Look at it and press E to shut it.`,
      },
      {
        q: 'Why do the rabbits stand still when I drive at night?',
        a: `Headlights freeze them. Put your lights on after dark and a rabbit in the beam sits up rigid with its eyes shining, until you are nearly on it, and then it bolts. Slow down and it will let you get close; swing the lights away and it goes back to what it was doing.`,
      },
      {
        q: 'Why do the sheep run away?',
        a: `They don't like quads, girls or you coming close, and a fast quad worries them from much further off than a slow one. Stop and keep quiet, and they go back to grazing within a few seconds.`,
      },
      {
        q: 'Do the girls go up the hill?',
        a: `Not on a quad. Following you, they come down the lane (and through the gateways into the meadow and the sheep field) and through the ford, then wait at the foot of the hill. On the back with you, they tell you when it gets steep.`,
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
        q: 'How do I reverse a trailer?',
        a: `Steer the back of what is pulling it towards where the trailer's back end is: for the trailer's back end out to the left, turn the wheel left
          while reversing ("left hand down"). Small movements, and straighten up before it gets away from you. If a trailer swings out of line it
          keeps going further, which is why it is hard. Going forward always pulls it straight again.`,
        tip: 'Reversing a trailer: steer the back of the puller towards the trailer\'s back end. Small movements.',
      },
      {
        q: 'Why won\'t it reverse any more, and the trailer is folded up against me?',
        a: `You have jack-knifed it: it folded to about sixty degrees and jammed against the tractor, quad or Land Rover. Pull forward a little and it
          straightens out, then try again with less lock.`,
      },
      {
        q: 'Why does Amy stand behind the trailer shouting at me?',
        a: `She has seen you reversing a trailer and is guiding you back: "left hand down", "right hand down", "straight now" and "stop" before it folds.
          Do as she says and it goes straight. Turn the other way and she tells you off, more crossly each time, until she gives up. Jess doesn't guide.`,
      },
      {
        q: 'What are the chalkboards in the barn?',
        a: `Today's farm jobs. Walk into the barn to the back wall and press <kbd>E</kbd> for a close look. Done jobs get a tick, and a bucket list
          entry when you've cleared the lot. The jobs are the muck and, if the tractor is about, the silage; the bonfire is not a job, but you can light one any time; the board lists up to two a day. The records are on the board beside it.`,
        tip: 'The chalkboard in the barn lists the day\'s farm jobs.',
      },
      {
        q: 'How do I tell which day I am on?',
        a: `Look at the calendar on the barn's back wall, between the two chalkboards. Every day gone is crossed off in red and today is circled. A page
          is thirty days, then it turns over to the next month. The start screen's "Continue" button also says which day you are about to play.`,
        tip: 'The calendar in the barn crosses off each day and circles today.',
      },
      {
        q: 'How do I save and carry on to the next day?',
        a: `The farm saves as you play, so you can simply close the tab. To do it properly, wait until the evening (it lets you from 17:00, about sunset), ring the
          bell by the barn doors to call the girls in, then walk into the barn and press <kbd>E</kbd> on the calendar on the back wall. A card comes up with Amy's
          logbook for the day, what you ticked off the bucket list and how far you rode, and the girls say goodnight. Press <kbd>E</kbd>, Enter or click to carry on:
          the screen fades to black, says the day is done, saves, and loads the next morning: click Continue to play it. A seeded game (<code>?seed=</code>) never carries on.`,
        tip: 'In the evening, ring the bell, then press E on the barn calendar to call it a day.',
      },
      {
        q: 'Why does nothing happen when I press E on the end-of-day card?',
        a: `It ignores a press for the first second, so the one that opened it does not skip it. After that <kbd>E</kbd>, Enter or a click carries on to the next day.`,
      },
      {
        q: 'Why won\'t the calendar let me call it a day?',
        a: `Its prompt says why. Either it is too early (from 17:00), or one or both girls are not back at the barn: ring the bell and wait for them. Your browser also has to be
          willing to keep the farm, or there is no next day to carry on to.`,
      },
      {
        q: 'How do I do the muck job?',
        a: `Hitch the little trailer to the tractor or a quad with a rack and park it by the muck heap in the east wheat field (within about five metres).
          Hold <kbd>E</kbd> at the trailer, empty-handed, to fork muck in: the girls will have something to say about the smell. Drive onto the stubble, stop,
          press <kbd>T</kbd> (the tub tilts just enough and holds there) and drive off slowly. Muck runs out of the back in patches while you go slower than
          a brisk walk, and the job ticks off the board once there's a good strip down. A full tub is a drag on whatever pulls it.`,
      },
      {
        q: 'How do I light the bonfire?',
        a: `Bundles of hedge cuttings lie along the inside of the south hedge of the grass field. Pick one up (<kbd>E</kbd>, empty-handed), carry it to the ring of stones south of the yard
          and press <kbd>E</kbd> to put it on the pile. Three make a pile; then <kbd>E</kbd> lights it. It takes about half a minute to get going and burns for nine minutes or so before it dies down to
          ash. Put three more on the ash to build another. Rain stops you lighting it and puts it out, damp air makes it smoky and burn faster, and a strong wind can blow out a young fire.`,
        tip: 'Three bundles of cuttings from the south hedge, on the ring of stones, make a bonfire.',
      },
      {
        q: 'Do the girls sit by the bonfire?',
        a: `Yes. Once it is blazing a free girl may fancy a sit on one of the logs round it, more so as it gets dark and cold, and both can sit at once. Stand by the fire and press <kbd>E</kbd> to ask
          the nearest free girl. She warms up, says a few things (more if you are close and she is fond of you) and gets up when she has had enough or the fire goes out. It is not kept overnight.`,
      },
      {
        q: "Why can't I put the brushwood on the fire, or why did it go out?",
        a: `You can only add to a pile that is not yet three bundles high, and not to one that is lit. Once it burns down to ash it takes a new pile. Rain puts a fire out and stops you lighting one, and wind
          blows out a young one. Riding through a lit fire does nothing worse than a warning, but it is a fire.`,
      },
      {
        q: 'How do I move the silage bales with the tractor?',
        a: `The old tractor has a bale spike on its back (when there's no trailer on the drawbar). With the engine running, <kbd>]</kbd> raises the arms and <kbd>[</kbd> lowers
          them; the red lever on the left of the seat shows where they are. Only the wrapped bales standing on their end beside the barn can be moved. Lower the spike to about the
          height of a bale's middle and reverse the point into it: it goes on the spike. Raise the arms to carry it, and go gently. To leave it, lower it to the ground (or onto
          another bale, up to two high) and drive forward. The farm remembers where you left them.`,
        tip: 'The tractor\'s bale spike: ] and [ raise and lower it, then reverse into a standing silage bale.',
      },
      {
        q: 'How do I do the silage job?',
        a: `When it's on the chalkboard, spike three of the wrapped silage bales beside the barn one at a time and leave them on the floor of the Dutch barn's open bay, out east
          (the bay with no bale stack in it). The job ticks off once the third is down.`,
      },
      {
        q: "Why won't the spike go into the bale, or why won't it lift?",
        a: `The point has to run into the middle of a bale that stands on its end, at about the height of its middle, so lower the arms first and line up before you reverse. A bale with another on
          top can't be spiked: take the top one off first. The bales lying on their sides (the ones the girls sit on, and the Dutch barn's stack) are fixed. The arms only move with the engine running,
          and the spike is taken off while a trailer is on the drawbar. You can't hitch one with a bale on the spike.`,
      },
      {
        q: 'How do I hitch a trailer with the bale spike on?',
        a: `Back the hitch up to the trailer's ring and press <kbd>J</kbd> as usual: the spike comes off with it (it says so), and goes back on when you unhitch. Put any bale down first.`,
        tip: 'Hitching a trailer takes the bale spike off, and unhitching puts it back. Press J.',
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
        q: 'How do I tow a dead quad with another quad?',
        a: `Look at the red or blue quad (the green keeps its winch on <kbd>X</kbd>) and press <kbd>X</kbd> to take the tow rope off its rack. Walk the hook to the dead quad and press
          <kbd>E</kbd> on it, then get on the towing quad and ride off gently. <kbd>E</kbd> on the dead quad unhooks it, and <kbd>X</kbd> puts the rope back. The rope stretches and goes slack, unlike the tractor's chain, and
          the dead quad has its brakes off, so it rolls on if you stop.`,
        tip: 'Tow rope: X at a red or blue quad, E on the dead one. Take up the slack gently.',
      },
      {
        q: 'How do I get a girl to steer the quad I am towing?',
        a: `With the rope hooked on, look at her, press <kbd>E</kbd> for her wheel and choose "Steer the towed quad". She sits on the dead quad, steers it after you and works the brake. Amy brakes early and keeps her eyes on the rope.
          Jess brakes later and now and then looks away, so if you stop sharply she may run into your back. "Get off the towed quad" lets her down again, and she gets off by herself if you unhook the rope.`,
      },
      {
        q: 'Why did she shout when I towed her?',
        a: `You took up the slack too fast and the rope snatched. Pull away gently so it goes tight slowly. If you stop suddenly with her on the end, she may run up into your back: slow down in good time.`,
      },
      {
        q: "Why won't the tow rope come off the quad, or hook on?",
        a: `The green quad's <kbd>X</kbd> is its winch, so take the rope from the red or blue one, with your hands empty and on foot. A trailer on the same quad's hitch has to come off first. The rope only reaches a few metres from the hitch
          and comes out of your hand if you go further or get on something.`,
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
        q: 'How do I turn the lights on in the UTV, a Land Rover or a car?',
        a: `Sit in it with the key on and press <kbd>P</kbd>: dipped, then main beam, then off again. The UTV has one lamp on its dash that goes green for
          dipped and blue for main beam. The 200TDi has a green lamp for the lights and a blue one for the main beam. The Series III has no lights lamp, only the
          blue main beam one. The girls' cars work the same way. Most quads' lights come on with the engine and have no switch.`,
        tip: 'P switches the lights in the UTV and both Land Rovers: dipped, main beam, off.',
      },
      {
        q: 'How do I put the red, blue or green quad\'s lights on main beam, or off?',
        a: `Press <kbd>P</kbd> while you ride it: it starts on dipped, then main beam (a longer, whiter beam), then off, then dipped again. The yellow rocker on
          the switch pod on the left bar is the lights, with OFF at the top and ON at the bottom, and the white one under it is HI and LO. They move as you press. The
          red rocker is the engine stop, showing RUN while the key is on, the round button is the starter (it goes in while you hold <kbd>R</kbd>), and the black
          slider under the pod is the choke (<kbd>Q</kbd> and <kbd>Z</kbd>): it slides along its slot. The 2WD and 4WD labels are by the rocker on the right bar
          (<kbd>G</kbd>). With the lights off the tail lamp is off too.`,
        tip: 'P on the red quad: dipped, main beam, off. Its pod\'s yellow and white rockers show which.',
      },
      {
        q: 'How do I switch the yellow quad\'s lights on and off?',
        a: `Press <kbd>P</kbd> while you ride it. It has a plain switch, not the others' three-way one: on (dipped) or off, and
          it starts on. The little rocker on the left bar, just in from the brake lever, is the switch, and it rocks as you press. With the lights off the tail
          lamp is off too. The pull-start is on <kbd>O</kbd>, not <kbd>P</kbd>, so the two don't clash.`,
        tip: 'P switches the yellow quad\'s lights on and off. Its pull-start is on O.',
      },
      {
        q: 'How do I put the blue quad\'s lights on main beam, or off, and where is its choke?',
        a: `Press <kbd>P</kbd> while you ride it: dipped, main beam, off, dipped again, as on the red. The grey rocker on the switch pod on the left bar is the lights,
          with HI at the top, LO in the middle and OFF at the bottom, and it moves as you press. The red switch under it is the engine stop and the grey button is
          the starter. The black lever hanging under the pod is the choke (<kbd>Q</kbd> and <kbd>Z</kbd>): it swings towards you as you apply it, and it is always in
          reach on the move. The lamp column to the left of the display shows H for going, R in reverse and P stopped in neutral, and DIFF.LOCK lights when the lock
          is on (<kbd>U</kbd>). With the lights off the tail lamp is off too.`,
        tip: 'P on the blue quad: dipped, main beam, off. The choke is the lever under the left pod.',
      },
      {
        q: 'How do I use the indicators and hazard lights?',
        a: `In the UTV, either Land Rover or the girls' cars with the key on: <kbd>,</kbd> is left, <kbd>.</kbd> is right and <kbd>=</kbd> is the hazards (both sides). There is also a stalk on the left of the steering column that drops down for left and goes up for right, and a red hazard button on the dash that flashes with the hazards. The lamps at the
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
    id: 'cars',
    title: "The girls' cars",
    entries: [
      {
        q: 'Whose are the two cars?',
        a: `The pale blue Fiesta is Amy's: an old Mk1, kept clean, with L plates on, because she is still learning. The red Corsa with the grey wing and the big exhaust is
          Jess's. They park side by side on the tarmac at the end of the farm road, in front of the Dutch barn, and they are always there.`,
        tip: "The Fiesta is Amy's and the Corsa is Jess's. They park at the end of the farm road, by the Dutch barn.",
      },
      {
        q: 'Can I drive their cars?',
        a: `Yes: look at one and press <kbd>E</kbd> to get in the driver's seat. They drive like the Land Rovers: <kbd>K</kbd> for the key, hold <kbd>R</kbd> to start,
          <kbd>Shift</kbd> for the clutch and the number keys for the gears (four in the Fiesta, five in the Corsa). The Fiesta has a choke (<kbd>Q</kbd> and <kbd>Z</kbd>) for a cold start;
          the Corsa is fuel injected, so it has none and sorts out a cold start itself. But they are their cars: see below.`,
      },
      {
        q: 'Why is Amy (or Jess) cross that I took her car?',
        a: `If she sees you drive off in it without her, she minds, and it costs you a little with her. Bring it back with something wrong with it, or stuck in the mud, and
          she minds more. Take her with you instead: ask her to get in first (look at her, <kbd>E</kbd>, and pick her car on the wheel), and she is happy to come, though she will tell you what she thinks of your
          driving. Amy hates you going fast in her Fiesta; Jess hates you dawdling in her Corsa, and neither likes you stalling it.`,
      },
      {
        q: 'Why does the car get stuck on the grass?',
        a: `They are road cars: front-wheel drive, low, and on road tyres. On the tarmac they are quick and easy, but on wet grass they slither, in mud they bog
          down almost at once, and they scrape over bumps a Land Rover wouldn't notice. The tractor can pull one out.`,
        tip: 'The girls\' cars are road cars: keep them on the tarmac, especially when it is wet.',
      },
      {
        q: 'Do the girls drive their cars?',
        a: `Yes, each her own and never the other's. Now and then one takes hers out down the farm road to the end and back, and you can ask her to from the wheel ("Drive it").
          Amy goes carefully. Jess does not. Her friend may climb in with her. They also sit in them out of the rain, like the Land Rovers.`,
      },
      {
        q: 'How do I turn the radio on?',
        a: `In either Land Rover or one of the girls' cars, press <kbd>I</kbd> with the key on. <kbd>Shift</kbd>+<kbd>I</kbd> turns it up and
          <kbd>Alt</kbd>+<kbd>I</kbd> turns it down; on a gamepad it is in the ring. There is one station, mostly talk with a tune now and then,
          and every radio on the farm plays the same thing. It goes quiet while the starter turns and when the battery is flat. Outside, you can hear
          one that has been left on from a few metres.`,
        tip: 'Press I in a Land Rover or a car, key on, for the radio. Shift+I louder, Alt+I quieter.',
      },
      {
        q: 'Why does the radio crackle and fade?',
        a: `Each set is different. The Series III has an old dash radio that picks up the engine, so it spits more the harder you rev, and the station
          drifts in and out. The 200TDi's is plainer. Amy's Fiesta has a cassette radio with a little warble, and Jess's Corsa a loud one with a
          lot of bass that holds the station well.`,
      },
      {
        q: 'Why did she turn the radio on, up or off?',
        a: `Jess switches it on and turns it up when she is sat in a vehicle with you, and Amy would rather hear the engine, so she turns it down and
          then off. Neither touches it for a while after you have, so if you turn it back on it stays on for a bit.`,
      },
      {
        q: 'Can I ride in their cars?',
        a: `Yes. While one of them is driving, look at the car and press <kbd>E</kbd> to get in beside her, or look at its back half and press <kbd>B</kbd> to get in the back. There are
          four seats, two in front and two behind, all with belts (<kbd>;</kbd>). The front seat tips forward to let people into the back, as they are both three-doors.`,
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
          (from draining the varnished fuel to charging the battery: lift it out at the bench, put it on the bench charger with the generator running, and fit it back). It won't catch until every one is done. Try seeds 7, 8, 12 or 13.`,
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
        a: `Quirks: each quad has one to three. A fuel gauge that reads high or sticks, a temperature needle that never moves, a choke that creeps out a notch or two with the
          shaking (the engine idles a little faster, but still idles), a stiff fuel tap that needs working (press <kbd>F</kbd> a few times), a split seat, a horn that works when it likes, brakes that pull or squeal, or a
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
          the orange has a weeping coolant hose: watch for a green damp patch under it, and fix it at the bench (job <kbd>7</kbd>) before it boils over. Now and then any radiator
          vehicle has one too, or a stuck thermostat; the coolant bottle at the petrol tank tops them up.`
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
          with buttons to set things up or put them right, and a small graph of the revs, speed, wheel slip and throttle over the last ten seconds. It releases the mouse but the game keeps running under it; click the game to carry on.`,
      },
      {
        q: "Can I tune the girls' cars?",
        a: `Yes, like any vehicle. Open the tuning panel (<kbd>\`</kbd>), pick the Fiesta or the Corsa on the Vehicles tab, and every one of its own groups is there: the engine,
          the gearbox, the springs and grip, the sound, the shake. "Their cars" in the Tune tab sets how often the girls take them out, how they drive and how much they mind
          you borrowing them, and "Fiesta riders" and "Corsa riders" how the girls ride in them.`,
      },
      {
        q: 'Is there a console?',
        a: `Backslash (<kbd>\\</kbd>, the <kbd>#</kbd> key on a UK keyboard) opens a command line. <code>help</code> lists the commands. You can read and set any value
          (<code>vehicle.red.temperature 0.4</code>), move things (<code>tp red barn</code>), reset them, change the weather (<code>weather rain</code>), fly
          (<code>fly</code>) and switch the girls' autonomy and speech off.`,
      },
      {
        q: 'How do I find the name of something in the console?',
        a: `Type a <code>.</code> or a space and every choice for the next word is listed under the line (scroll it if it is long). <kbd>Tab</kbd> fills in what you have started,
          and pressing it again goes through the choices. <kbd>Shift</kbd>+<kbd>Tab</kbd> goes back.`,
      },
      {
        q: 'How do I see what is slowing the game down?',
        a: `Open the tuning panel (the backtick key), go to the Tune tab and open "Frame time" at the top: it shows frames a second, the game's own time on each frame and how much of
          that goes on ten stages, from physics and the vehicles to the girls, the audio, the weather and effects, and finally drawing, with the biggest one named. <code>perf</code> in the
          console says the same in a line.`,
      },
      {
        q: 'Why does the game stop at 60 frames a second?',
        a: `So it runs cool and quiet on a laptop. The physics works in sixtieths of a second anyway, so a faster screen only got extra in-between frames
          for twice the work. It also draws at 1.5 times the screen's points on a Retina screen rather than 2, and the grass and stubble stop about 70 m
          away (the tussocks and bracken on the hill about 90 m), where a stalk is smaller than a pixel. "Graphics" in the tuning panel's Tune tab changes
          all four: a cap of 0 means none. <code>perf</code> in the console says how hard it is working.`,
        tip: 'A fan-quiet laptop: the game caps itself at 60 fps. "Graphics" in the tuning panel lifts it.',
      },
    ],
  },
];

// A note for every vehicle, keyed by spec id (QUAD_SPECS, EXTRA_SPECS and the tractor, UTV and Land Rover specs). The facts strip
// (engine, gearbox, tank, reverse) is generated from the spec; this is what a spec can't say.
export const VEHICLE_NOTES = {
  red: {
    blurb: 'The Kestrel Farm 300, a 1990s Honda-style farm quad: soft, steady and the smoothest of the lot, with a low warm idle, black wing flares, racks with tie-down hooks front and back, a pillion seat and a tow hitch on the back.',
    tips: ['Starts every game in 2WD: G for 4WD.', 'Reverse wants the bars turned as you press B.', 'Has an OIL lamp on its little dash.'],
  },
  blue: {
    blurb: 'The Tamura Bruin 660, a Grizzly-style farm quad: idles fast and keen, revs harder and higher, and has an LCD dash with fuel and temperature bars, a steel bumper, flat racks and a switch pod on the left bar.',
    tips: ['Floods if you leave the choke on once it’s warming, so ease it off early.', 'U is the diff lock, which pulls hardest in the mud.'],
  },
  yellow: {
    blurb: 'The Tamura Hornet 200, a Blaster-style two-stroke sport quad: the wheels are the edge of it, the plastics are small and the engine is out in the open. Weak low down, then comes on hard around 6,000 rpm and revs past 10,000, trailing blue smoke.',
    tips: ['Loads up its plug if left idling: blip the throttle.', 'Pre-mix only.', 'Room for one on a slim pad at the back.', 'The choke knob and the fuel tap are on the left of the carb: stop to reach the choke.', 'Only a key on the bars: no lamps, no gauges.', 'P is a plain lights switch (the left bar); the pull-start is O.'],
  },
  green: {
    blurb: 'The Kawasaki-style workhorse: older, heavier and slower, with a big lazy four-stroke that idles low and lumpy and pulls hard low down.',
    tips: ['Has the winch: X to take the hook.', 'Takes an age to warm up and wants plenty of choke.', 'The choke slides on the switch housing on the left bar.', 'Always four-wheel drive.'],
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
  fiesta: {
    blurb: "Amy's car: a late-70s Mk1 Fiesta in faded pale blue with a beige inside, a 1.1 with a choke and four gears, clean, careful and on L plates. It lives on the tarmac by the Dutch barn.",
    tips: ['A cold start wants the choke (Q).', 'Front-wheel drive on road tyres: stay on the road and the yard if it is wet.', 'Take it without Amy and she will not be pleased.'],
  },
  corsa: {
    blurb: "Jess's car: a 1993 Corsa, red gone pink on the roof and bonnet, a grey primer wing, a wheel trim missing and a big exhaust. A 1.2 with fuel injection and five gears that sounds much faster than it is.",
    tips: ['No choke: the injection sorts out a cold start itself.', 'There is rarely much petrol in it.', 'Jess minds less if you borrow it, as long as you do not dawdle.'],
  },
};

// A note for each girl, keyed by character id (characters.js).
export const GIRL_NOTES = {
  amy: {
    blurb: 'Blonde, the taller of the two, in a polo the colour of her favourite quad, usually done right up. Careful, kind with an edge, and the one who knows what she’s doing with an engine.',
    traits: ['Checks the oil and walks round a quad before she rides it.', 'Won’t ride a quad she knows is faulty.', 'Hates two-stroke smoke.',
      'Keeps a true logbook of every fault on the bench.', 'Corners better than Jess.'],
  },
  jess: {
    blurb: 'Black hair, shorter and curvier than Amy, in a polo the colour of her favourite quad, often with a few buttons undone. Cheeky, competitive and braver behind the bars, and gets bored sooner.',
    traits: ['Takes quads off on her own, and yours if you leave it running.', 'Names the quads.', 'Loves the smoke, the noise and the mud.',
      'Better in mud than Amy, and never checks the oil.', 'Blames the quad.'],
  },
};

/** Every tip in the hand-written answers, for the start screen. */
export function faqTips(sections = FAQ_SECTIONS) {
  return sections.flatMap((s) => s.entries.filter((e) => e.tip && !e.spoiler).map((e) => e.tip));
}
