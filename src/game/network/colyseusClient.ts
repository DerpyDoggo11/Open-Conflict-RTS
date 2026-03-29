import { Callbacks, Client, Room } from "@colyseus/sdk";

export interface ChatMessage {
  playerId: string; name: string; text: string; timestamp: number;
}

export interface TickMessage {
  timeRemaining: number; intermissionDuration: number; gameDuration: number;
}

export interface TroopSpawnMsg {
  id: string; type: string; tileX: number; tileY: number;
  health: number; ownerId: string;
}

export interface TroopMoveMsg {
  id: string; tileX: number; tileY: number;
}

export class ColyseusClient {
  private client: Client;
  private room: Room | null = null;
  private chatListeners: ((msg: ChatMessage) => void)[] = [];
  private playerCountListeners: ((count: number, max: number) => void)[] = [];
  private tickListeners: ((tick: TickMessage) => void)[] = [];
  private gameStartListeners: (() => void)[] = [];
  private troopMoveListeners: ((msg: TroopMoveMsg) => void)[] = [];
  private troopSpawnListeners: ((msg: TroopSpawnMsg) => void)[] = [];
  private troopDiedListeners: ((id: string) => void)[] = [];

  constructor() {
    this.client = new Client("ws://localhost:2567");
  }

  async joinGame(playerName: string): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('roomId');

    try {
      this.room = roomId
        ? await this.client.joinById(roomId, { name: playerName })
        : await this.client.joinOrCreate("game_room", { name: playerName });
      
      this.room.onMessage("chat", (msg: ChatMessage) => {
        this.chatListeners.forEach(fn => fn(msg));
      });
      this.room.onMessage("playerCount", (msg: { count: number; max: number }) => {
        this.playerCountListeners.forEach(fn => fn(msg.count, msg.max));
      });
      this.room.onMessage("gameTick", (msg: TickMessage) => {
        this.tickListeners.forEach(fn => fn(msg));
      });
      this.room.onMessage("gameStart", () => {
        this.gameStartListeners.forEach(fn => fn());
      });
      this.room.onMessage("troopDied", (msg: { id: string }) => {
        this.troopDiedListeners.forEach(fn => fn(msg.id));
      });

      const callbacks = Callbacks.get(this.room);

      callbacks.onAdd("troops", (troop: any, id: unknown) => {
        const troopId = id as string;
        
        const msg: TroopSpawnMsg = {
          id: troopId,
          type: troop.type,
          tileX: troop.tileX,
          tileY: troop.tileY,
          health: troop.health,
          ownerId: troop.ownerId,
        };

        console.log("troop added:", msg);

        this.troopSpawnListeners.forEach(fn => fn(msg));

        callbacks.onChange(troop, () => {
          this.troopMoveListeners.forEach(fn => fn({
            id: troopId,
            tileX: troop.tileX,
            tileY: troop.tileY,
          }));
        });
      });

      callbacks.onRemove("troops", (_troop: any, id: unknown) => {
        this.troopDiedListeners.forEach(fn => fn(id as string));
      });

      callbacks.onRemove("troops", (_troop: any, id: unknown) => {
        this.troopDiedListeners.forEach(fn => fn(id as string));
      });

    } catch (e) {
      console.error("Failed to join:", e);
      throw e;
    }
  }

  spawnTroop(id: string, type: string, tileX: number, tileY: number, health: number): void {
    this.room?.send("spawnTroop", { id, type, tileX, tileY, health });
  }

  moveTroop(id: string, tileX: number, tileY: number): void {
    this.room?.send("moveTroop", { id, tileX, tileY });
  }

  attackTroop(attackerId: string, targetId: string, damage: number): void {
    this.room?.send("attackTroop", { attackerId, targetId, damage });
  }

  onTroopSpawn(fn: (msg: TroopSpawnMsg) => void): void { this.troopSpawnListeners.push(fn); }
  onTroopMove(fn: (msg: TroopMoveMsg) => void): void { this.troopMoveListeners.push(fn); }
  onTroopDied(fn: (id: string) => void): void { this.troopDiedListeners.push(fn); }
  onTick(fn: (tick: TickMessage) => void): void { this.tickListeners.push(fn); }
  onGameStart(fn: () => void): void { this.gameStartListeners.push(fn); }
  onPlayerCount(fn: (count: number, max: number) => void): void { this.playerCountListeners.push(fn); }
  onChat(fn: (msg: ChatMessage) => void): void { this.chatListeners.push(fn); }
  sendChat(text: string): void { if (this.room && text.trim()) this.room.send("chat", { text: text.trim() }); }

  async getRooms(): Promise<{ roomId: string; clients: number; maxClients: number }[]> {
    try {
      const res = await fetch("http://localhost:2567/rooms");
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  }

  async leave(): Promise<void> { await this.room?.leave(); this.room = null; }
  get sessionId(): string { return this.room?.sessionId ?? ""; }
}

export const colyseusClient = new ColyseusClient();