import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';
import { getChunkedTileGid, tileToScreen } from '../tilemap/tilemapUtils';

const TREE_GID = 2;
const TRANSPARENT_TREE_GID = 4;

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
      selectionTilemap.tile(texture, screenPos.x, screenPos.y);
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

        const xOffset = -(texture.width / 2);
        const yOffset = -(texture.height);

        objectsTilemap.tile(texture, screenPos.x + xOffset, screenPos.y + yOffset);
      }
    }
  }
}