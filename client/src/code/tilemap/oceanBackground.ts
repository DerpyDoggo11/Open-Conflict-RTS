import * as PIXI from 'pixi.js';
import { type TiledMap } from '../types/tilemapTypes';

export function createOceanMesh(
  app: PIXI.Application,
  viewport: PIXI.Container,
  mapData: TiledMap
): void {
  const TILE_W = mapData.tilewidth * 2;
  const TILE_H = mapData.tileheight * 2;
  const SPREAD = 6;
  const totalCols = mapData.width + SPREAD * 4;
  const totalRows = mapData.height + SPREAD * 4;
  const offsetX = -(totalCols / 2);
  const offsetY = -(totalRows / 2);

  const cols = totalCols + 1;
  const rows = totalRows + 1;
  const heights = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.random() * Math.PI * 2)
  );

  const getVertex = (col: number, row: number, time: number) => {
    const tileX = col + offsetX;
    const tileY = row + offsetY;
    const phase = heights[row][col];
    const waveY = Math.sin(time * 2 + phase + col * 0.4 + row * 0.3) * 18
                + Math.sin(time * 1.3 + phase + col * 0.2) * 10;
    const screenX = (tileX - tileY) * (TILE_W / 2);
    const screenY = (tileX + tileY) * (TILE_H / 2) + waveY;
    return { x: screenX, y: screenY, waveY };
  };

  const getColor = (waveY: number): number => {
    const t = (waveY + 28) / 56;
    const deep =    { r: 0.29, g: 0.529, b: 0.549 }; //rgb01(0.29, 0.529, 0.549)
    const shallow = { r: 0.29, g: 0.529, b: 0.549 }; //rgb01(0.42, 0.741, 0.769)
    const foam =    { r: 0.349, g: 0.624, b: 0.651 };

    let r, g, b;
    if (t < 0.6) {
      const s = t / 0.6;
      r = deep.r + (shallow.r - deep.r) * s;
      g = deep.g + (shallow.g - deep.g) * s;
      b = deep.b + (shallow.b - deep.b) * s;
    } else {
      const s = (t - 0.6) / 0.4;
      r = shallow.r + (foam.r - shallow.r) * s;
      g = shallow.g + (foam.g - shallow.g) * s;
      b = shallow.b + (foam.b - shallow.b) * s;
    }
    return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
  };

  const halfW = (mapData.width / 2) * (TILE_W / 2) * 2;
  const halfH = (mapData.height / 2) * (TILE_H / 2) * 2;
  const diamondPoints = [
     0, -halfH,
     halfW, 0,
     0, halfH, 
    -halfW, 0, 
  ];

  const oceanBack = new PIXI.Graphics();
  viewport.addChildAt(oceanBack, 0);

  const oceanFront = new PIXI.Graphics();

  const mask = new PIXI.Graphics();
  const bigSize = 20000;
  mask.rect(-bigSize / 2, -bigSize / 2, bigSize, bigSize);
  mask.fill(0xffffff);
  mask.poly(diamondPoints);
  mask.cut();

  oceanFront.mask = mask;
  viewport.addChild(mask);
  viewport.addChild(oceanFront); 

  const drawOcean = (g: PIXI.Graphics, time: number) => {
    g.clear();
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        const tl = getVertex(col,     row,     time);
        const tr = getVertex(col + 1, row,     time);
        const br = getVertex(col + 1, row + 1, time);
        const bl = getVertex(col,     row + 1, time);

        const avgWave = (tl.waveY + tr.waveY + br.waveY + bl.waveY) / 4;
        const color = getColor(avgWave);
        g.poly([tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
        g.fill(color);
      }
    }
  };

  let time = 0;
  app.ticker.add((ticker) => {
    time += ticker.deltaTime * 0.03;
    drawOcean(oceanBack, time);
    drawOcean(oceanFront, time);
  });
}