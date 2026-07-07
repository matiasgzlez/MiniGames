import { createRequire } from "node:module";

/**
 * Diccionario de espanol embebido en el server (an-array-of-spanish-words:
 * ~636k palabras). Vive SOLO aca: la validacion de palabras es autoritativa y no
 * spoofeable, y el diccionario nunca pesa en el bundle del front.
 *
 * Se carga con createRequire porque el paquete es un index.json plano (un array
 * de strings), mas robusto que un import JSON con attributes en ESM.
 */
const require = createRequire(import.meta.url);
const RAW: string[] = require("an-array-of-spanish-words");

/** Longitudes de fragmento (silaba/combo) que se ofrecen como reto. */
const FRAGMENT_LENGTHS = [2, 3] as const;
/** Un fragmento solo es jugable si existe en al menos esta cantidad de palabras. */
const MIN_WORDS_PER_FRAGMENT = 500;

/**
 * Normaliza para comparar: minuscula, saca acentos de vocales y dieresis, pero
 * CONSERVA la ñ. Asi "canción" cuenta para el fragmento "cion" y el jugador puede
 * escribir con o sin tilde. Descarta todo lo que no sea [a-zñ].
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    // U+0301 acento agudo (á é í ó ú), U+0308 dieresis (ü). No se toca U+0303
    // (la tilde de la ñ), asi la ñ sobrevive al recomponer.
    .replace(/[́̈]/g, "")
    .normalize("NFC")
    .replace(/[^a-zñ]/g, "");
}

const WORDS = new Set<string>();
/** Fragmento -> cantidad de palabras que lo contienen (solo los jugables). */
const FRAGMENTS: string[] = [];

function build(): void {
  const counts = new Map<string, number>();
  for (const raw of RAW) {
    const w = normalize(raw);
    if (w.length < 3) continue; // palabras muy cortas no aportan como respuesta
    WORDS.add(w);
    // Substrings distintos de este palabra, para no contar dos veces "ana" en "banana".
    const seen = new Set<string>();
    for (const len of FRAGMENT_LENGTHS) {
      for (let i = 0; i + len <= w.length; i++) {
        const frag = w.slice(i, i + len);
        if (seen.has(frag)) continue;
        seen.add(frag);
        counts.set(frag, (counts.get(frag) ?? 0) + 1);
      }
    }
  }
  for (const [frag, n] of counts) {
    if (n >= MIN_WORDS_PER_FRAGMENT) FRAGMENTS.push(frag);
  }
}

build();

/** Cuantas palabras conoce el diccionario (para el log de arranque). */
export function wordCount(): number {
  return WORDS.size;
}

/** Cuantos fragmentos jugables se precomputaron. */
export function fragmentCount(): number {
  return FRAGMENTS.length;
}

/** Un fragmento jugable al azar (garantiza que exista una solucion). */
export function randomFragment(): string {
  return FRAGMENTS[Math.floor(Math.random() * FRAGMENTS.length)];
}

export type WordCheck = "ok" | "not-a-word" | "missing-fragment";

/**
 * Valida una palabra cruda contra un fragmento. No chequea repeticion (eso lo
 * lleva el sim con su set de usadas). Devuelve la forma normalizada para que el
 * llamador la guarde como "usada".
 */
export function checkWord(input: string, fragment: string): { result: WordCheck; normalized: string } {
  const normalized = normalize(input);
  if (!normalized.includes(fragment)) return { result: "missing-fragment", normalized };
  if (!WORDS.has(normalized)) return { result: "not-a-word", normalized };
  return { result: "ok", normalized };
}
