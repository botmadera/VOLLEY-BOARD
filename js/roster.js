/* Parseo de la lista de jugadores y generacion de etiquetas. */
window.CB = window.CB || {};

(function (CB) {
  "use strict";

  var LABEL_LEN = 4;

  var COMBINING = new RegExp("[\\u0300-\\u036F]", "g");

  function makeLabel(name) {
    var flat = name
      .normalize("NFD")
      .replace(COMBINING, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return flat.slice(0, LABEL_LEN) || "?";
  }

  /* Una linea = un jugador; las lineas vacias se ignoran. Nada mas: ni
   * numeracion, ni grupos. Quien pegue otro formato limpia la lista antes.
   * Devuelve [{ kind:'player', id, name, label, labelEdited }].
   * previous: lista anterior, para conservar las etiquetas editadas a mano. */
  function parseRoster(text, previous) {
    var kept = {};
    (previous || []).forEach(function (item) {
      if (item.kind === "player" && item.labelEdited) kept[item.name] = item.label;
    });

    return String(text || "")
      .split("\n")
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean)
      .map(function (name, i) {
        return {
          kind: "player",
          id: "p" + (i + 1),
          name: name,
          label: kept[name] || makeLabel(name),
          labelEdited: Object.prototype.hasOwnProperty.call(kept, name)
        };
      });
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
