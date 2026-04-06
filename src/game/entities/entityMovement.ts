import * as PIXI from 'pixi.js';
import { type TiledMap } from '../types/tilemapTypes';
import { tileToScreen, screenToTile } from '../tilemap/tilemapUtils';
import {
  clearArrow, clearSelection, drawArrowToTile,
  spawnSelectionRadius, updateTreeTransparency
} from './selectionUtils';

const FACING_TO_DIR: Record<string, number> = {
  '-1,0':  1,
  '-1,1':  2,
  '0,1':   3,
  '1,1':   4,
  '1,0':   5,
  '1,-1':  6,
  '0,-1':  7,
  '-1,-1': 8,
};

export type TroopAnimations = Map<number, Map<string, PIXI.Texture[]>>;

export interface CharacterMovementOptions {
  selectionRadius?: number;
  attackRadius?: number;
  treeSwapRadius?: number;
  spritePath?: string;
  isLocal?: boolean;
  spriteYOffset?: number;
  footprint?: {
    forward: number;
    backward: number;
    left: number;
    right: number;
  };
  animations?: TroopAnimations;
  animationSpeed?: number;
  moveSpeed?: number;
  shootLoops?: number;
}

export class CharacterMovement {
  public sprite: PIXI.AnimatedSprite;
  public tileX: number;
  public tileY: number;
  public isSelected: boolean = false;
  public facingDx: number = 1;
  public facingDy: number = 1;

  private objectsTilemap: PIXI.Container;
  private tilesetTextures: Map<number, PIXI.Texture>;
  private mapData: TiledMap;
  private viewport: PIXI.Container;
  private app: PIXI.Application;

  private selectionGid: number;
  private attackGid: number;
  private selectionRadius: number;
  private attackRadius: number;
  private treeSwapRadius: number;
  private spritePath: string;
  private spriteYOffset: number;
  private footprint: { forward: number; backward: number; left: number; right: number };

  private animations: TroopAnimations;
  private animationSpeed: number;
  private moveSpeed: number;
  private shootLoops: number;
  private lerpTickerFn: ((ticker: PIXI.Ticker) => void) | null = null;
  private targetScreenPos: { x: number; y: number } | null = null;
  private isMoving: boolean = false;

  private selectionTileSprite: PIXI.Sprite | null = null;

  public isLocal: boolean = true;
  public id: string = '';
  public ownerId: string = '';
  public health: number = 100;
  public maxHealth: number = 100;
  public troopType: string = '';
  public portraitPath: string = '';
  public teamId: string = '';

  private healthChangeListeners: ((hp: number) => void)[] = [];

  private static allCharacters: Set<CharacterMovement> = new Set();
  private static viewportBound = false;
  private static activeApp: PIXI.Application | null = null;
  private static activeViewport: PIXI.Container | null = null;
  private static activeMapData: TiledMap | null = null;

  constructor(
    sprite: PIXI.AnimatedSprite,
    tileX: number,
    tileY: number,
    app: PIXI.Application,
    viewport: PIXI.Container,
    objectsTilemap: PIXI.Container,
    tilesetTextures: Map<number, PIXI.Texture>,
    mapData: TiledMap,
    options: CharacterMovementOptions = {}
  ) {
    this.sprite = sprite;
    this.tileX = tileX;
    this.tileY = tileY;
    this.app = app;
    this.viewport = viewport;
    this.objectsTilemap = objectsTilemap;
    this.tilesetTextures = tilesetTextures;
    this.mapData = mapData;

    this.selectionGid = 6;
    this.attackGid = 8;
    this.selectionRadius = options.selectionRadius ?? 2;
    this.attackRadius = options.attackRadius ?? 3;
    this.treeSwapRadius  = options.treeSwapRadius ?? 0;
    this.spritePath = options.spritePath ?? '';
    this.spriteYOffset = options.spriteYOffset ?? 0;
    this.footprint = options.footprint ?? { forward: 0, backward: 0, left: 0, right: 0 };
    this.isLocal = options.isLocal ?? true;
    this.animations = options.animations ?? new Map();
    this.animationSpeed = options.animationSpeed ?? 12;
    this.moveSpeed = options.moveSpeed ?? 300;
    this.shootLoops = options.shootLoops ?? 1;

    this.playAnimation('Idle');
    this.bindInputEvents();
    this.updateZIndex();
    updateTreeTransparency(this.getTransparencyZones());
  }

