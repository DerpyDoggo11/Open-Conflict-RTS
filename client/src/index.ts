import { Client } from "colyseus.js";

const client = new Client("ws://localhost:2567");

async function init() {
  const room = await client.joinOrCreate("game_room");

  room.state.players.onAdd((player, sessionId) => {
    // add sprite for this player
    player.onChange(() => {
      // sync sprite position
    });
  });

  room.state.players.onRemove((_, sessionId) => {
    // remove sprite
  });
}