import type { Team } from "./constants";

/**
 * Asignación de equipos sin elección: orden alfabético alternando
 * azul/naranja. Es el fallback determinista (todos los clientes llegan al
 * mismo resultado sin comunicarse) y la regla para salas de un solo jugador.
 */
export function assignAlphabetical(players: string[]): Record<string, Team> {
  const sorted = [...players].sort((a, b) => a.localeCompare(b));
  const map: Record<string, Team> = {};
  sorted.forEach((p, i) => {
    map[p] = i % 2 === 0 ? "blue" : "orange";
  });
  return map;
}

/**
 * Cierra la fase de elección respetando los picks pero con equipos
 * balanceados: ningún equipo puede superar ceil(n/2). Se recorre en orden
 * alfabético (determinista): si tu equipo elegido está lleno, vas al otro;
 * quien no eligió rellena el equipo más corto.
 */
export function assignTeams(players: string[], picks: Map<string, Team>): Record<string, Team> {
  const sorted = [...players].sort((a, b) => a.localeCompare(b));
  const cap = Math.ceil(sorted.length / 2);
  const count: Record<Team, number> = { blue: 0, orange: 0 };
  const map: Record<string, Team> = {};

  const place = (p: string, want: Team): void => {
    const team = count[want] < cap ? want : want === "blue" ? "orange" : "blue";
    map[p] = team;
    count[team]++;
  };

  // Primero los que eligieron (respetando el cupo), después el resto al lado corto.
  for (const p of sorted) {
    const want = picks.get(p);
    if (want) place(p, want);
  }
  for (const p of sorted) {
    if (map[p]) continue;
    place(p, count.blue <= count.orange ? "blue" : "orange");
  }
  return map;
}
