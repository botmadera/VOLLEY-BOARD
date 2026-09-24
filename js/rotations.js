/* Logica de rotacion. Puro: sin DOM, sin estado global. */
window.CB = window.CB || {};

(function (CB) {
  "use strict";

  /* Numeracion reglamentaria, red arriba:
   *
   *          -- RED --
   *     P4     P3     P2     zona delantera
   *     P5     P6     P1     zona zaguera
   *
   * El giro horario mueve a cada jugador al siguiente puesto de este ciclo.
   * Validado contra los dos primeros bloques de data/team.txt. */
  var CYCLE = [1, 6, 5, 4, 3, 2];

  /* Orden de pintado de la cancha: fila delantera arriba, zaguera abajo. */
  var GRID_ORDER = [4, 3, 2, 5, 6, 1];

  /* lineup: { 1: playerId|null, ..., 6: playerId|null }
   * Devuelve un lineup nuevo; nunca muta el original. */
  function rotate(lineup, r) {
    var out = {};
    var shift = ((r % 6) + 6) % 6;
    CYCLE.forEach(function (pos, i) {
      out[CYCLE[(i + shift) % 6]] = lineup[pos] || null;
    });
    return out;
  }

  /* Las 6 rotaciones. La primera es la posicion inicial sin tocar,
   * de modo que R1 sale por el mismo camino que las demas. */
  function allRotations(lineup) {
    var out = [];
    for (var r = 0; r < 6; r++) out.push(rotate(lineup, r));
    return out;
  }

  function emptyLineup() {
    return { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
  }

  function countPlaced(lineup) {
    return GRID_ORDER.filter(function (p) {
      return lineup[p];
    }).length;
  }

  CB.rotations = {
    CYCLE: CYCLE,
    GRID_ORDER: GRID_ORDER,
    rotate: rotate,
    allRotations: allRotations,
    emptyLineup: emptyLineup,
    countPlaced: countPlaced
  };
})(window.CB);
