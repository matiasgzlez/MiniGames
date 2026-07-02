
## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("mini-frogger", { getScore: () => this.score })` (see root `CLAUDE.md`, "Salas (multiplayer rooms)"). With `?room=` in the URL the game-over reports the score to the room instead of the global ranking, and the restart input is blocked (one run per round). Without the param nothing changes.
