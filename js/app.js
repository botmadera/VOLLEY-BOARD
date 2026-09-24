/* Estado y cableado de eventos. */
window.CB = window.CB || {};

(function (CB) {
  "use strict";

  var R = CB.rotations;
  var Roster = CB.roster;
  var UI = CB.court;
  var Store = CB.storage;

  var state = {
    roster: [],
    lineup: R.emptyLineup(),
    rotations: null,
    selectedId: null,
    dragId: null,
    templates: [],
    templateId: null,
    /* Boton de borrado a la espera del segundo clic ("t1" o "t1/l1"). */
    confirmId: null
  };

  var dom = {};

  function lookup(id) {
    return Roster.byId(state.roster, id);
  }

  function posOf(id) {
    var found = null;
    R.GRID_ORDER.forEach(function (pos) {
      if (state.lineup[pos] === id) found = pos;
    });
    return found;
  }

  /* Cualquier cambio en la posicion inicial invalida las rotaciones ya
   * dibujadas: nunca deben convivir unos cards que no corresponden a la
   * cancha que se esta viendo. */
  function touchLineup() {
    state.rotations = null;
  }

  function place(id, pos) {
    if (!id || state.lineup[pos] === id) return;
    var from = posOf(id);
    var occupant = state.lineup[pos];
    state.lineup[pos] = id;
    /* Si venia de la cancha es un intercambio; si venia del panel, el
     * ocupante anterior vuelve al panel. */
    if (from) state.lineup[from] = occupant;
    touchLineup();
  }

  function unplace(id) {
    var pos = posOf(id);
    if (!pos) return;
    state.lineup[pos] = null;
    touchLineup();
  }

  function clearCourt() {
    state.lineup = R.emptyLineup();
    state.selectedId = null;
    touchLineup();
  }

  /* ----------------------------------------------------------- guardadas */

  function templateById(id) {
    var found = null;
    state.templates.forEach(function (tpl) {
      if (tpl.id === id) found = tpl;
    });
    return found;
  }

  function byName(list, name) {
    var found = null;
    (list || []).forEach(function (item) {
      if (item.name === name) found = item;
    });
    return found;
  }

  function persist() {
    Store.saveTemplates(state.templates);
  }

  /* Autoguardado de lo que se esta haciendo ahora mismo, para que recargar
   * no cueste volver a pegar la lista. El texto crudo se lee del textarea:
   * el estado no lo guarda. */
  function saveSession() {
    if (!dom.rosterInput) return;
    Store.saveSession({
      templateId: state.templateId,
      text: dom.rosterInput.value,
      labels: Store.labelsOf(state.roster),
      spots: Store.spotsOf(state.lineup, state.roster)
    });
  }

  /* Carga una plantilla en el estado sin repintar, para que abrir una
   * posicion no dispare dos renders. */
  function loadTemplate(tpl) {
    dom.rosterInput.value = tpl.text;
    dom.tplName.value = tpl.name;
    state.roster = Roster.parseRoster(tpl.text, Store.asPrevious(tpl.labels));
    state.templateId = tpl.id;
    state.lineup = R.emptyLineup();
    state.selectedId = null;
    touchLineup();
  }

  function openTemplate(id) {
    var tpl = templateById(id);
    if (!tpl) return;
    loadTemplate(tpl);
    dom.lineupName.value = "";
    render();
  }

  function openLineup(tplId, lineupId) {
    var tpl = templateById(tplId);
    if (!tpl) return;
    var lu = null;
    tpl.lineups.forEach(function (item) {
      if (item.id === lineupId) lu = item;
    });
    if (!lu) return;

    loadTemplate(tpl);
    /* Se asigna el lineup entero: pasar por place() haria intercambios
     * posicion a posicion sobre una cancha que aun no existe. */
    state.lineup = Store.lineupFrom(lu.spots, state.roster);
    dom.lineupName.value = lu.name;
    touchLineup();
    render();
  }

  function saveTemplate() {
    var text = dom.rosterInput.value;
    if (!text.trim()) return;
    var name = dom.tplName.value.trim() || "Plantilla " + (state.templates.length + 1);
    var labels = Store.labelsOf(state.roster);

    /* Mismo nombre, misma plantilla: se actualiza y conserva sus posiciones. */
    var tpl = byName(state.templates, name);
    if (tpl) {
      tpl.text = text;
      tpl.labels = labels;
    } else {
      tpl = {
        id: Store.nextId("t", state.templates),
        name: name,
        text: text,
        labels: labels,
        lineups: []
      };
      state.templates.push(tpl);
    }

    state.templateId = tpl.id;
    dom.tplName.value = name;
    persist();
    render();
  }

  function saveLineup() {
    var tpl = templateById(state.templateId);
    if (!tpl || R.countPlaced(state.lineup) !== 6) return;
    var name = dom.lineupName.value.trim() || "Posicion " + (tpl.lineups.length + 1);
    var spots = Store.spotsOf(state.lineup, state.roster);

    var lu = byName(tpl.lineups, name);
    if (lu) {
      lu.spots = spots;
    } else {
      tpl.lineups.push({ id: Store.nextId("l", tpl.lineups), name: name, spots: spots });
    }

    dom.lineupName.value = name;
    persist();
    render();
  }

  function deleteTemplate(id) {
    state.templates = state.templates.filter(function (tpl) {
      return tpl.id !== id;
    });
    if (state.templateId === id) state.templateId = null;
    persist();
    render();
  }

  function deleteLineup(tplId, lineupId) {
    var tpl = templateById(tplId);
    if (!tpl) return;
    tpl.lineups = tpl.lineups.filter(function (lu) {
      return lu.id !== lineupId;
    });
    persist();
    render();
  }

  /* ---------------------------------------------------------------- render */

  function renderPanel() {
    var dupes = Roster.duplicateLabels(state.roster);
    dom.rosterList.textContent = "";

    if (!state.roster.length) {
      dom.rosterList.appendChild(
        UI.el("p", "hint", "Pega la lista y pulsa Generar jugadores.")
      );
      return;
    }

    state.roster.forEach(function (item) {
      var row = UI.el("div", "roster__item");
      row.appendChild(
        UI.playerChip(item, {
          draggable: true,
          selected: state.selectedId === item.id,
          duplicate: !!dupes[item.label],
          placed: !!posOf(item.id)
        })
      );

      var meta = UI.el("div", "roster__meta");
      meta.appendChild(UI.el("span", "roster__name", item.name));

      var input = UI.el("input", "roster__label");
      input.type = "text";
      input.maxLength = Roster.LABEL_LEN;
      input.value = item.label;
      input.dataset.playerId = item.id;
      input.setAttribute("aria-label", "Etiqueta de " + item.name);
      meta.appendChild(input);

      row.appendChild(meta);
      dom.rosterList.appendChild(row);
    });
  }

  /* Borrar pide un segundo clic en vez de un confirm(): los dialogos nativos
   * se salen del tema y jsdom no los implementa. */
  function deleteButton(key, label) {
    var armed = state.confirmId === key;
    var btn = UI.el("button", "saved__del", armed ? "Borrar?" : "x");
    btn.type = "button";
    btn.dataset.delKey = key;
    btn.setAttribute("aria-label", label);
    if (armed) btn.classList.add("is-confirming");
    return btn;
  }

  function savedRow(cls, text, label, dataset) {
    var row = UI.el("div", cls);
    var open = UI.el("button", "saved__open", text);
    open.type = "button";
    open.dataset.tplId = dataset.tplId;
    if (dataset.lineupId) open.dataset.lineupId = dataset.lineupId;
    row.appendChild(open);
    row.appendChild(
      deleteButton(
        dataset.lineupId ? dataset.tplId + "/" + dataset.lineupId : dataset.tplId,
        label
      )
    );
    return row;
  }

  function renderSaved() {
    dom.savedList.textContent = "";

    if (!Store.available()) {
      dom.savedList.appendChild(
        UI.el("p", "hint", "Este navegador no permite guardar.")
      );
      return;
    }

    if (!state.templates.length) {
      dom.savedList.appendChild(
        UI.el("p", "hint", "Aun no hay plantillas guardadas.")
      );
      return;
    }

    state.templates.forEach(function (tpl) {
      var row = savedRow("saved__item", tpl.name, "Borrar " + tpl.name, {
        tplId: tpl.id
      });
      if (tpl.id === state.templateId) row.classList.add("is-current");
      dom.savedList.appendChild(row);

      tpl.lineups.forEach(function (lu) {
        dom.savedList.appendChild(
          savedRow(
            "saved__item saved__item--lineup",
            "> " + lu.name,
            "Borrar " + lu.name,
            { tplId: tpl.id, lineupId: lu.id }
          )
        );
      });
    });
  }

  /* Escribir en el textarea no repinta nada, pero si cambia si tiene sentido
   * guardar; por eso esto vive aparte y se llama tambien desde el input. */
  function refreshSaveButtons() {
    var can = Store.available();
    dom.btnSaveTemplate.disabled = !can || !dom.rosterInput.value.trim();
    dom.btnSaveLineup.disabled =
      !can || !state.templateId || R.countPlaced(state.lineup) !== 6;
    dom.btnSaveLineup.title = state.templateId
      ? "Guarda la posicion actual en la plantilla abierta"
      : "Guarda antes la plantilla";
  }

  function renderCourt() {
    dom.courtHost.textContent = "";
    dom.courtHost.appendChild(
      UI.renderCourt(state.lineup, lookup, { selectedId: state.selectedId })
    );

    var placed = R.countPlaced(state.lineup);
    dom.counter.textContent = placed + "/6 en cancha";
    dom.btnRotations.disabled = placed !== 6;
    dom.btnClear.disabled = placed === 0;
  }

  function renderCards() {
    dom.cards.textContent = "";
    if (!state.rotations) return;
    state.rotations.forEach(function (lineup, i) {
      dom.cards.appendChild(UI.rotationCard(i, lineup, lookup));
    });
  }

  function render() {
    renderPanel();
    renderSaved();
    renderCourt();
    renderCards();
    refreshSaveButtons();
    saveSession();
  }

  /* Al editar una etiqueta no se puede repintar el panel entero: se perderia
   * el foco del input. Se actualizan solo los circulos ya pintados. */
  function refreshLabels() {
    var dupes = Roster.duplicateLabels(state.roster);
    var chips = document.querySelectorAll(".player[data-player-id]");
    Array.prototype.forEach.call(chips, function (chip) {
      var player = lookup(chip.dataset.playerId);
      if (!player) return;
      chip.textContent = player.label;
      chip.classList.toggle("is-duplicate", !!dupes[player.label]);
    });
    saveSession();
  }

  /* ---------------------------------------------------------------- eventos */

  function onGeneratePlayers() {
    var previous = state.roster;
    var next = Roster.parseRoster(dom.rosterInput.value, previous);

    /* Se conserva la alineacion por nombre: anadir un jugador a la lista no
     * deberia vaciar la cancha. */
    var nameById = {};
    Roster.players(previous).forEach(function (p) {
      nameById[p.id] = p.name;
    });
    var idByName = {};
    Roster.players(next).forEach(function (p) {
      idByName[p.name] = p.id;
    });

    var lineup = R.emptyLineup();
    R.GRID_ORDER.forEach(function (pos) {
      var oldId = state.lineup[pos];
      if (!oldId) return;
      var newId = idByName[nameById[oldId]];
      if (newId) lineup[pos] = newId;
    });

    state.roster = next;
    state.lineup = lineup;
    state.selectedId = null;
    touchLineup();
    render();
  }

  function onGenerateRotations() {
    if (R.countPlaced(state.lineup) !== 6) return;
    state.rotations = R.allRotations(state.lineup);
    state.selectedId = null;
    render();
  }

  function closest(e, selector) {
    var t = e.target;
    return t && t.closest ? t.closest(selector) : null;
  }

  function chipFrom(e) {
    return closest(e, ".player");
  }

  /* Click para seleccionar, click para colocar. Cubre tablet, donde el
   * drag & drop nativo no responde al dedo. */
  function onClick(e) {
    var chip = chipFrom(e);
    var cell = closest(e, ".cell");
    var readonly = closest(e, ".court--mini");
    if (readonly) return;

    /* Las guardadas se resuelven aqui y no en un listener propio: repintar la
     * lista desconecta el boton pulsado, y un segundo handler ya no podria
     * saber que el clic venia de dentro de .saved. */
    if (closest(e, ".saved")) {
      onSavedClick(e);
      return;
    }

    /* Un clic en cualquier otra parte desarma un borrado a medio confirmar. */
    if (state.confirmId) {
      state.confirmId = null;
      renderSaved();
    }

    if (chip) {
      var id = chip.dataset.playerId;
      if (state.selectedId && state.selectedId !== id && cell) {
        place(state.selectedId, Number(cell.dataset.pos));
        state.selectedId = null;
      } else {
        state.selectedId = state.selectedId === id ? null : id;
      }
      render();
      return;
    }

    if (cell && state.selectedId) {
      place(state.selectedId, Number(cell.dataset.pos));
      state.selectedId = null;
      render();
      return;
    }

    /* Click en el panel con un jugador de la cancha seleccionado: lo saca.
     * Los clicks en .saved ya han salido arriba. */
    if (state.selectedId && closest(e, ".panel")) {
      unplace(state.selectedId);
      state.selectedId = null;
      render();
    }
  }

  function onKeyDown(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var chip = chipFrom(e);
    if (!chip) return;
    e.preventDefault();
    onClick(e);
  }

  function onDragStart(e) {
    var chip = chipFrom(e);
    if (!chip || closest(e, ".court--mini")) return;
    state.dragId = chip.dataset.playerId;
    e.dataTransfer.setData("text/plain", state.dragId);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e) {
    if (!state.dragId) return;
    if (closest(e, ".court--mini") || closest(e, ".saved")) return;
    if (closest(e, ".cell") || closest(e, ".panel")) e.preventDefault();
  }

  function onDrop(e) {
    var id = state.dragId || e.dataTransfer.getData("text/plain");
    if (!id) return;
    var cell = closest(e, ".cell");
    if (cell && !closest(e, ".court--mini")) {
      e.preventDefault();
      place(id, Number(cell.dataset.pos));
    } else if (closest(e, ".panel") && !closest(e, ".saved")) {
      e.preventDefault();
      unplace(id);
    }
    state.dragId = null;
    state.selectedId = null;
    render();
  }

  function onLabelInput(e) {
    var input = closest(e, ".roster__label");
    if (!input) return;
    var player = lookup(input.dataset.playerId);
    if (!player) return;
    var value = input.value.toUpperCase().slice(0, Roster.LABEL_LEN);
    if (input.value !== value) input.value = value;
    player.label = value;
    player.labelEdited = true;
    refreshLabels();
  }

  /* Etiqueta vacia: se vuelve al truncado automatico. */
  function onLabelBlur(e) {
    var input = closest(e, ".roster__label");
    if (!input) return;
    var player = lookup(input.dataset.playerId);
    if (!player || player.label) return;
    player.label = Roster.makeLabel(player.name);
    player.labelEdited = false;
    input.value = player.label;
    refreshLabels();
  }

  function onSavedClick(e) {
    var del = closest(e, ".saved__del");
    if (del) {
      var key = del.dataset.delKey;
      if (state.confirmId !== key) {
        state.confirmId = key;
        renderSaved();
        return;
      }
      state.confirmId = null;
      var parts = key.split("/");
      if (parts.length === 2) deleteLineup(parts[0], parts[1]);
      else deleteTemplate(parts[0]);
      return;
    }

    var open = closest(e, ".saved__open");
    if (!open) return;
    state.confirmId = null;
    if (open.dataset.lineupId) openLineup(open.dataset.tplId, open.dataset.lineupId);
    else openTemplate(open.dataset.tplId);
  }

  /* Al recargar se recupera lo ultimo que se estaba haciendo. Los nombres
   * guardados se vuelven a mapear a los ids nuevos que sale de parseRoster. */
  function restoreSession() {
    state.templates = Store.loadTemplates();

    var session = Store.loadSession();
    if (!session || !session.text) return;

    dom.rosterInput.value = session.text;
    state.roster = Roster.parseRoster(session.text, Store.asPrevious(session.labels));
    state.lineup = Store.lineupFrom(session.spots, state.roster);

    var tpl = templateById(session.templateId);
    if (tpl) {
      state.templateId = tpl.id;
      dom.tplName.value = tpl.name;
    }
  }

  function init() {
    dom.rosterInput = document.getElementById("roster-input");
    dom.rosterList = document.getElementById("roster-list");
    dom.courtHost = document.getElementById("court-host");
    dom.cards = document.getElementById("cards");
    dom.counter = document.getElementById("counter");
    dom.btnPlayers = document.getElementById("btn-players");
    dom.btnRotations = document.getElementById("btn-rotations");
    dom.btnClear = document.getElementById("btn-clear");
    dom.savedList = document.getElementById("saved-list");
    dom.tplName = document.getElementById("tpl-name");
    dom.lineupName = document.getElementById("lineup-name");
    dom.btnSaveTemplate = document.getElementById("btn-save-template");
    dom.btnSaveLineup = document.getElementById("btn-save-lineup");

    dom.btnPlayers.addEventListener("click", onGeneratePlayers);
    dom.btnRotations.addEventListener("click", onGenerateRotations);
    dom.btnClear.addEventListener("click", function () {
      clearCourt();
      render();
    });
    dom.btnSaveTemplate.addEventListener("click", saveTemplate);
    dom.btnSaveLineup.addEventListener("click", saveLineup);
    /* Escribir la lista no repinta, pero si hay que guardarla y reevaluar
     * el boton de guardar plantilla. */
    dom.rosterInput.addEventListener("input", function () {
      refreshSaveButtons();
      saveSession();
    });

    restoreSession();

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    document.addEventListener("input", onLabelInput);
    document.addEventListener("focusout", onLabelBlur);

    render();
  }

  CB.app = { init: init, state: state };
  document.addEventListener("DOMContentLoaded", init);
})(window.CB);
