// debugOverlay.ts
import * as PIXI from 'pixi.js';
import { tileToScreen } from '../tilemap/tilemapUtils';
import type { TiledMap } from '../types/tilemapTypes';

export class DebugOverlay {
  private layer: PIXI.Container;
  private graphics: PIXI.Graphics;
  private label: PIXI.Text;

  constructor(parent: PIXI.Container) {
    this.layer = new PIXI.Container();
    parent.addChild(this.layer);

    this.graphics = new PIXI.Graphics();
    this.layer.addChild(this.graphics);

    this.label = new PIXI.Text('', {
      fill: '#ffffff',
      fontSize: 20,
      stroke: '#000',
    });
    this.layer.addChild(this.label);
  }

  private drawIsoDiamond(
    x: number,
    y: number,
    w: number,
    h: number,
    color: number
  ) {
    this.graphics.lineStyle(2, color, 1);

    this.graphics.moveTo(x, y - h / 2);      // top
    this.graphics.lineTo(x + w / 2, y);      // right
    this.graphics.lineTo(x, y + h / 2);      // bottom
    this.graphics.lineTo(x - w / 2, y);      // left
    this.graphics.lineTo(x, y - h / 2);      // close
  }

  update(worldX: number, worldY: number, tileX: number, tileY: number, mapData: TiledMap) {
    this.graphics.clear();

    const w = mapData.tilewidth;
    const h = mapData.tileheight;

    // Green diamond = cursor position
    this.drawIsoDiamond(worldX, worldY, w, h, 0x00ff00);

    // Red diamond = tileToScreen(tileX, tileY)
    const tileScreen = tileToScreen(tileX, tileY, mapData);
    this.drawIsoDiamond(tileScreen.x, tileScreen.y, w, h, 0xff0000);

    // White dot = tile origin
    this.graphics.beginFill(0xffffff);
    this.graphics.drawCircle(tileScreen.x, tileScreen.y, 5);
    this.graphics.endFill();

    // Label
    this.label.text = `(${tileX}, ${tileY})`;
    this.label.position.set(tileScreen.x + 10, tileScreen.y - 10);
  }
}
