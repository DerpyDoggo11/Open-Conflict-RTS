import { Client, Room } from "@colyseus/sdk";

export interface ChatMessage {
  playerId: string;
  name: string;
  text: string;
  timestamp: number;
}

export class ColyseusClient {
  private client: Client;
  private room: Room | null = null;
  private chatListeners: ((msg: ChatMessage) => void)[] = [];

  constructor() {
    this.client = new Client("ws://localhost:2567");
  }

  async joinGame(playerName: string): Promise<void> {
    try {
      this.room = await this.client.joinOrCreate("game_room", { name: playerName });
      console.log("Joined room:", this.room.sessionId);

      this.room.onMessage("chat", (msg: ChatMessage) => {
        this.chatListeners.forEach(fn => fn(msg));
      });
    } catch (e) {
      console.error("Failed to join:", e);
      throw e;
    }
  }

  sendChat(text: string): void {
    if (!this.room || !text.trim()) return;
    this.room.send("chat", { text: text.trim() });
  }

  onChat(fn: (msg: ChatMessage) => void): void {
    this.chatListeners.push(fn);
  }

  get sessionId(): string {
    return this.room?.sessionId ?? "";
  }
}

export const colyseusClient = new ColyseusClient();