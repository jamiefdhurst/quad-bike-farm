// What every vehicle is called in the game: the made-up maker and model on its badge, never a real make or model, and never its colour (a
// bought one can be repainted, and there can be two of a model one day). `full` is for panels, the FAQ and the wheel ("Kestrel Farm 300");
// `say` is what the girls and the toasts call it after "the" ("the Farm 300"). Pure; the specs, the girls' lines and the FAQ read it.

export const VEHICLE_NAMES = {
  red: { maker: 'Kestrel', model: 'Farm 300', say: 'Farm 300' },
  blue: { maker: 'Tamura', model: 'Bruin 660', say: 'Bruin' },
  yellow: { maker: 'Tamura', model: 'Hornet 200', say: 'Hornet' },
  green: { maker: 'Ridgeback', model: 'RB300', say: 'RB300' },
  orange: { maker: 'Viper', model: 'Adder 250', say: 'Adder' },
  kids: { maker: 'Viper', model: 'Asp 50', say: "kids' quad" },
  moto: { maker: 'Tamura', model: 'TZ 65', say: 'mini moto' },
  ag200: { maker: 'Ridgeback', model: 'Shepherd 200', say: 'Shepherd' },
  atc: { maker: 'Kestrel', model: 'T185', say: 'old three-wheeler' },
  plover: { maker: 'Ashby', model: 'Plover 125', say: 'Plover' },
  loan: { maker: 'Tamura', model: 'Ursa 450', say: 'loan quad' },
  tractor: { maker: 'Hartley', model: '35', say: 'tractor' },
  utv: { maker: 'Ridgeback', model: 'Yak 4010', say: 'Yak' },
  landrover: { maker: 'Moorland', model: 'Tor', say: 'Tor' },
  landrover200: { maker: 'Moorland', model: 'Crag', say: 'Crag' },
  fiesta: { maker: 'Thorne', model: 'Finch', say: 'Finch' },
  corsa: { maker: 'Ashby', model: 'Griffin', say: 'Griffin' },
  p309: { maker: 'Vauclair', model: '39D', say: 'Vauclair' }, // your own car (a 309 diesel's place): "the Vauclair", as you'd say "the Peugeot"
};

export const MAKER_NAMES = [...new Set(Object.values(VEHICLE_NAMES).map((n) => n.maker))];

/** "Kestrel Farm 300": the panels, the FAQ, the wheel. */
export const fullName = (id) => `${VEHICLE_NAMES[id].maker} ${VEHICLE_NAMES[id].model}`;

/** "Farm 300", "mini moto": after "the" in a sentence. */
export const sayName = (id) => VEHICLE_NAMES[id].say;

/** "the Farm 300", "the mini moto". */
export const thePhrase = (id) => `the ${VEHICLE_NAMES[id].say}`;

/** A full name without its maker ("Kestrel Farm 300" is "Farm 300"): the logbook's column and the lists where the maker is the same noise. */
export function modelOnly(name) {
  const [first, ...rest] = String(name).split(' ');
  const model = rest.join(' ');
  return MAKER_NAMES.includes(first) && model && !/^\d+$/.test(model) ? model : String(name); // "Hartley 35" on its own is a name, "35" is not
}
