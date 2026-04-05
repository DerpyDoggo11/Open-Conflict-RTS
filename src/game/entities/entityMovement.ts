import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';
import { tileToScreen, screenToTile } from '../tilemap/tilemapUtils';
import {
  clearArrow, clearSelection, drawArrowToTile,
  spawnSelectionRadius, initArrow, initSelection,
  updateTreeTransparency
} from './selectionUtils';

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
}

export class CharacterMovement {
  public sprite: PIXI.Sprite;
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



  private selectionTileSprite: PIXI.Sprite | null = null;

  public isLocal: boolean = true;

  public id: string = '';
  public ownerId: string = '';
  public health: number = 100;
  public maxHealth: number = 100;
  public troopType: string = '';
  public portraitPath: string = '';
  private healthChangeListeners: ((hp: number) => void)[] = [];

  private static allCharacters: Set<CharacterMovement> = new Set();
  private static viewportBound = false;
  private static activeApp: PIXI.Application | null = null;
  private static activeViewport: PIXI.Container | null = null;
  private static activeMapData: TiledMap | null = null;
    
  constructor(
    sprite: PIXI.Sprite,
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
    this.treeSwapRadius = options.treeSwapRadius ?? 0;
    this.spritePath = options.spritePath ?? '';

    this.spriteYOffset   = options.spriteYOffset ?? 0;
    this.footprint = options.footprint ?? { forward: 0, backward: 0, left: 0, right: 0 };

    this.isLocal = options.isLocal ?? true;

    this.bindInputEvents();
    this.updateZIndex();
    updateTreeTransparency(this.getTransparencyZones());
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
              if (char.isSelected) {
                  char.close();
              } else {
                  char.open();
              }
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
          if (tileX === char.tileX && tileY === char.tileY) {
              hovering = true;
              break;
          }
      }
      app.canvas.style.cursor = hovering ? 'pointer' : 'default';
  };

  public destroy(): void {
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
    const tiles = this.getOccupiedTiles();
    let maxSum = -Infinity;
    for (const t of tiles) {
      const sum = t.tileX + t.tileY;
      if (sum > maxSum) maxSum = sum;
    }
    
    this.sprite.zIndex = maxSum - 0.5;
  }

  public open(): void {
    this.isSelected = true;
  }

  public openMove(): void {
    clearSelection();
    clearArrow();
    spawnSelectionRadius(
      this.tilesetTextures, this.tileX, this.tileY,
      this.selectionRadius, this.selectionGid,
      this.mapData,
      this,
      (tx, ty) => drawArrowToTile(this.tileX, this.tileY, tx, ty, this.mapData),
      () => clearArrow(),
      (tx, ty) => { this.moveTo(tx, ty); },
    );
  }

  public openAttack(): void {
    clearSelection();
    clearArrow();
    spawnSelectionRadius(
      this.tilesetTextures, this.tileX, this.tileY,
      this.attackRadius, this.attackGid,
      this.mapData,
      this,
      (tx, ty) => drawArrowToTile(this.tileX, this.tileY, tx, ty, this.mapData),
      () => clearArrow(),
      (tx, ty) => {
        console.log('attack tile:', tx, ty);
        clearSelection();
        clearArrow();
      },
    );
  }

  public close(): void {
    clearSelection();
    clearArrow();
    this.clearSelectionTile();
    this.isSelected = false;
  }
  
  private updateSpriteDirection(): void {
    const directionMap: Record<string, string> = {
      '-1,-1': '0008',
      '-1,0':  '0001',
      '-1,1':  '0002',
      '0,1':   '0003',
      '1,1':   '0004',
      '1,0':   '0005',
      '1,-1':  '0006',
      '0,-1':  '0007',
    };

    const key = `${this.facingDx},${this.facingDy}`;
    const frame = directionMap[key];
    if (!frame) return;

    PIXI.Assets.load(`${this.spritePath}${frame}.png`).then((texture: PIXI.Texture) => {
      this.sprite.texture = texture;
    });
  }

  public moveTo(tileX: number, tileY: number): void {
    const prevTileX = this.tileX;
    const prevTileY = this.tileY;

    const dx = tileX - prevTileX;
    const dy = tileY - prevTileY;

    const isMoving = dx !== 0 || dy !== 0;
    const prospectiveFdx = isMoving ? (dx === 0 ? 0 : dx / Math.abs(dx)) : this.facingDx;
    const prospectiveFdy = isMoving ? (dy === 0 ? 0 : dy / Math.abs(dy)) : this.facingDy;

    if (this.wouldCollide(tileX, tileY, prospectiveFdx, prospectiveFdy)) {
      clearSelection();
      clearArrow();
      return;
    }

    this.tileX = tileX;
    this.tileY = tileY;
    this.facingDx = prospectiveFdx;
    this.facingDy = prospectiveFdy;

    const screenPos = tileToScreen(tileX, tileY, this.mapData);
    this.sprite.position.set(screenPos.x, screenPos.y + this.mapData.tileheight / 2 + this.spriteYOffset);
    this.updateZIndex();
    this.updateSpriteDirection();

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
    const rightDy =  fdx;

    const tiles = new Map<string, { tileX: number; tileY: number }>();

    const add = (tx: number, ty: number) => {
      tiles.set(`${tx},${ty}`, { tileX: tx, tileY: ty });
    };

    for (let f = -backward; f <= forward; f++) {
      for (let s = -left; s <= right; s++) {
        const tx = this.tileX + fdx * f + rightDx * s;
        const ty = this.tileY + fdy * f + rightDy * s;
        add(tx, ty);
      }
    }

    return Array.from(tiles.values());
  }

  public static getAllOccupiedTiles(): { tileX: number; tileY: number }[] {
    const result: { tileX: number; tileY: number }[] = [];
    for (const char of CharacterMovement.allCharacters) {
      result.push(...char.getOccupiedTiles());
    }
    return result;
  }
    
  public static getAllOccupiedTilesExcluding(exclude: CharacterMovement): { tileX: number; tileY: number }[] {
    const result: { tileX: number; tileY: number }[] = [];
    for (const char of CharacterMovement.allCharacters) {
      if (char === exclude) continue;
      result.push(...char.getOccupiedTiles());
    }
    return result;
  }

  private getProspectiveTiles(
    toTileX: number,
    toTileY: number,
    fdx: number,
    fdy: number,
  ): { tileX: number; tileY: number }[] {
    const { forward, backward, left, right } = this.footprint;

    const rightDx = -fdy;
    const rightDy =  fdx;

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

  public wouldCollide(toTileX: number, toTileY: number, prospectiveFdx: number, prospectiveFdy: number): boolean {
    const prospective = this.getProspectiveTiles(toTileX, toTileY, prospectiveFdx, prospectiveFdy);
    const otherTiles = CharacterMovement.getAllOccupiedTilesExcluding(this);
    const otherSet = new Set(otherTiles.map(t => `${t.tileX},${t.tileY}`));

    return prospective.some(t => otherSet.has(`${t.tileX},${t.tileY}`));
  }

}
