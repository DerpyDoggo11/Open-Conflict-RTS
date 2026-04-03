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
}

export class CharacterMovement {
  public sprite: PIXI.Sprite;
  public tileX: number;
  public tileY: number;
  public isSelected: boolean = false;

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

  private selectionTileSprite: PIXI.Sprite | null = null;

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

    this.bindInputEvents();
    this.sprite.zIndex = tileToScreen(tileX, tileY, this.mapData).y;
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

  private clearSelectionTile(): void {
    if (this.selectionTileSprite) {
      this.selectionTileSprite.destroy();
      this.selectionTileSprite = null;
    }
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

  private updateSpriteDirection(prevTileX: number, prevTileY: number): void {
    const dx = this.tileX - prevTileX;
    const dy = this.tileY - prevTileY;

    const nx = dx === 0 ? 0 : dx / Math.abs(dx);
    const ny = dy === 0 ? 0 : dy / Math.abs(dy);

    const directionMap: Record<string, string> = {
      '-1,-1': '0008', // NW
      '-1,0':  '0001', // W
      '-1,1':  '0002', // SW
      '0,1':   '0003', // S
      '1,1':   '0004', // SE
      '1,0':   '0005', // E
      '1,-1':  '0006', // NE
      '0,-1':  '0007', // N
    };

    const key = `${nx},${ny}`;
    const frame = directionMap[key];
    if (!frame) return;

    PIXI.Assets.load(`${this.spritePath}${frame}.png`).then((texture: PIXI.Texture) => {
      this.sprite.texture = texture;
    });
  }

  public moveTo(tileX: number, tileY: number): void {
    const prevTileX = this.tileX;
    const prevTileY = this.tileY;

    this.tileX = tileX;
    this.tileY = tileY;

    const screenPos = tileToScreen(tileX, tileY, this.mapData);
    this.sprite.position.set(screenPos.x, screenPos.y + this.mapData.tileheight / 2);
    this.sprite.zIndex = screenPos.y;
    this.updateSpriteDirection(prevTileX, prevTileY);

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
          zones.push({ x: char.tileX, y: char.tileY, radius: char.treeSwapRadius });
      }
      return zones;
  }

}
