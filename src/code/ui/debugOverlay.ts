import * as PIXI from 'pixi.js';
import { tileToScreen, screenToTile } from '../tilemap/tilemapUtils';
import type { TiledMap } from '../types/tilemapTypes';

export class DebugOverlay {
  private layer: PIXI.Container;
  private graphics: PIXI.Graphics;
  private label: PIXI.Text;
  private polygonPoints: { x: number; y: number }[] = [];
  private handles: PIXI.Graphics[] = [];
  private draggingIndex: number | null = null;
  private viewport: PIXI.Container;

  constructor(parent: PIXI.Container, viewport: PIXI.Container) {
    this.viewport = viewport;
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

  private drawIsoDiamond(x: number, y: number, w: number, h: number, color: number) {
    this.graphics.lineStyle(2, color, 1);
    this.graphics.moveTo(x, y - h / 2);
    this.graphics.lineTo(x + w / 2, y);
    this.graphics.lineTo(x, y + h / 2);
    this.graphics.lineTo(x - w / 2, y);
    this.graphics.lineTo(x, y - h / 2);
  }

  initPolygonEditor(mapData: TiledMap, app: PIXI.Application) {
    const layer = mapData.layers.find(l => l.name === 'Walkable');
    if (!layer?.objects?.[0]?.polygon) {
      console.warn('No polygon found on Walkable layer');
      return;
    }

    const obj = layer.objects[0];

    this.polygonPoints = obj.polygon!.map(p => ({
      x: obj.x + p.x,
      y: obj.y + p.y,
    }));

    this.rebuildHandles(app);
    this.redrawPolygon();
    this.createExportButton();
  }

  private rebuildHandles(app: PIXI.Application) {
    for (const h of this.handles) h.destroy();
    this.handles = [];

    this.polygonPoints.forEach((pt, i) => {
      const handle = new PIXI.Graphics();
      handle.beginFill(0xff0000, 1);
      handle.drawCircle(0, 0, 12);
      handle.endFill();
      handle.lineStyle(2, 0xffffff, 1);
      handle.drawCircle(0, 0, 12);
      handle.position.set(pt.x, pt.y);
      handle.eventMode = 'static';
      handle.cursor = 'grab';

      handle.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this.draggingIndex = i;
        handle.cursor = 'grabbing';
      });

      this.layer.addChild(handle);
      this.handles.push(handle);
    });

    app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (this.draggingIndex === null) return;
      const worldPos = this.viewport.toLocal(e.global);
      this.polygonPoints[this.draggingIndex].x = worldPos.x;
      this.polygonPoints[this.draggingIndex].y = worldPos.y;
      this.handles[this.draggingIndex].position.set(worldPos.x, worldPos.y);
      this.redrawPolygon();
    });

    app.stage.on('pointerup', () => {
      if (this.draggingIndex !== null) {
        this.handles[this.draggingIndex].cursor = 'grab';
        this.draggingIndex = null;
      }
    });
  }

  private redrawPolygon() {
    this.graphics.clear();

    if (this.polygonPoints.length === 0) return;

    this.graphics.beginFill(0x0055ff, 0.2);
    this.graphics.lineStyle(2, 0x0055ff, 0.8);
    this.graphics.moveTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
    for (let i = 1; i < this.polygonPoints.length; i++) {
      this.graphics.lineTo(this.polygonPoints[i].x, this.polygonPoints[i].y);
    }
    this.graphics.lineTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
    this.graphics.endFill();

    this.polygonPoints.forEach((pt, i) => {
      this.graphics.lineStyle(0);
      this.graphics.beginFill(0xffffff, 0.8);
    });
  }

  private createExportButton() {
    const existing = document.getElementById('debug-export-btn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'debug-export-btn';
    btn.textContent = 'Export Polygon Points';
    btn.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 9999;
      padding: 10px 18px;
      background: #0055ff;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-family: monospace;
    `;

    btn.addEventListener('click', () => {
      const output = this.polygonPoints.map((pt, i) => ({
        index: i,
        x: Math.round(pt.x * 100) / 100,
        y: Math.round(pt.y * 100) / 100,
      }));

      const tiledPolygon = this.polygonPoints.map(pt => ({
        x: Math.round(pt.x * 100) / 100,
        y: Math.round(pt.y * 100) / 100,
      }));

      const jsonStr = JSON.stringify({
        x: 0,
        y: 0,
        polygon: tiledPolygon
      }, null, 2);

      console.log(jsonStr);

      navigator.clipboard.writeText(jsonStr).then(() => {
        btn.textContent = 'Copied to clipboard!';
        btn.style.background = '#00aa44';
        setTimeout(() => {
          btn.textContent = 'Export Polygon Points';
          btn.style.background = '#0055ff';
        }, 2000);
      });
    });

    document.body.appendChild(btn);
  }

  update(worldX: number, worldY: number, tileX: number, tileY: number, mapData: TiledMap) {
    this.redrawPolygon();

    const w = mapData.tilewidth;
    const h = mapData.tileheight;

    this.drawIsoDiamond(worldX, worldY, w, h, 0x00ff00);

    const tileScreen = tileToScreen(tileX, tileY, mapData);
    this.drawIsoDiamond(tileScreen.x, tileScreen.y, w, h, 0xff0000);

    this.graphics.beginFill(0xffffff);
    this.graphics.drawCircle(tileScreen.x, tileScreen.y, 5);
    this.graphics.endFill();

    this.label.text = `pixel(${worldX.toFixed(0)}, ${worldY.toFixed(0)})\ntile(${tileX}, ${tileY})`;
    this.label.position.set(tileScreen.x + 10, tileScreen.y - 10);
  }

  getPolygonPoints(): { x: number; y: number }[] {
    return this.polygonPoints;
  }
}