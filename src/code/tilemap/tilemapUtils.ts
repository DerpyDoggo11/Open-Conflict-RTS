import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';

export function setTile( tilemap: CompositeTilemap, mapData: TiledMap, tileX: number, tileY: number, newGid: number, tilesetTextures: Map<number, PIXI.Texture>): void {
  const texture = tilesetTextures.get(newGid);
  if (!texture) return;

  const screenPos = tileToScreen(tileX, tileY, mapData);
  tilemap.tile(texture, screenPos.x, screenPos.y);
}

export function getTileGidFromPosition(firstGid: number, column: number, row: number, tilesPerRow: number): number {
  const tileIndex = row * tilesPerRow + column;
  return firstGid + tileIndex;
}

export function tileToScreen(tileX: number, tileY: number, mapData: TiledMap): { x: number, y: number } {
  const isoX = (tileX - tileY) * (mapData.tilewidth / 2);
  const isoY = (tileX + tileY) * (mapData.tileheight / 2);
  return { x: isoX, y: isoY };
}

export function screenToTile(screenX: number, screenY: number, mapData: TiledMap) {
  const hw = mapData.tilewidth / 2;
  const hh = mapData.tileheight / 2;
  const tx = (screenX / hw + screenY / hh) / 2;
  const ty = (screenY / hh - screenX / hw) / 2;
  return {
    tileX: Math.round(tx),
    tileY: Math.round(ty)
  };
}

export function getChunkedTileGid(tileX: number, tileY: number, mapData: TiledMap, layerName: string): number {
  const layer = mapData.layers.find(l => l.name === layerName);
  if (!layer?.chunks) return 0;

  for (const chunk of layer.chunks) {
    const localX = tileX - chunk.x;
    const localY = tileY - chunk.y;
    if (localX < 0 || localY < 0 || localX >= chunk.width || localY >= chunk.height) continue;
    const index = localY * chunk.width + localX;
    return chunk.data[index] ?? 0;
  }
  return 0;
}