  private facingToDirection(): number {
    return FACING_TO_DIR[`${this.facingDx},${this.facingDy}`] ?? 4;
  }

  public playAnimation(animName: string, onComplete?: () => void): void {
    if (this.animations.size === 0) return;

    const dirMap = this.animations.get(this.facingToDirection());
    let frames = dirMap?.get(animName);

    if (!frames || frames.length === 0) {
      frames = dirMap?.get('Idle'); 
      
      if (!frames || frames.length === 0) {
        frames = this.animations.get(4)?.get('Idle');
        if (!frames || frames.length === 0) return;
      }
      animName = 'Idle';
    }
    this.sprite.onComplete = undefined;
    this.sprite.textures = frames;
    this.sprite.animationSpeed = this.animationSpeed / 60;

    if (animName === 'Shoot') {
      this.sprite.loop = false;
      let remaining = this.shootLoops;
      this.sprite.onComplete = () => {
        remaining--;
        if (remaining > 0) {
          this.sprite.gotoAndPlay(0);
        } else {
          this.sprite.onComplete = undefined;
          onComplete?.();
          this.playAnimation('Idle');
        }
      };
    } else {
      this.sprite.loop = true;
    }

    this.sprite.gotoAndPlay(0);
  }

  private startLerp(targetX: number, targetY: number, onArrive: () => void): void {
    if (this.lerpTickerFn) {
      this.app.ticker.remove(this.lerpTickerFn);
      this.lerpTickerFn = null;
    }

    this.targetScreenPos = { x: targetX, y: targetY };
    this.isMoving = true;
    const pxPerMs = this.moveSpeed / 1000;

    // Use time-based lerp so tab-switching doesn't stall movement
    let lastTime = performance.now();

    this.lerpTickerFn = (_ticker: PIXI.Ticker) => {
      if (!this.targetScreenPos) return;

      const now = performance.now();
      const elapsed = now - lastTime;
      lastTime = now;

      const dx = this.targetScreenPos.x - this.sprite.x;
      const dy = this.targetScreenPos.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      const step = pxPerMs * elapsed;

      if (dist <= step) {
        this.sprite.position.set(this.targetScreenPos.x, this.targetScreenPos.y);
        this.targetScreenPos = null;
        this.isMoving = false;
        this.app.ticker.remove(this.lerpTickerFn!);
        this.lerpTickerFn = null;
        onArrive();
      } else {
        const r = step / dist;
        this.sprite.x += dx * r;
        this.sprite.y += dy * r;
      }
    };

    this.app.ticker.add(this.lerpTickerFn);
  }


  private bindInputEvents(): void {
    CharacterMovement.allCharacters.add(this);
    if (!CharacterMovement.viewportBound) {
      CharacterMovement.activeApp = this.app;
      CharacterMovement.activeViewport = this.viewport;
      CharacterMovement.activeMapData = this.mapData;
      this.viewport.eventMode = 'static';
      this.viewport.on('pointerup', CharacterMovement.onSharedPointerUp);
      this.viewport.on('pointermove', CharacterMovement.onSharedPointerMove);
      CharacterMovement.viewportBound = true;
    }
  }

  private static onSharedPointerUp = (e: PIXI.FederatedPointerEvent): void => {
    const vp = CharacterMovement.activeViewport!;
    const md = CharacterMovement.activeMapData!;
    const worldPos = vp.toLocal(e.global);
    const { tileX, tileY } = screenToTile(worldPos.x, worldPos.y, md);

    for (const char of CharacterMovement.allCharacters) {
      if (tileX === char.tileX && tileY === char.tileY) {
        e.stopPropagation();
        char.isSelected ? char.close() : char.open();
        return;
      }
    }
  };

