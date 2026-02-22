import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}

export class gameRoom extends Room<GameState> {
  onCreate(options: any) {   // <-- options: any, NOT GameState
    this.setState(new GameState());

    this.onMessage("move", (client, data: { x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.x = data.x;
        player.y = data.y;
      }
    });
  }

  onJoin(client: Client) {
    this.state.players.set(client.sessionId, new Player());
    console.log(client.sessionId, "joined!");
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }
}