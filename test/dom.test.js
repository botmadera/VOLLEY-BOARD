/* Flujo completo de la pagina en jsdom: pegar lista -> generar jugadores ->
   editar etiqueta -> colocar 6 -> generar rotaciones -> vaciar -> guardar y
   abrir plantillas -> recargar.
   Requiere jsdom: npm install && node test/dom.test.js

   Nota: jsdom no implementa DataTransfer, asi que el arrastre nativo
   (dragstart/drop) no se cubre aqui; se ejercita la ruta de click. */
const fs = require("fs");
const path = require("path");

let JSDOM;
try {
  ({ JSDOM } = require("jsdom"));
} catch (e) {
  console.error("Falta jsdom. Ejecuta: npm install");
  process.exit(1);
}

const root = path.join(__dirname, "..");
let fails = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) { fails++; if (extra) console.log("      " + extra); }
};

/* Doble de localStorage. JSDOM.fromFile carga con origen file://, donde el
   localStorage de jsdom puede no estar disponible; con uno propio el test es
   determinista y ademas se puede compartir entre dos instancias para simular
   una recarga del navegador. */
const makeStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    clear: () => data.clear(),
    key: (i) => Array.from(data.keys())[i] ?? null,
    get length() { return data.size; }
  };
};

const openPage = async (storage) => {
  const dom = await JSDOM.fromFile(path.join(root, "index.html"), {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "localStorage", {
        value: storage,
        configurable: true
      });
    }
  });
  await new Promise((r) => dom.window.addEventListener("load", r));
  return dom;
};

