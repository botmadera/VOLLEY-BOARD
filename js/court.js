/* Render de la cancha, de los jugadores y de los cards de rotacion. */
window.CB = window.CB || {};

(function (CB) {
  "use strict";

  var GRID_ORDER = CB.rotations.GRID_ORDER;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* Circulo de jugador. Mismo componente en el panel, en la cancha y en los
   * cards; solo cambia el tamano por CSS y si es arrastrable. */
  function playerChip(player, opts) {
    var o = opts || {};
    var chip = el("div", "player", player.label);
    chip.dataset.playerId = player.id;
    chip.title = player.name;
    if (o.selected) chip.classList.add("is-selected");
    if (o.duplicate) chip.classList.add("is-duplicate");
    if (o.placed) chip.classList.add("is-placed");
    if (o.draggable) {
      chip.draggable = true;
      chip.tabIndex = 0;
    }
    return chip;
  }

  /* lineup -> cancha. En modo readonly no acepta drop ni arrastre: es lo que
   * usan los 6 cards de rotacion. */
  function renderCourt(lineup, lookup, opts) {
    var o = opts || {};
    var court = el("div", "court" + (o.readonly ? " court--mini" : ""));

    var net = el("div", "net");
    net.appendChild(el("span", "net__label", "R E D"));
    court.appendChild(net);

    var grid = el("div", "court__grid");
    GRID_ORDER.forEach(function (pos) {
      var cell = el("div", "cell");
      cell.dataset.pos = String(pos);
      cell.appendChild(el("span", "cell__num", String(pos)));

      var id = lineup[pos];
      var player = id ? lookup(id) : null;
      if (player) {
        cell.appendChild(
          playerChip(player, {
            draggable: !o.readonly,
            selected: !o.readonly && o.selectedId === id
          })
        );
      } else if (!o.readonly) {
        cell.classList.add("is-empty");
      }
      grid.appendChild(cell);
    });

    court.appendChild(grid);
    return court;
  }

  function rotationCard(index, lineup, lookup) {
    var card = el("article", "card");
    card.appendChild(el("h3", "card__title", "R" + (index + 1)));
    card.appendChild(renderCourt(lineup, lookup, { readonly: true }));
    return card;
  }

  CB.court = {
    el: el,
    playerChip: playerChip,
    renderCourt: renderCourt,
    rotationCard: rotationCard
  };
})(window.CB);
