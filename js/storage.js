/* Persistencia en localStorage: plantillas con sus posiciones iniciales.
 * Sin DOM. Depende de rotations.js y roster.js. */
window.CB = window.CB || {};

(function (CB) {
  "use strict";

  var R = CB.rotations;
  var Roster = CB.roster;

  var KEY_TEMPLATES = "cb.templates.v1";
  var KEY_SESSION = "cb.session.v1";
  var PROBE = "cb.probe";
  var VERSION = 1;

  var probe = null;

  /* Hasta leer localStorage puede lanzar: modo privado, cookies bloqueadas,
   * o un origen opaco. Nada de esto debe tumbar la app; si no se puede
   * guardar se sigue trabajando en memoria. */
  function store() {
    try {
      return typeof localStorage !== "undefined" ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  function available() {
    if (probe !== null) return probe;
    probe = false;
    var ls = store();
    if (ls) {
      try {
        ls.setItem(PROBE, "1");
        ls.removeItem(PROBE);
        probe = true;
      } catch (e) {
        probe = false;
      }
    }
    return probe;
  }

  /* JSON corrupto o de una version que no conocemos: se empieza de cero en
   * vez de romper. */
  function read(key) {
    var ls = store();
    if (!ls) return null;
    try {
      var raw = ls.getItem(key);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.v !== VERSION) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function write(key, data) {
    var ls = store();
    if (!ls) return false;
    try {
      ls.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ----------------------------------------------------------- plantillas */

  function loadTemplates() {
    var data = read(KEY_TEMPLATES);
    if (!data || !Array.isArray(data.templates)) return [];
    return data.templates.filter(function (tpl) {
      return tpl && tpl.id && tpl.name;
    }).map(function (tpl) {
      return {
        id: tpl.id,
        name: tpl.name,
        text: tpl.text || "",
        labels: tpl.labels || {},
        lineups: Array.isArray(tpl.lineups) ? tpl.lineups : []
      };
    });
  }

  function saveTemplates(list) {
    return write(KEY_TEMPLATES, { v: VERSION, templates: list || [] });
  }

  /* -------------------------------------------------------------- sesion */

  function loadSession() {
    return read(KEY_SESSION);
  }

  function saveSession(session) {
    var data = session || {};
    return write(KEY_SESSION, {
      v: VERSION,
      templateId: data.templateId || null,
      text: data.text || "",
      labels: data.labels || {},
      spots: data.spots || {}
    });
  }

  /* -------------------------------------------------- conversiones puras */

  /* Los ids de jugador (p1, p2...) los regenera parseRoster en cada parseo y
   * no sobreviven a una recarga: todo lo que se guarda va por nombre. */
  function spotsOf(lineup, roster) {
    var spots = {};
    R.GRID_ORDER.forEach(function (pos) {
      var player = Roster.byId(roster || [], (lineup || {})[pos]);
      if (player) spots[pos] = player.name;
    });
    return spots;
  }

  /* Inverso de spotsOf. Un nombre que ya no esta en la lista se ignora: la
   * posicion queda vacia y el resto se respeta. */
  function lineupFrom(spots, roster) {
    var idByName = {};
    Roster.players(roster || []).forEach(function (p) {
      idByName[p.name] = p.id;
    });

    var lineup = R.emptyLineup();
    R.GRID_ORDER.forEach(function (pos) {
      var name = (spots || {})[pos];
      if (name && idByName[name]) lineup[pos] = idByName[name];
    });
    return lineup;
  }

  function labelsOf(roster) {
    var labels = {};
    Roster.players(roster || []).forEach(function (p) {
      if (p.labelEdited) labels[p.name] = p.label;
    });
    return labels;
  }

  /* parseRoster(texto, previous) ya sabe conservar las etiquetas editadas a
   * mano. Aqui se le fabrica ese "previous" con lo guardado, en vez de
   * duplicar la logica de etiquetas. */
  function asPrevious(labels) {
    var map = labels || {};
    return Object.keys(map).map(function (name) {
      return { kind: "player", name: name, label: map[name], labelEdited: true };
    });
  }

  function nextId(prefix, list) {
    var max = 0;
    (list || []).forEach(function (item) {
      var n = parseInt(String(item.id).slice(prefix.length), 10);
      if (n > max) max = n;
    });
    return prefix + (max + 1);
  }

  CB.storage = {
    KEY_TEMPLATES: KEY_TEMPLATES,
    KEY_SESSION: KEY_SESSION,
    VERSION: VERSION,
    available: available,
    loadTemplates: loadTemplates,
    saveTemplates: saveTemplates,
    loadSession: loadSession,
    saveSession: saveSession,
    spotsOf: spotsOf,
    lineupFrom: lineupFrom,
    labelsOf: labelsOf,
    asPrevious: asPrevious,
    nextId: nextId
  };
})(window.CB);
