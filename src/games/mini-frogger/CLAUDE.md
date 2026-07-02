
## Sound

`game/SoundEffects.ts` synthesizes all audio with the Web Audio API (no assets): a blip on each hop, a wet plop on a river drowning, and a harsh squash on a car hit or falling off screen. `killFrog(cause)` picks the death sound from its `"water" | "crash"` cause.

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("mini-frogger", { getScore: () => this.score })` (see root `CLAUDE.md`, "Salas (multiplayer rooms)"). With `?room=` in the URL the game-over reports the score to the room instead of the global ranking, and the restart input is blocked (one run per round). Without the param nothing changes.
