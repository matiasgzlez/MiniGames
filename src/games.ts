export interface GameEntry {
  id: string;
  title: string;
  description: string;
  path: string;
  /**
   * Como se juega, en 1-2 frases (objetivo + controles). Se muestra en la
   * pantalla de instrucciones del modo sala antes de cada ronda.
   */
  instructions: string;
  /** Accent color used to theme the game's card on the landing page. */
  accent?: string;
  /** Categoria para los filtros de la landing. */
  category: string;
}

/** Portada del juego generada por IA; si falta, la card muestra un fallback. */
export function coverUrl(gameId: string): string {
  return `/covers/${gameId}.jpg`;
}

export const games: GameEntry[] = [
  {
    id: "neon-cylinder",
    title: "Neon Vortex",
    description: "Esquiva las porciones que giran alrededor del cilindro neón y sobrevive el mayor tiempo posible.",
    path: "/games/neon-cylinder/",
    instructions: "Gira el cilindro con las flechas Izquierda/Derecha (o tocando los lados de la pantalla) para esquivar las porciones que giran. Aguanta lo maximo posible.",
    accent: "#ff00e6",
    category: "Arcade",
  },
  {
    id: "flappy-bird",
    title: "Flappy Bird",
    description: "Aletea para mantener al pájaro en el aire y cruza la mayor cantidad de tubos sin chocar.",
    path: "/games/flappy-bird/",
    instructions: "Toca la pantalla o presiona Espacio para aletear. Manten al pajaro en el aire y cruza la mayor cantidad de tubos sin chocar.",
    accent: "#4ec0e6",
    category: "Arcade",
  },
  {
    id: "stack-tower",
    title: "Torre Infinita",
    description: "Suelta cada bloque en el momento justo para apilar la torre más alta sin que se te escape.",
    path: "/games/stack-tower/",
    instructions: "Toca la pantalla o presiona Espacio para soltar cada bloque. Sueltalo justo cuando este alineado con el de abajo para que la torre no se achique.",
    accent: "#5ce1a6",
    category: "Precisión",
  },
  {
    id: "rhythm-tap",
    title: "Beat Fever",
    description: "Toca las notas de colores justo al cruzar la línea, encadena combos y sobrevive sin quedarte sin vida.",
    path: "/games/rhythm-tap/",
    instructions: "Cada nota cae por un carril de color. Toca el carril (o usa las flechas) justo cuando la nota cruza la linea. Encadena combos y no te quedes sin vida.",
    accent: "#ff3f81",
    category: "Ritmo",
  },
  {
    id: "jump-ball",
    title: "Bounce Rush",
    description: "Corre hacia el horizonte saltando solo entre plataformas y cambia de carril a tiempo para no caer al vacío.",
    path: "/games/jump-ball/",
    instructions: "La pelota salta sola hacia adelante. Cambia de carril con las flechas Izquierda/Derecha (o tocando los lados) para caer siempre sobre una plataforma y no al vacio.",
    accent: "#ff8a3d",
    category: "Arcade",
  },
  {
    id: "reaction-time",
    title: "Reflex",
    description: "Pon a prueba tus reflejos en este juego de 5 rondas. El puntaje final es tu tiempo de reacción promedio.",
    path: "/games/reaction-time/",
    instructions: "Espera a que la pantalla cambie de color y toca (o presiona Enter) lo mas rapido que puedas. Son 5 rondas; tu puntaje es el tiempo promedio, asi que menos es mejor. Si te adelantas, cuenta como fallo.",
    accent: "#39ff14",
    category: "Reflejos",
  },
  {
    id: "city-bloxx",
    title: "Skyline",
    description: "Suelta cada piso desde la grúa en el momento justo y levanta el rascacielos más alto sin que el edificio pierda el equilibrio.",
    path: "/games/city-bloxx/",
    instructions: "El piso se balancea colgado de la grua. Toca la pantalla o presiona Espacio para soltarlo justo sobre el edificio y levantar el rascacielos mas alto sin que pierda el equilibrio.",
    accent: "#d9843f",
    category: "Precisión",
  },
  {
    id: "sliding-puzzle",
    title: "Numerix",
    description: "Ordena los numeros deslizando filas o columnas completas hacia el espacio vacio.",
    path: "/games/sliding-puzzle/",
    instructions: "Desliza filas o columnas completas hacia el espacio vacio (flechas, WASD o tocando) hasta ordenar los numeros del 1 en adelante. Resuelvelo en la menor cantidad de movimientos: menos es mejor.",
    accent: "#0ff8ff",
    category: "Puzzle",
  },
  {
    id: "asteroids",
    title: "Asteroides",
    description: "Navega con inercia, rota y dispara a rocas que se parten en este clásico juego de disparos espacial.",
    path: "/games/asteroids/",
    instructions: "Rota la nave con Izquierda/Derecha (o A/D), acelera con Arriba (W) y dispara con Espacio. La nave conserva inercia. Destroza las rocas: las grandes se parten en chicas.",
    accent: "#ff3f81",
    category: "Arcade",
  },
  {
    id: "mini-frogger",
    title: "Cruce Mortal",
    description: "Cruza calles transitadas y ríos saltando sobre troncos flotantes en el momento justo.",
    path: "/games/mini-frogger/",
    instructions: "Avanza paso a paso con las flechas o WASD (o tocando hacia donde quieras ir). Cruza calles esquivando autos y rios saltando sobre los troncos, sin caer al agua.",
    accent: "#39ff14",
    category: "Arcade",
  },
  {
    id: "car-race",
    title: "Neon Drift",
    description: "Carrera 2D de drift: 6 circuitos (Mónaco, Shanghái, Silverstone y más) con boosts, conos y barreras, ranking por pista y salas online.",
    path: "/games/car-race/",
    instructions: "Acelera con Arriba (o W), frena con Abajo (o S) y dobla con Izquierda/Derecha. Aprovecha los boosts, esquiva conos y barreras, y completa las vueltas en el menor tiempo.",
    accent: "#00f0ff",
    category: "Carreras",
  },
  {
    id: "odd-one-out",
    title: "Odd One Out",
    description: "Encuentra la ficha con el tono distinto antes de que se acabe el tiempo: la grilla crece y la diferencia se achica.",
    path: "/games/odd-one-out/",
    instructions: "En la grilla hay una ficha con un tono apenas distinto. Tocala antes de que se acabe el tiempo. Con cada acierto la grilla crece y la diferencia se achica.",
    accent: "#c084fc",
    category: "Reflejos",
  },
  {
    id: "kunai-throw",
    title: "Kunai Strike",
    description: "Arroja kunais y clávalos en el tronco que gira sin que un kunai golpee a otro.",
    path: "/games/kunai-throw/",
    instructions: "Toca la pantalla (o presiona Espacio) para arrojar un kunai y clavarlo en el tronco que gira. Cuidado: si un kunai golpea a otro ya clavado, perdes.",
    accent: "#f5a623",
    category: "Precisión",
  },
  {
    id: "penalty-keeper",
    title: "Keepers!",
    description: "Sos el arquero en una tanda infinita de penales: movete y saltá para atajar. Tres goles y se termina.",
    path: "/games/penalty-keeper/",
    instructions: "Sos el arquero. Movete con las flechas Izquierda/Derecha y salta (Espacio o tocando) para llegar a la pelota y atajar los penales. Te sacan tres goles y se termina.",
    accent: "#38e07b",
    category: "Reflejos",
  },
  {
    id: "rocket-arena",
    title: "Rocket SpaceX",
    description: "Fútbol de autos en 3D estilo Rocket League: 2v2 con bots, o en salas con los autos de todos en vivo.",
    path: "/games/rocket-arena/",
    instructions: "Maneja tu auto-cohete (acelerar, doblar y saltar) y empuja la pelota gigante hacia el arco rival. 2 contra 2; gana el equipo que mete mas goles.",
    accent: "#3ba7ff",
    category: "Carreras",
  },
  {
    id: "monopoly-mundial",
    title: "Mundialopoly 2026",
    description: "El clásico juego de propiedades con temática de la Copa 2026: ficha selecciones, compra estadios sede y fundí a tus rivales. Solo contra bots o hasta 8 en salas online.",
    path: "/games/monopoly-mundial/",
    instructions: "Tira los dados en tu turno, recorre el tablero y compra estadios sede. Cobra alquiler cuando caen en tus casillas y funde a tus rivales para quedarte con todo.",
    accent: "#3fae5c",
    category: "Mesa",
  },
];

