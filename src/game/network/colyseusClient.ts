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

export interface TroopDamageMsg {
  id: string; newHealth: number; damage: number; attackerId: string;
}

export class ColyseusClient {
  private client: Client;
  private room: Room | null = null;
  private chatListeners: ((msg: ChatMessage) => void)[] = [];
  private playerCountListeners: ((count: number, max: number) => void)[] = [];
  private readyStateListeners: ((readyCount: number, totalCount: number) => void)[] = [];
  private tickListeners: ((tick: TickMessage) => void)[] = [];
  private gameStartListeners: (() => void)[] = [];
  private troopMoveListeners: ((msg: TroopMoveMsg) => void)[] = [];
  private troopSpawnListeners: ((msg: TroopSpawnMsg) => void)[] = [];
  private troopDiedListeners: ((id: string) => void)[] = [];
  private troopDamageListeners: ((msg: TroopDamageMsg) => void)[] = [];
  private _seenTroopIds = new Set<string>();


  constructor() {
    this.client = new Client("ws://localhost:2567");
  }

  async joinGame(playerName: string): Promise<void> {
    this.troopSpawnListeners = [];
    this.troopMoveListeners = [];
    this.troopDiedListeners = [];
    this.troopDamageListeners = [];
    this.tickListeners = [];
    this.playerCountListeners = [];
    this.gameStartListeners = [];
    this.readyStateListeners = [];
    this._seenTroopIds.clear();

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
      this.room.onMessage("troopDamage", (msg: TroopDamageMsg) => {
        this.troopDamageListeners.forEach(fn => fn(msg));
      });
      this.room.onMessage("playerReady", (msg: { readyCount: number; totalCount: number }) => {
        this.readyStateListeners.forEach(fn => fn(msg.readyCount,msg.totalCount));
      });
      this.room.onMessage("playersUpdate", (teams) => {
        this.playersUpdateListeners.forEach(fn => fn(teams));
      });
      this.room.onStateChange.once(() => {
        const callbacks = Callbacks.get(this.room!);
        callbacks.onAdd("troops", (troop: any, troopId: unknown) => {
          const id = troopId as string;
          if (this._seenTroopIds.has(id)) return;
          this._seenTroopIds.add(id);

          const msg: TroopSpawnMsg = {
              id,
              type: troop.type,
              tileX: troop.tileX,
              tileY: troop.tileY,
              health: troop.health,
              ownerId: troop.ownerId,
          };

          this.troopSpawnListeners.forEach(fn => fn(msg));

          callbacks.onChange(troop, () => {
              this.troopMoveListeners.forEach(fn => fn({
                  id,
                  tileX: troop.tileX,
                  tileY: troop.tileY,
              })
            );
          });
        });

        callbacks.onRemove("troops", (_troop: any, troopId: unknown) => {
            const id = troopId as string;
            this._seenTroopIds.delete(id);
            this.troopDiedListeners.forEach(fn => fn(id));
        });
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

  sendAttackTile(attackerId: string, targetTileX: number, targetTileY: number, damage: number, shots: number = 1): void {
    this.room?.send('attackTile', { attackerId, targetTileX, targetTileY, damage, shots });
  }

  onReadyStateChange(fn: (readyCount: number, totalCount: number) => void): void {
    this.readyStateListeners.push(fn);
  }

  sendReady(isReady: boolean): void {
    this.room?.send("ready", { isReady });
  }

  private playersUpdateListeners: ((teams: {
    teamName: string;
    players: { id: string; name: string }[];
  }[]) => void)[] = [];

  onPlayersUpdate(fn: (teams: { teamName: string; players: { id: string; name: string }[] }[]) => void): void {
    this.playersUpdateListeners.push(fn);
  }

  onTroopSpawn(fn: (msg: TroopSpawnMsg) => void): void { this.troopSpawnListeners.push(fn); }
  onTroopMove(fn: (msg: TroopMoveMsg) => void): void { this.troopMoveListeners.push(fn); }
  onTroopDied(fn: (id: string) => void): void { this.troopDiedListeners.push(fn); }
  onTroopDamage(fn: (msg: TroopDamageMsg) => void): void { this.troopDamageListeners.push(fn); }
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