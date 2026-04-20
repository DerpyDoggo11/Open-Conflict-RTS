import { Callbacks, Client, Room } from "@colyseus/sdk";
import { SERVER_HTTP_URL, SERVER_WS_URL } from "./serverConfig";

export interface ChatMessage {
  playerId: string; name: string; text: string; timestamp: number;
}

export interface TickMessage {
  timeRemaining: number; intermissionDuration: number; gameDuration: number;
}

export interface TroopSpawnMsg {
  id: string; type: string; tileX: number; tileY: number;
  health: number; ownerId: string;
  facingDx?: number; facingDy?: number;
}

export interface TroopMoveMsg {
  id: string; tileX: number; tileY: number;
}

export interface TroopDamageMsg {
  id: string; newHealth: number; damage: number; attackerId: string;
}

export interface SplashDamageVictim {
  id: string;
  newHealth: number;
  totalDamage: number;
}

export interface SplashDamageMsg {
  attackerId: string;
  targetTileX: number;
  targetTileY: number;
  shots: number;
  projectileDamage: number;
  victims: SplashDamageVictim[];
}

export interface TroopSnapshotEntry {
  id: string; type: string; tileX: number; tileY: number;
  health: number; ownerId: string; facingDx: number; facingDy: number;
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
  private splashDamageListeners: ((msg: SplashDamageMsg) => void)[] = [];
  private troopSnapshotListeners: ((troops: TroopSnapshotEntry[]) => void)[] = [];
  private roleListeners: ((role: string, team?: string) => void)[] = [];
  private _seenTroopIds = new Set<string>();

  private _pendingSpawnBuffer: TroopSpawnMsg[] = [];
  private _pendingSnapshotBuffer: TroopSnapshotEntry[][] = [];

  public isSpectator: boolean = false;


  constructor() {
    this.client = new Client(SERVER_WS_URL);
  }

  async joinGameAsSpectator(roomId: string): Promise<void> {
    const playerName = localStorage.getItem('playerName') ?? 'Spectator';
    this.isSpectator = true;
    await this._joinRoom(roomId, playerName, true);
  }

  async joinGame(playerName: string): Promise<void> {
    this.isSpectator = false;

    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('roomId');
    await this._joinRoom(roomId, playerName, false);
  }