(async () => {
  const storage = makeStorage();
  const dom = await openPage(storage);
  const { window } = dom;
  const doc = window.document;

  const $ = (s) => doc.querySelector(s);
  const $$ = (s) => Array.from(doc.querySelectorAll(s));
  const click = (node) =>
    node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

  check("los 5 scripts se cargaron",
    !!(window.CB && window.CB.app && window.CB.court && window.CB.storage));

  /* 1. pegar la lista y generar jugadores */
  const input = $("#roster-input");
  input.value = fs.readFileSync(path.join(root, "data/team.txt"), "utf8");
  click($("#btn-players"));

  const panelChips = $$(".panel .player");
  check("9 circulos en el panel", panelChips.length === 9,
    panelChips.map((c) => c.textContent).join(" "));
  check("boton rotaciones deshabilitado sin 6 en cancha", $("#btn-rotations").disabled);
  check("contador inicial", $("#counter").textContent === "0/6 en cancha",
    $("#counter").textContent);

  /* 2. editar la etiqueta de Ramírez a R33 */
  const ramirezInput = $$(".roster__label").find(
    (i) => i.previousSibling.textContent === "Ramírez"
  );
  ramirezInput.value = "r33";
  ramirezInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  const ramirezChip = doc.querySelector(
    `.panel .player[data-player-id="${ramirezInput.dataset.playerId}"]`
  );
  check("editar etiqueta actualiza el circulo (y en mayusculas)",
    ramirezChip.textContent === "R33", ramirezChip.textContent);
  check("el input editado conserva el foco (no se repinta el panel)",
    doc.activeElement !== doc.body ? true : ramirezInput.isConnected,
    "el input fue reemplazado por un render completo");
  check("al resolverse el duplicado desaparece la marca",
    !$$(".panel .player.is-duplicate").length,
    $$(".panel .player.is-duplicate").map((c) => c.textContent).join(" "));

  /* 3. colocar la alineacion del archivo (click seleccionar / click colocar) */
  const byLabel = (l) => $$(".panel .player").find((c) => c.textContent === l);
  const cell = (pos) => doc.querySelector(`#court-host .cell[data-pos="${pos}"]`);
  const onCourt = (pos) => {
    const p = cell(pos).querySelector(".player");
    return p ? p.textContent : null;
  };
  const lineupStr = () => [4, 3, 2, 5, 6, 1].map(onCourt).join(" ");

  [["VERA", 4], ["TOBI", 3], ["NINA", 2], ["R33", 5], ["PILI", 6], ["RAMI", 1]]
    .forEach(([label, pos]) => {
      click(byLabel(label));
      click(cell(pos));
    });

  check("alineacion inicial colocada",
    lineupStr() === "VERA TOBI NINA R33 PILI RAMI", lineupStr());
  check("contador 6/6", $("#counter").textContent === "6/6 en cancha");
  check("boton rotaciones habilitado", !$("#btn-rotations").disabled);
  check("los colocados se marcan en el panel",
    $$(".panel .player.is-placed").length === 6);

  /* 3b. colocar sobre celda ocupada */
  click(byLabel("IRMA"));
  click(cell(4));
  check("colocar sobre celda ocupada sustituye", onCourt(4) === "IRMA", onCourt(4));
  check("el desplazado vuelve al panel",
    !$$(".panel .player.is-placed").map((c) => c.textContent).includes("VERA"));
  click(byLabel("VERA"));
  click(cell(4));
  check("restaurada la alineacion", onCourt(4) === "VERA", onCourt(4));

  /* 4. generar rotaciones */
  click($("#btn-rotations"));
  const cards = $$(".card");
  const read = (card) =>
    [4, 3, 2, 5, 6, 1]
      .map((p) => card.querySelector(`.cell[data-pos="${p}"] .player`).textContent)
      .join(" ");
  check("6 cards", cards.length === 6, String(cards.length));
  check("R1 = posicion inicial",
    read(cards[0]) === "VERA TOBI NINA R33 PILI RAMI", read(cards[0]));
  check("R2 = segundo bloque de la hoja a mano",
    read(cards[1]) === "R33 VERA TOBI PILI RAMI NINA", read(cards[1]));
  check("cards de solo lectura (sin draggable)",
    !cards.some((c) => c.querySelector(".player[draggable='true']")));
  check("titulos R1..R6",
    $$(".card__title").map((t) => t.textContent).join(",") === "R1,R2,R3,R4,R5,R6");

  /* 5. tocar la cancha invalida los cards */
  click(byLabel("IRMA"));
  click(cell(4));
  check("mover un jugador borra las rotaciones obsoletas", $$(".card").length === 0);

  /* 6. vaciar */
  click($("#btn-clear"));
  check("vaciar cancha", $("#counter").textContent === "0/6 en cancha");
  check("boton vaciar se deshabilita al quedar vacia", $("#btn-clear").disabled);

  /* 7. guardar plantilla y posicion inicial */
  const savedRows = () => $$("#saved-list .saved__item");
  const savedText = () =>
    savedRows().map((r) => r.querySelector(".saved__open").textContent).join("|");
  const delBtn = (i) => savedRows()[i].querySelector(".saved__del");

  check("sin nada guardado se explica que no hay plantillas", !!$("#saved-list .hint"));
  check("guardar posicion deshabilitado sin plantilla abierta",
    $("#btn-save-lineup").disabled);

  $("#tpl-name").value = "Infantil A";
  click($("#btn-save-template"));
  check("la plantilla guardada aparece en el panel",
    savedText() === "Infantil A", savedText());
  check("la plantilla recien guardada queda marcada como actual",
    savedRows()[0].classList.contains("is-current"));

  const colocarSeis = () =>
    [["VERA", 4], ["TOBI", 3], ["NINA", 2], ["R33", 5], ["PILI", 6], ["RAMI", 1]]
      .forEach(([label, pos]) => { click(byLabel(label)); click(cell(pos)); });

  colocarSeis();
  check("guardar posicion habilitado con 6 en cancha y plantilla abierta",
    !$("#btn-save-lineup").disabled);
  $("#lineup-name").value = "Saque";
  click($("#btn-save-lineup"));
  check("la posicion cuelga de su plantilla",
    savedText() === "Infantil A|> Saque", savedText());

  click($("#btn-clear"));
  const luOpen = () =>
    savedRows().map((r) => r.querySelector(".saved__open"))
      .find((b) => b.dataset.lineupId);
  click(luOpen());
  check("abrir la posicion guardada repuebla la cancha",
    lineupStr() === "VERA TOBI NINA R33 PILI RAMI", lineupStr());
  check("abrir una posicion no deja cards obsoletos", $$(".card").length === 0);
  check("la etiqueta editada a mano vuelve con la plantilla", !!byLabel("R33"));

  /* La lista de guardadas vive dentro del panel, pero pulsar ahi es navegar:
     no debe sacar de la cancha al jugador seleccionado. */
  click(byLabel("VERA"));
  click($("#saved-list"));
  check("pulsar en guardadas no saca al jugador seleccionado",
    onCourt(4) === "VERA", String(onCourt(4)));
  click($("#roster-list"));
  check("pulsar en el resto del panel si lo saca", onCourt(4) === null);
  click(byLabel("VERA"));
  click(cell(4));

  click(delBtn(1));
  check("el primer clic en borrar solo pide confirmacion",
    savedRows().length === 2 && delBtn(1).classList.contains("is-confirming"),
    savedText());
  click(delBtn(1));
  check("el segundo clic borra la posicion", savedText() === "Infantil A", savedText());

  click(delBtn(0));
  check("borrar plantilla tambien se arma", delBtn(0).classList.contains("is-confirming"));
  click($("#court-host"));
  check("un clic fuera desarma el borrado",
    savedText() === "Infantil A" && !delBtn(0).classList.contains("is-confirming"));

  /* 8. recargar: la sesion y las plantillas vuelven solas */
  const dom2 = await openPage(storage);
  const doc2 = dom2.window.document;
  const all2 = (s) => Array.from(doc2.querySelectorAll(s));
  const lineup2 = () =>
    [4, 3, 2, 5, 6, 1].map((pos) => {
      const p = doc2.querySelector(`#court-host .cell[data-pos="${pos}"] .player`);
      return p ? p.textContent : null;
    }).join(" ");

  check("tras recargar vuelve la lista", all2(".panel .player").length === 9);
  check("tras recargar vuelve la cancha",
    lineup2() === "VERA TOBI NINA R33 PILI RAMI", lineup2());
  check("tras recargar vuelve la etiqueta editada a mano",
    all2(".panel .player").some((c) => c.textContent === "R33"));
  check("tras recargar siguen las plantillas guardadas",
    all2("#saved-list .saved__open").map((b) => b.textContent).join("|") === "Infantil A");
  check("tras recargar se recuerda que plantilla estaba abierta",
    !!doc2.querySelector("#saved-list .saved__item.is-current"));

  console.log(fails ? `\n${fails} fallo(s)` : "\nTodo OK");
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
