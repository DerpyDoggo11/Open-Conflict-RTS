import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';

export function setTile(
  tilemap: CompositeTilemap,
  mapData: TiledMap,
  layerName: string,
  tileX: number,
  tileY: number,
  newGid: number,
  tilesetTextures: Map<number, PIXI.Texture>
): void {
  // Find the layer
  const layer = mapData.layers.find(l => l.name === layerName);
  if (!layer) {
    console.error(`Layer "${layerName}" not found`);
    return;
  }

  // Get the texture for the new tile
  const texture = tilesetTextures.get(newGid);
  if (!texture) {
    console.error(`Texture for gid ${newGid} not found`);
    return;
  }

  // Convert tile position to screen position
  const screenPos = tileToScreen(tileX, tileY, mapData);

  // Add the new tile to the tilemap
  tilemap.tile(texture, screenPos.x, screenPos.y);
}

// Calculate GID from row and column position in tileset
export function getTileGidFromPosition(
  firstGid: number,
  column: number,  // 0-indexed, so "3 to the right" = column 3
  row: number,     // 0-indexed, so "6 down" = row 6
  tilesPerRow: number
): number {
  const tileIndex = row * tilesPerRow + column;
  return firstGid + tileIndex;
}

// Add this function to convert tile coordinates to screen position
export function tileToScreen(
  tileX: number, 
  tileY: number, 
  mapData: TiledMap
): { x: number, y: number } {
  let isoX: number;
  let isoY: number;
  
  if (mapData.staggeraxis === 'x') {
    // X-axis stagger
    const staggerOffset = (tileY % 2 === 0) ? 0 : mapData.tilewidth / 2;
    isoX = tileX * mapData.tilewidth + staggerOffset;
    isoY = tileY * (mapData.tileheight / 2);
  } else if (mapData.staggeraxis === 'y') {
    // Y-axis stagger
    const staggerOffset = (tileY % 2 === 0) ? 0 : mapData.tilewidth / 2;
    isoX = tileX * mapData.tilewidth + staggerOffset;
    isoY = tileY * (mapData.tileheight / 2);
  } else {
    // Regular isometric
    isoX = (tileX - tileY) * (mapData.tilewidth / 2);
    isoY = (tileX + tileY) * (mapData.tileheight / 2);
  }
  
  return { x: isoX, y: isoY };
}