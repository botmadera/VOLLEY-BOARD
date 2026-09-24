/* Logica pura (rotations.js + roster.js + storage.js) contra data/team.txt.
   Sin dependencias: node test/logic.test.js */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.join(__dirname, "..");

/* localStorage no existe en node: se le da a storage.js un doble en memoria.
   `fail` fuerza el camino de error (cuota llena, modo privado). */
const makeStore = () => {
  const data = new Map();
  return {
    fail: false,
    getItem(k) { return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { if (this.fail) throw new Error("quota"); data.set(k, String(v)); },
    removeItem(k) { data.delete(k); },
    _raw: data
  };
};
const store = makeStore();

const sandbox = {
  window: {},
  document: { addEventListener() {} },
  localStorage: store
};
vm.createContext(sandbox);
for (const f of ["js/rotations.js", "js/roster.js", "js/storage.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f });
}
const CB = sandbox.window.CB;

let fails = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) { fails++; if (extra) console.log("      " + extra); }
};

/* --- 1. parseo de data/team.txt pegado tal cual --------------------------- */
const raw = fs.readFileSync(path.join(root, "data/team.txt"), "utf8");
const roster = CB.roster.parseRoster(raw);
const players = CB.roster.players(roster);
const groups = roster.filter((i) => i.kind === "group");

check("9 jugadores desde team.txt", players.length === 9,
  players.map((p) => `${p.name}|${p.label}`).join(", "));
check("'Ninas' es grupo, no jugador",
  groups.length === 1 && groups[0].name === "Niñas",
  JSON.stringify(groups));
check("los bloques de rotacion pegados se ignoran",
  !players.some((p) => /^(TOB|NIN|RAM|VER|R33|PIL)$/.test(p.name)));

/* --- 2. etiquetas --------------------------------------------------------- */
const lbl = (n) => players.find((p) => p.name === n).label;
check("Ramiro y Ramírez colisionan en RAMI",
  lbl("Ramiro") === "RAMI" && lbl("Ramírez") === "RAMI");
check("duplicados detectados", CB.roster.duplicateLabels(roster).RAMI === true);
check("acentos fuera: Sofia -> SOFI", lbl("Sofía") === "SOFI");
check("'Nina D' -> NINA", lbl("Nina D") === "NINA");
check("etiqueta editada sobrevive al re-parseo", (() => {
  const edited = roster.map((i) =>
    i.kind === "player" && i.name === "Ramírez"
      ? { ...i, label: "R33", labelEdited: true } : i);
  const again = CB.roster.parseRoster(raw, edited);
  const ramirez = CB.roster.players(again).find((p) => p.name === "Ramírez");
  return CB.roster.byId(again, ramirez.id).label === "R33";
})());
check("lista sin numerar: cada linea es un jugador",
  CB.roster.players(CB.roster.parseRoster("Ana\nBeto\nCarla")).length === 3);

/* --- 3. rotacion: R2 debe ser el 2o bloque de team.txt --------------------
   Este es el test de aceptacion. La transicion entre los dos primeros
   bloques de data/team.txt esta escrita a mano por el entrenador y fija el
   sentido del giro; si esto falla, el modelo esta mal. */
const R = CB.rotations;
const show = (l) => R.GRID_ORDER.map((p) => l[p]).join(" ");

// Posicion inicial del archivo: delantera VER TOB NIN / zaguera R33 PIL RAM
const lineup0 = { 4: "VER", 3: "TOB", 2: "NIN", 5: "R33", 6: "PIL", 1: "RAM" };
const rots = R.allRotations(lineup0);
check("R1 = posicion inicial", show(rots[0]) === "VER TOB NIN R33 PIL RAM", show(rots[0]));

// Bloque 1 de team.txt rotado una vez debe dar el bloque 2.
const bloque1 = { 4: "TOB", 3: "NIN", 2: "RAM", 5: "VER", 6: "R33", 1: "PIL" };
check("bloque1 + 1 giro horario == bloque2 de team.txt",
  show(R.rotate(bloque1, 1)) === "VER TOB NIN R33 PIL RAM",
  `obtenido: ${show(R.rotate(bloque1, 1))}`);

check("las 6 rotaciones son distintas",
  new Set(rots.map(show)).size === 6, rots.map(show).join(" / "));
check("un 7o giro vuelve a R1", show(R.rotate(lineup0, 6)) === show(rots[0]));
check("rotate no muta el lineup original", show(lineup0) === "VER TOB NIN R33 PIL RAM");
check("countPlaced", R.countPlaced(lineup0) === 6 && R.countPlaced(R.emptyLineup()) === 0);

/* --- 4. persistencia ------------------------------------------------------
   Lo guardado va por NOMBRE, nunca por id: parseRoster regenera p1..pN en
   cada parseo, asi que los ids no sobreviven a una recarga. */
