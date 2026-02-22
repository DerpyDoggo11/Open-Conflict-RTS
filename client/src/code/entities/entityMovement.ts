import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';
import { tileToScreen, screenToTile } from '../tilemap/tilemapUtils';
import {
  clearArrow, clearSelection, drawArrowToTile,
  spawnSelectionRadius, swapNearbyTrees, initArrow, initSelection
} from './selectionUtils';

export interface CharacterMovementOptions {
  selectionGid?: number;
  selectionRadius?: number;
  treeSwapRadius?: number;
  holdDurationMs?: number;
  spritePath?: string;
}

export class CharacterMovement {
  public sprite: PIXI.Sprite;
  public tileX: number;
  public tileY: number;
  public isSelected: boolean = false;

  private objectsTilemap: CompositeTilemap;
  private tilesetTextures: Map<number, PIXI.Texture>;
  private mapData: TiledMap;
  private viewport: PIXI.Container;
  private app: PIXI.Application;

  private selectionGid: number;
  private selectionRadius: number;
  private treeSwapRadius: number;
  private spritePath: string;

  private holdTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    sprite: PIXI.Sprite,
    tileX: number,
    tileY: number,
    app: PIXI.Application,
    viewport: PIXI.Container,
    objectsTilemap: CompositeTilemap,
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

    this.selectionGid = options.selectionGid ?? 6;
    this.selectionRadius = options.selectionRadius ?? 2;
    this.treeSwapRadius = options.treeSwapRadius ?? 0;
    this.spritePath = options.spritePath ?? "";

    this.bindInputEvents();
  }

  private bindInputEvents(): void {
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', this.onPointerDown, this);
    this.app.stage.on('pointerup', this.onPointerUp, this);
  }

  public destroy(): void {
    this.app.stage.off('pointerdown', this.onPointerDown, this);
    this.app.stage.off('pointerup', this.onPointerUp, this);
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private onPointerDown = (e: PIXI.FederatedPointerEvent): void => {
    const worldPos = this.viewport.toLocal(e.global);
    const { tileX, tileY } = screenToTile(worldPos.x, worldPos.y, this.mapData);
    const isCharTile = tileX === this.tileX && tileY === this.tileY;

    if (isCharTile && !this.isSelected) {
      this.holdTimer = setTimeout(() => {
        this.open();
        this.holdTimer = null;
      }, 50);
    }
  };

  private onPointerUp = (e: PIXI.FederatedPointerEvent): void => {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
      return;
    }

    if (this.isSelected) {
      const worldPos = this.viewport.toLocal(e.global);
      const { tileX, tileY } = screenToTile(worldPos.x, worldPos.y, this.mapData);
      const isCharTile = tileX === this.tileX && tileY === this.tileY;

      if (isCharTile) {
        this.close();
      }
    }
  };

  public open(): void {
    spawnSelectionRadius(
      this.tilesetTextures, this.tileX, this.tileY,
      this.selectionRadius, this.selectionGid, this.mapData,
      (tx, ty) => drawArrowToTile(this.tileX, this.tileY, tx, ty, this.mapData),
      () => clearArrow(),
      (tx, ty) => {
        this.moveTo(tx, ty);
        this.close();
      }
    );
    swapNearbyTrees(this.objectsTilemap, this.tilesetTextures, this.tileX, this.tileY, this.treeSwapRadius, this.mapData, true);
    this.isSelected = true;
  }

  public close(): void {
    clearSelection();
    clearArrow();
    swapNearbyTrees(this.objectsTilemap, this.tilesetTextures, this.tileX, this.tileY, this.treeSwapRadius, this.mapData, false);
    swapNearbyTrees(this.objectsTilemap, this.tilesetTextures, this.tileX, this.tileY, 3, this.mapData, true);
    this.isSelected = false;
  }

    private updateSpriteDirection(prevTileX: number, prevTileY: number): void {
        const dx = this.tileX - prevTileX;
        const dy = this.tileY - prevTileY;

        const nx = dx === 0 ? 0 : dx / Math.abs(dx);
        const ny = dy === 0 ? 0 : dy / Math.abs(dy);

        console.log("nx" + nx);
        console.log("ny" + ny);


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
    this.updateSpriteDirection(prevTileX, prevTileY);

    clearSelection();
    clearArrow();
    swapNearbyTrees(this.objectsTilemap, this.tilesetTextures, prevTileX, prevTileY, this.treeSwapRadius, this.mapData, false);

    spawnSelectionRadius(
      this.tilesetTextures, this.tileX, this.tileY,
      this.selectionRadius, this.selectionGid, this.mapData,
      (tx, ty) => drawArrowToTile(this.tileX, this.tileY, tx, ty, this.mapData),
      () => clearArrow(),
      (tx, ty) => {
        this.moveTo(tx, ty);
        this.close();
      }
    );

    swapNearbyTrees(this.objectsTilemap, this.tilesetTextures, this.tileX, this.tileY, this.treeSwapRadius, this.mapData, true);
    swapNearbyTrees(this.objectsTilemap, this.tilesetTextures, this.tileX, this.tileY, 2, this.mapData, true);
  }
}