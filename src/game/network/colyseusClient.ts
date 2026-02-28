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
  private playerCountListeners: ((count: number, max: number) => void)[] = [];

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

      this.room.onMessage("playerCount", (msg: { count: number; max: number }) => {
        this.playerCountListeners.forEach(fn => fn(msg.count, msg.max));
      });

    } catch (e) {
      console.error("Failed to join:", e);
      throw e;
    }
  }

  async getRooms(): Promise<{ roomId: string; clients: number; maxClients: number }[]> {
    try {
      const res = await fetch("http://localhost:2567/rooms");
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }
  
  onPlayerCount(fn: (count: number, max: number) => void): void {
    this.playerCountListeners.push(fn);
  }

  sendChat(text: string): void {
    if (!this.room || !text.trim()) return;
    this.room.send("chat", { text: text.trim() });
  }

  onChat(fn: (msg: ChatMessage) => void): void {
    this.chatListeners.push(fn);
  }

  async leave(): Promise<void> {
    await this.room?.leave();
    this.room = null;
  }

  get sessionId(): string {
    return this.room?.sessionId ?? "";
  }
}

export const colyseusClient = new ColyseusClient();