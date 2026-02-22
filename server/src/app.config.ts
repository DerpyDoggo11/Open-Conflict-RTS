import { defineServer, defineRoom } from "colyseus";
import { gameRoom } from "./rooms/gameRoom.js";

const server = defineServer({
  rooms: {
    game_room: defineRoom(gameRoom),
  },
});

server.listen(2567);