import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';
import { getChunkedTileGid, tileToScreen } from '../tilemap/tilemapUtils';

const TREE_GID = 2;
const TRANSPARENT_TREE_GID = 4;

let arrowGraphics: PIXI.Graphics | null = null;

export function initArrow(viewport: PIXI.Container): void {
  arrowGraphics = new PIXI.Graphics();
  viewport.addChild(arrowGraphics);
}

export function drawArrowToTile(
  fromTileX: number,
  fromTileY: number,
  toTileX: number,
  toTileY: number,
  mapData: TiledMap
): void {
  if (!arrowGraphics) return;
  arrowGraphics.clear();

  const from = tileToScreen(fromTileX, fromTileY, mapData);
  const to = tileToScreen(toTileX, toTileY, mapData);

  // Offset both points to the visual center of the diamond
  const cx = mapData.tilewidth / 2;
  const cy = mapData.tileheight / 2;

  const x1 = from.x + cx;
  const y1 = from.y + cy;
  const x2 = to.x + cx;
  const y2 = to.y + cy;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);
  const headLen = 14;

  // Line
  arrowGraphics.lineStyle(3, 0xffffff, 0.9);
  arrowGraphics.moveTo(x1, y1);
  arrowGraphics.lineTo(x2, y2);

  // Arrowhead
  arrowGraphics.beginFill(0xffffff, 0.9);
  arrowGraphics.moveTo(x2, y2);
  arrowGraphics.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6)
  );
  arrowGraphics.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6)
  );
  arrowGraphics.closePath();
  arrowGraphics.endFill();
}

export function clearArrow(): void {
  arrowGraphics?.clear();
}


export function spawnSelectionRadius(
  selectionTilemap: CompositeTilemap,
  tilesetTextures: Map<number, PIXI.Texture>,
  centerX: number,
  centerY: number,
  radius: number,
  selectionGid: number,
  mapData: TiledMap
): void {
  selectionTilemap.clear();
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const tileX = centerX + dx;
      const tileY = centerY + dy;

      const groundGid = getChunkedTileGid(tileX, tileY, mapData, 'Ground');
      console.log(`Tile (${tileX}, ${tileY}) -> groundGid: ${groundGid}`);
      if (!groundGid) continue;

      
      const texture = tilesetTextures.get(selectionGid);
    console.log(`Selection texture size: ${texture?.width} x ${texture?.height}`);
    console.log(`Map tile size: ${mapData.tilewidth} x ${mapData.tileheight}`);
      if (!texture) continue;

    
      const screenPos = tileToScreen(tileX, tileY, mapData);
      const xOffset = -(texture.width / 2);
      const yOffset = -(texture.height / 2);
      selectionTilemap.tile(texture, screenPos.x + xOffset, screenPos.y + yOffset);
    }
  }
}

export function clearSelection(selectionTilemap: CompositeTilemap): void {
  selectionTilemap.clear();
}

export function swapNearbyTrees(objectsTilemap: CompositeTilemap, tilesetTextures: Map<number, PIXI.Texture>, centerX: number, centerY: number, radius: number, mapData: TiledMap, makeTransparent: boolean): void {
  objectsTilemap.clear();

  const layer = mapData.layers.find(l => l.name === 'Objects');
  if (!layer?.chunks) {
    return;
  }

  for (const chunk of layer.chunks) {
    for (let localY = 0; localY < chunk.height; localY++) {
      for (let localX = 0; localX < chunk.width; localX++) {
        const index = localY * chunk.width + localX;
        let gid = chunk.data[index];
        if (!gid) continue;

        const worldX = chunk.x + localX;
        const worldY = chunk.y + localY;
        const dx = worldX - centerX;
        const dy = worldY - centerY;
        const isNearby = Math.abs(dx) + Math.abs(dy) <= radius;

        if (makeTransparent && isNearby && gid === TREE_GID) {
          gid = TRANSPARENT_TREE_GID;
        }

        const texture = tilesetTextures.get(gid);
        if (!texture) {
          continue;
        }

        const screenPos = tileToScreen(worldX, worldY, mapData);
        const xOffset = -(texture.width / 2) + (mapData.tilewidth / 2);
        const yOffset = -(texture.height) + (mapData.tileheight);
        objectsTilemap.tile(texture, screenPos.x + xOffset, screenPos.y + yOffset);
      }
    }
  }
}