const S = CB.storage;
const seis = players.slice(0, 6);
const lineupIds = {};
R.GRID_ORDER.forEach((pos, i) => { lineupIds[pos] = seis[i].id; });

check("localStorage disponible en el doble", S.available() === true);

const spots = S.spotsOf(lineupIds, roster);
check("spotsOf guarda nombres, no ids",
  R.GRID_ORDER.every((pos) => spots[pos] === seis[R.GRID_ORDER.indexOf(pos)].name),
  JSON.stringify(spots));

check("spotsOf ignora las posiciones vacias",
  Object.keys(S.spotsOf(R.emptyLineup(), roster)).length === 0);

check("spotsOf -> lineupFrom conserva las 6 posiciones",
  R.GRID_ORDER.every((pos) => S.lineupFrom(spots, roster)[pos] === lineupIds[pos]));

check("los nombres sobreviven al desplazamiento de ids", (() => {
  /* Un jugador nuevo al principio corre todos los ids: p1 pasa a ser p2. */
  const movido = CB.roster.parseRoster("1. Nuevo\n" + raw);
  const lineup = S.lineupFrom(spots, movido);
  return R.GRID_ORDER.every((pos) => {
    const p = CB.roster.byId(movido, lineup[pos]);
    return p && p.name === spots[pos];
  }) && CB.roster.byId(movido, lineup[4]).id !== lineupIds[4];
})());

check("un nombre borrado de la lista deja su hueco vacio y no rompe", (() => {
  const sinUno = CB.roster.parseRoster(
    raw.split("\n").filter((l) => l.indexOf(seis[0].name) === -1).join("\n"));
  const lineup = S.lineupFrom(spots, sinUno);
  return lineup[R.GRID_ORDER[0]] === null && R.countPlaced(lineup) === 5;
})());

check("labelsOf solo recoge las etiquetas editadas a mano", (() => {
  const editado = roster.map((i) =>
    i.kind === "player" && i.name === "Ramírez"
      ? { ...i, label: "R33", labelEdited: true } : i);
  const labels = S.labelsOf(editado);
  return Object.keys(labels).length === 1 && labels["Ramírez"] === "R33";
})());

check("asPrevious devuelve las etiquetas a parseRoster", (() => {
  const again = CB.roster.parseRoster(raw, S.asPrevious({ Ramírez: "R33" }));
  return CB.roster.players(again).find((p) => p.name === "Ramírez").label === "R33";
})());

check("nextId no reutiliza ids",
  S.nextId("t", []) === "t1" &&
  S.nextId("t", [{ id: "t1" }, { id: "t4" }]) === "t5" &&
  S.nextId("l", [{ id: "l2" }]) === "l3");

const tpls = [{ id: "t1", name: "Infantil A", text: raw,
  labels: { Ramírez: "R33" },
  lineups: [{ id: "l1", name: "Saque", spots }] }];
check("plantillas: ida y vuelta por localStorage", (() => {
  if (!S.saveTemplates(tpls)) return false;
  const back = S.loadTemplates();
  return back.length === 1 &&
    back[0].name === "Infantil A" &&
    back[0].labels.Ramírez === "R33" &&
    back[0].lineups[0].spots[R.GRID_ORDER[0]] === spots[R.GRID_ORDER[0]];
})());

check("sesion: ida y vuelta por localStorage", (() => {
  S.saveSession({ templateId: "t1", text: raw, labels: {}, spots });
  const back = S.loadSession();
  return back.templateId === "t1" && back.text === raw &&
    back.spots[R.GRID_ORDER[0]] === spots[R.GRID_ORDER[0]];
})());

check("JSON corrupto no rompe: se empieza de cero", (() => {
  store._raw.set(S.KEY_TEMPLATES, "{ esto no es json");
  const back = S.loadTemplates();
  store._raw.delete(S.KEY_TEMPLATES);
  return Array.isArray(back) && back.length === 0;
})());

check("una version desconocida se descarta", (() => {
  store._raw.set(S.KEY_TEMPLATES, JSON.stringify({ v: 99, templates: tpls }));
  const back = S.loadTemplates();
  store._raw.delete(S.KEY_TEMPLATES);
  return back.length === 0;
})());

check("si el navegador no deja escribir no se propaga la excepcion", (() => {
  store.fail = true;
  let ok = false;
  try {
    ok = S.saveTemplates(tpls) === false && S.saveSession({ text: "x" }) === false;
  } catch (e) {
    ok = false;
  }
  store.fail = false;
  return ok;
})());

if (process.argv.includes("-v")) {
  console.log("\nSecuencia completa:");
  rots.forEach((l, i) => {
    console.log(`R${i + 1}  ${[4, 3, 2].map((p) => l[p]).join(" ")}`);
    console.log(`    ${[5, 6, 1].map((p) => l[p]).join(" ")}`);
  });
}

console.log(fails ? `\n${fails} fallo(s)` : "\nTodo OK");
process.exit(fails ? 1 : 0);
