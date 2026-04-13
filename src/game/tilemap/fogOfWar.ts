import * as PIXI from 'pixi.js';
import { type TiledMap } from '../types/tilemapTypes';
import { tileToScreen } from '../tilemap/tilemapUtils';
import { CharacterMovement } from '../entities/entityMovement';


export class FogOfWar {
  private app: PIXI.Application;
  private mapData: TiledMap;
  private fogContainer: PIXI.Container;
  private fogTiles: Map<string, PIXI.Graphics> = new Map();
  private tickFn: (() => void) | null = null;
  private enabled = false;

  private darkness = 0.5;

  constructor(
    app: PIXI.Application,
    viewport: PIXI.Container,
    mapData: TiledMap,
  ) {
    this.app = app;
    this.mapData = mapData;

    this.fogContainer = new PIXI.Container();
    this.fogContainer.zIndex = 999998;
    this.fogContainer.eventMode = 'none';
    this.fogContainer.interactiveChildren = false;
    viewport.addChild(this.fogContainer);

    this.buildFogTiles();
  }

  private buildFogTiles(): void {
    const groundLayer = this.mapData.layers.find(l => l.name === 'Ground');
    if (!groundLayer?.chunks) return;

    const hw = this.mapData.tilewidth / 2;
    const hh = this.mapData.tileheight / 2;

    for (const chunk of groundLayer.chunks) {
      for (let i = 0; i < chunk.data.length; i++) {
        if (chunk.data[i] === 0) continue;

        const lx = i % chunk.width;
        const ly = Math.floor(i / chunk.width);
        const tileX = chunk.x + lx;
        const tileY = chunk.y + ly;
        const key = `${tileX},${tileY}`;

        if (this.fogTiles.has(key)) continue;

        const screen = tileToScreen(tileX, tileY, this.mapData);

        const g = new PIXI.Graphics();
        g.moveTo(0, -hh)
          .lineTo(hw, 0)
          .lineTo(0, hh)
          .lineTo(-hw, 0)
          .closePath()
          .fill({ color: 0x000000, alpha: this.darkness });

        g.position.set(screen.x, screen.y);
        g.visible = false;
        g.eventMode = 'none';

        this.fogContainer.addChild(g);
        this.fogTiles.set(key, g);
      }
    }
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;

    for (const g of this.fogTiles.values()) g.visible = true;

    this.tickFn = () => this.update();
    this.app.ticker.add(this.tickFn);
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    if (this.tickFn) {
      this.app.ticker.remove(this.tickFn);
      this.tickFn = null;
    }

    for (const g of this.fogTiles.values()) g.visible = false;
  }

  destroy(): void {
    this.disable();
    this.fogContainer.destroy({ children: true });
    this.fogTiles.clear();
  }

  private update(): void {
    const zones = CharacterMovement.getLocalVisionZones();

    for (const [key, g] of this.fogTiles) {
      const [tx, ty] = key.split(',').map(Number);

      let inVision = false;
      for (const zone of zones) {
        const dist = Math.abs(tx - zone.x) + Math.abs(ty - zone.y);
        if (dist <= zone.radius) {
          inVision = true;
          break;
        }
      }

      g.visible = !inVision;
    }

    CharacterMovement.updateEnemyVisibility();
  }
}