  private async _joinRoom(roomId: string | null, playerName: string, spectate: boolean): Promise<void> {
    this.troopSpawnListeners = [];
    this.troopMoveListeners = [];
    this.troopDiedListeners = [];
    this.troopDamageListeners = [];
    this.splashDamageListeners = [];
    this.troopSnapshotListeners = [];
    this.tickListeners = [];
    this.playerCountListeners = [];
    this.gameStartListeners = [];
    this.readyStateListeners = [];
    this.roleListeners = [];
    this._seenTroopIds.clear();
    this._pendingSpawnBuffer = [];
    this._pendingSnapshotBuffer = [];

    try {
      if (roomId) {
        this.room = await this.client.joinById(roomId, { name: playerName, spectate });
      } else {
        this.room = await this.client.joinOrCreate("game_room", { name: playerName, spectate });
      }

      this.room.onMessage("assignRole", (msg: { role: string; team?: string }) => {
        this.isSpectator = msg.role === "spectator";
        this.roleListeners.forEach(fn => fn(msg.role, msg.team));
      });

      this.room.onMessage("troopSnapshot", (msg: { troops: TroopSnapshotEntry[] }) => {
        for (const t of msg.troops) {
          this._seenTroopIds.add(t.id);
        }

        if (this.troopSnapshotListeners.length === 0) {
          this._pendingSnapshotBuffer.push(msg.troops);
        } else {
          this.troopSnapshotListeners.forEach(fn => fn(msg.troops));
        }
      });

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
      this.room.onMessage("splashDamage", (msg: SplashDamageMsg) => {
        this.splashDamageListeners.forEach(fn => fn(msg));
      });
      this.room.onMessage("playerReady", (msg: { readyCount: number; totalCount: number }) => {
        this.readyStateListeners.forEach(fn => fn(msg.readyCount, msg.totalCount));
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

          if (this.troopSpawnListeners.length === 0) {
            this._pendingSpawnBuffer.push(msg);
          } else {
            this.troopSpawnListeners.forEach(fn => fn(msg));
          }

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

  spawnTroop(id: string, type: string, tileX: number, tileY: number, health: number,
             facingDx: number = 1, facingDy: number = 1): void {
    if (this.isSpectator) return;
    this.room?.send("spawnTroop", { id, type, tileX, tileY, health, facingDx, facingDy });
  }

  moveTroop(id: string, tileX: number, tileY: number): void {
    if (this.isSpectator) return;
    this.room?.send("moveTroop", { id, tileX, tileY });
  }

  attackTroop(attackerId: string, targetId: string, damage: number): void {
    if (this.isSpectator) return;
    this.room?.send("attackTroop", { attackerId, targetId, damage });
  }

  sendAttackTile(attackerId: string, targetTileX: number, targetTileY: number, damage: number, shots: number = 1): void {
    if (this.isSpectator) return;
    this.room?.send('attackTile', { attackerId, targetTileX, targetTileY, damage, fireRate: shots });
  }

  sendSplashAttackTile(
    attackerId: string, targetTileX: number, targetTileY: number,
    damage: number, shots: number, splashRadius: number,
  ): void {
    if (this.isSpectator) return;
    this.room?.send('splashAttackTile', {
      attackerId, targetTileX, targetTileY, damage, fireRate: shots, splashRadius,
    });
  }

  onReadyStateChange(fn: (readyCount: number, totalCount: number) => void): void {
    this.readyStateListeners.push(fn);
  }

  sendReady(isReady: boolean): void {
    if (this.isSpectator) return;
    this.room?.send("ready", { isReady });
  }

  private playersUpdateListeners: ((teams: {
    teamName: string;
    players: { id: string; name: string }[];
  }[]) => void)[] = [];

  onPlayersUpdate(fn: (teams: { teamName: string; players: { id: string; name: string }[] }[]) => void): void {
    this.playersUpdateListeners.push(fn);
  }

  onRole(fn: (role: string, team?: string) => void): void { this.roleListeners.push(fn); }

  onTroopSpawn(fn: (msg: TroopSpawnMsg) => void): void {
    this.troopSpawnListeners.push(fn);
    if (this._pendingSpawnBuffer.length > 0) {
      const buffered = this._pendingSpawnBuffer.splice(0);
      for (const msg of buffered) {
        this.troopSpawnListeners.forEach(listener => listener(msg));
      }
    }
  }

  onTroopSnapshot(fn: (troops: TroopSnapshotEntry[]) => void): void {
    this.troopSnapshotListeners.push(fn);
    if (this._pendingSnapshotBuffer.length > 0) {
      const buffered = this._pendingSnapshotBuffer.splice(0);
      for (const troops of buffered) {
        this.troopSnapshotListeners.forEach(listener => listener(troops));
      }
    }
  }

  onTroopMove(fn: (msg: TroopMoveMsg) => void): void { this.troopMoveListeners.push(fn); }
  onTroopDied(fn: (id: string) => void): void { this.troopDiedListeners.push(fn); }
  onTroopDamage(fn: (msg: TroopDamageMsg) => void): void { this.troopDamageListeners.push(fn); }
  onSplashDamage(fn: (msg: SplashDamageMsg) => void): void { this.splashDamageListeners.push(fn); }
  onTick(fn: (tick: TickMessage) => void): void { this.tickListeners.push(fn); }
  onGameStart(fn: () => void): void { this.gameStartListeners.push(fn); }
  onPlayerCount(fn: (count: number, max: number) => void): void { this.playerCountListeners.push(fn); }
  onChat(fn: (msg: ChatMessage) => void): void { this.chatListeners.push(fn); }
  sendChat(text: string): void { if (this.room && text.trim()) this.room.send("chat", { text: text.trim() }); }

  async getRooms(): Promise<{ roomId: string; clients: number; maxClients: number }[]> {
    try {
      const res = await fetch(`${SERVER_HTTP_URL}/rooms`);
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  }

  async leave(): Promise<void> { await this.room?.leave(); this.room = null; }
  get sessionId(): string { return this.room?.sessionId ?? ""; }
}

export const colyseusClient = new ColyseusClient();