  private static onSharedPointerMove = (e: PIXI.FederatedPointerEvent): void => {
    const vp = CharacterMovement.activeViewport!;
    const md = CharacterMovement.activeMapData!;
    const app = CharacterMovement.activeApp!;
    const worldPos = vp.toLocal(e.global);
    const { tileX, tileY } = screenToTile(worldPos.x, worldPos.y, md);

    let hovering = false;
    for (const char of CharacterMovement.allCharacters) {
      if (tileX === char.tileX && tileY === char.tileY) { hovering = true; break; }
    }
    app.canvas.style.cursor = hovering ? 'pointer' : 'default';
  };

  public destroy(): void {
    if (this.lerpTickerFn) {
      this.app.ticker.remove(this.lerpTickerFn);
      this.lerpTickerFn = null;
    }
    this.sprite.stop();
    this.sprite.destroy();
    CharacterMovement.allCharacters.delete(this);
    this.clearSelectionTile();
  }

  public setVisible(visible: boolean): void {
    this.sprite.visible = visible;
  }

  private clearSelectionTile(): void {
    if (this.selectionTileSprite) {
      this.selectionTileSprite.destroy();
      this.selectionTileSprite = null;
    }
  }

  private updateZIndex(): void {
    let maxSum = -Infinity;
    for (const t of this.getOccupiedTiles()) {
      const sum = t.tileX + t.tileY;
      if (sum > maxSum) maxSum = sum;
    }
    this.sprite.zIndex = maxSum - 0.5;
  }


  public open(): void { this.isSelected = true; }

  public openMove(): void {
    clearSelection();
    clearArrow();
    spawnSelectionRadius(
      this.tilesetTextures, this.tileX, this.tileY,
      this.selectionRadius, this.selectionGid,
      this.mapData, this,
      (tx, ty) => drawArrowToTile(this.tileX, this.tileY, tx, ty, this.mapData),
      () => clearArrow(),
      (tx, ty) => { this.moveTo(tx, ty); },
    );
  }

  public openAttack(
    onAttackTile?: (attackerId: string, targetTileX: number, targetTileY: number, damage: number, fireRate: number) => void,
    damage: number = 20,
    fireRate: number = 1,
  ): void {
    clearSelection();
    clearArrow();
    spawnSelectionRadius(
      this.tilesetTextures, this.tileX, this.tileY,
      this.attackRadius, this.attackGid,
      this.mapData, this,
      (tx, ty) => drawArrowToTile(this.tileX, this.tileY, tx, ty, this.mapData),
      () => clearArrow(),
      (tx, ty) => {
        clearSelection();
        clearArrow();
        const dx = tx - this.tileX;
        const dy = ty - this.tileY;
        if (dx !== 0 || dy !== 0) {
          this.facingDx = Math.sign(dx) as -1 | 0 | 1;
          this.facingDy = Math.sign(dy) as -1 | 0 | 1;
        }
        this.playAnimation('Shoot');
        onAttackTile?.(this.id, tx, ty, damage, fireRate);
      },
      true,        // isAttackMode
    );
  }

  public close(): void {
    clearSelection();
    clearArrow();
    this.clearSelectionTile();
    this.isSelected = false;
  }

  public moveTo(tileX: number, tileY: number): void {
    const dx = tileX - this.tileX;
    const dy = tileY - this.tileY;
    const isMovingToNew = dx !== 0 || dy !== 0;

    const prospectiveFdx = isMovingToNew ? (Math.sign(dx) as -1 | 0 | 1) : this.facingDx;
    const prospectiveFdy = isMovingToNew ? (Math.sign(dy) as -1 | 0 | 1) : this.facingDy;

    if (this.wouldCollide(tileX, tileY, prospectiveFdx, prospectiveFdy)) {
      clearSelection();
      clearArrow();
      return;
    }

    this.tileX = tileX;
    this.tileY = tileY;
    this.facingDx = prospectiveFdx;
    this.facingDy = prospectiveFdy;

    this.updateZIndex();
    this.playAnimation('Move');

    const screenPos = tileToScreen(tileX, tileY, this.mapData);
    const targetY = screenPos.y + this.mapData.tileheight / 2 + this.spriteYOffset;

    this.startLerp(screenPos.x, targetY, () => {
      this.playAnimation('Idle');
      updateTreeTransparency(this.getTransparencyZones());
    });

    clearSelection();
    clearArrow();
    updateTreeTransparency(this.getTransparencyZones());
  }

