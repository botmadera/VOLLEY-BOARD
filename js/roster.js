/* Parseo de la lista de jugadores y generacion de etiquetas. */
window.CB = window.CB || {};

(function (CB) {
  "use strict";

  var LABEL_LEN = 4;

  /* data/team.txt trae WORD JOINER (U+2060) incrustado en la numeracion.
   * Se limpia antes de nada para que pegar el archivo tal cual funcione. */
  var INVISIBLES = new RegExp(
    "[\\u00AD\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF]",
    "g"
  );
  var NBSP = new RegExp("[\\u00A0\\u2007\\u202F]", "g");
  var COMBINING = new RegExp("[\\u0300-\\u036F]", "g");
  var NUMBERING = /^\s*\d+\s*[.)\-º]?\s*/;
  var SEPARATOR = /^[\s|+\-_=*.]*$/;

  function clean(line) {
    return line.replace(INVISIBLES, "").replace(NBSP, " ").trim();
  }

  /* Una linea con tabulador o con 3+ columnas es un bloque de rotacion ya
   * dibujado a mano (" TOB  NIN  RAM"), no parte de la plantilla. */
  function looksLikeBlock(line) {
    if (line.indexOf("\t") !== -1) return true;
    return line.split(/\s{2,}/).length >= 3;
  }

  function makeLabel(name) {
    var flat = name
      .normalize("NFD")
      .replace(COMBINING, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return flat.slice(0, LABEL_LEN) || "?";
  }

  /* Devuelve [{ kind:'group', name } | { kind:'player', id, name, label, labelEdited }].
   * previous: lista anterior, para conservar las etiquetas editadas a mano. */
  function parseRoster(text, previous) {
    var kept = {};
    (previous || []).forEach(function (item) {
      if (item.kind === "player" && item.labelEdited) kept[item.name] = item.label;
    });

    var lines = String(text || "")
      .split("\n")
      .map(clean)
      .filter(function (l) {
        return l && !SEPARATOR.test(l) && !looksLikeBlock(l);
      });

    /* Si la lista viene numerada, las lineas sin numero son encabezados de
     * grupo ("Ninas"). Si no hay numeracion en ninguna parte, cada linea es
     * un jugador escrito a mano. */
    var numbered = lines.some(function (l) {
      return NUMBERING.test(l);
    });

    var out = [];
    var seq = 0;
    lines.forEach(function (line) {
      if (numbered && !NUMBERING.test(line)) {
        out.push({ kind: "group", name: line });
        return;
      }
      var name = line.replace(NUMBERING, "").trim();
      if (!name) return;
      seq++;
      out.push({
        kind: "player",
        id: "p" + seq,
        name: name,
        label: kept[name] || makeLabel(name),
        labelEdited: Object.prototype.hasOwnProperty.call(kept, name)
      });
    });
    return out;
  }

  function players(roster) {
    return roster.filter(function (item) {
      return item.kind === "player";
    });
  }

  function byId(roster, id) {
    var found = null;
    roster.forEach(function (item) {
      if (item.kind === "player" && item.id === id) found = item;
    });
    return found;
  }

  /* Etiquetas repetidas: se marcan para que el usuario las resuelva a mano
   * (Ramiro y Ramírez colisionan ambos en RAMI). */
  function duplicateLabels(roster) {
    var seen = {};
    var dupes = {};
    players(roster).forEach(function (p) {
      if (seen[p.label]) dupes[p.label] = true;
      seen[p.label] = true;
    });
    return dupes;
  }

  CB.roster = {
    LABEL_LEN: LABEL_LEN,
    parseRoster: parseRoster,
    makeLabel: makeLabel,
    players: players,
    byId: byId,
    duplicateLabels: duplicateLabels
  };
})(window.CB);