  public takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.healthChangeListeners.forEach(fn => fn(this.health));
  }

  public onHealthChange(fn: (hp: number) => void): void {
    this.healthChangeListeners.push(fn);
  }

  private getTransparencyZones(): { x: number; y: number; radius: number }[] {
    const zones: { x: number; y: number; radius: number }[] = [];
    for (const char of CharacterMovement.allCharacters) {
      if (!char.isLocal) continue;
      zones.push({ x: char.tileX, y: char.tileY, radius: char.treeSwapRadius });
    }
    return zones;
  }

  public getOccupiedTiles(): { tileX: number; tileY: number }[] {
    const { forward, backward, left, right } = this.footprint;
    const { facingDx: fdx, facingDy: fdy } = this;
    const rightDx = -fdy;
    const rightDy = fdx;

    const tiles = new Map<string, { tileX: number; tileY: number }>();
    for (let f = -backward; f <= forward; f++) {
      for (let s = -left; s <= right; s++) {
        const tx = this.tileX + fdx * f + rightDx * s;
        const ty = this.tileY + fdy * f + rightDy * s;
        tiles.set(`${tx},${ty}`, { tileX: tx, tileY: ty });
      }
    }
    return Array.from(tiles.values());
  }

  public static getAllOccupiedTiles(): { tileX: number; tileY: number }[] {
    const result: { tileX: number; tileY: number }[] = [];
    for (const char of CharacterMovement.allCharacters) result.push(...char.getOccupiedTiles());
    return result;
  }

  public static getAllOccupiedTilesExcluding(exclude: CharacterMovement): { tileX: number; tileY: number }[] {
    const result: { tileX: number; tileY: number }[] = [];
    for (const char of CharacterMovement.allCharacters) {
      if (char !== exclude) result.push(...char.getOccupiedTiles());
    }
    return result;
  }

  /** Get tiles occupied by non-local (enemy) characters */
  public static getEnemyOccupiedTiles(): { tileX: number; tileY: number; char: CharacterMovement }[] {
    const result: { tileX: number; tileY: number; char: CharacterMovement }[] = [];
    for (const char of CharacterMovement.allCharacters) {
      if (!char.isLocal) {
        for (const tile of char.getOccupiedTiles()) {
          result.push({ ...tile, char });
        }
      }
    }
    return result;
  }

  /** Find non-local (enemy) character at a given tile */
  public static getEnemyAtTile(tileX: number, tileY: number): CharacterMovement | null {
    for (const char of CharacterMovement.allCharacters) {
      if (char.isLocal) continue;
      for (const tile of char.getOccupiedTiles()) {
        if (tile.tileX === tileX && tile.tileY === tileY) return char;
      }
    }
    return null;
  }

  private getProspectiveTiles(toTileX: number, toTileY: number, fdx: number, fdy: number) {
    const { forward, backward, left, right } = this.footprint;
    const rightDx = -fdy;
    const rightDy = fdx;
    const tiles = new Map<string, { tileX: number; tileY: number }>();
    for (let f = -backward; f <= forward; f++) {
      for (let s = -left; s <= right; s++) {
        const tx = toTileX + fdx * f + rightDx * s;
        const ty = toTileY + fdy * f + rightDy * s;
        tiles.set(`${tx},${ty}`, { tileX: tx, tileY: ty });
      }
    }
    return Array.from(tiles.values());
  }

  public wouldCollide(toTileX: number, toTileY: number, pFdx: number, pFdy: number): boolean {
    const prospective = this.getProspectiveTiles(toTileX, toTileY, pFdx, pFdy);
    const otherSet = new Set(
      CharacterMovement.getAllOccupiedTilesExcluding(this).map(t => `${t.tileX},${t.tileY}`)
    );
    return prospective.some(t => otherSet.has(`${t.tileX},${t.tileY}`));
  }
}