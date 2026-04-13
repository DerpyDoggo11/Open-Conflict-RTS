import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';

export function setTile(
  tilemap: CompositeTilemap,
  mapData: TiledMap,
  tileX: number,
  tileY: number,
  newGid: number,
  tilesetTextures: Map<number, PIXI.Texture>
): void {
  const texture = tilesetTextures.get(newGid);
  if (!texture) return;
  const screenPos = tileToScreen(tileX, tileY, mapData);
  tilemap.tile(texture, screenPos.x, screenPos.y);
}

export function getTileGidFromPosition(
  firstGid: number,
  column: number,
  row: number,
  tilesPerRow: number
): number {
  const tileIndex = row * tilesPerRow + column;
  return firstGid + tileIndex;
}

export function tileToScreen(
  tileX: number,
  tileY: number,
  mapData: TiledMap
): { x: number; y: number } {
  const isoX = (tileX - tileY) * (mapData.tilewidth / 2);
  const isoY = (tileX + tileY) * (mapData.tileheight / 2);
  return { x: isoX, y: isoY };
}

export function screenToTile(
  screenX: number,
  screenY: number,
  mapData: TiledMap
) {
  const hw = mapData.tilewidth / 2;
  const hh = mapData.tileheight / 2;
  const tx = (screenX / hw + screenY / hh) / 2;
  const ty = (screenY / hh - screenX / hw) / 2;
  return {
    tileX: Math.round(tx),
    tileY: Math.round(ty),
  };
}

export function getChunkedTileGid(
  tileX: number,
  tileY: number,
  mapData: TiledMap,
  layerName: string
): number {
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

function pointInPolygon(
  px: number,
  py: number,
  polygon: { x: number; y: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
          yi = polygon[i].y;
    const xj = polygon[j].x,
          yj = polygon[j].y;
    const intersect =
          yi > py !== yj > py &&
          px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function tiledPixelToTile(
  px: number,
  py: number,
  mapData: TiledMap
): { tileX: number; tileY: number } {
  const tileX = px / mapData.tilewidth + py / mapData.tileheight;
  const tileY = py / mapData.tileheight - px / mapData.tilewidth;
  return { tileX, tileY };
}

let nonWalkableGids: Set<number> = new Set();
let blockingObjectGids: Set<number> = new Set();

export function initWalkableGids(mapData: TiledMap): void {
  nonWalkableGids = new Set();
  blockingObjectGids = new Set();

  const groundBlockKeywords = ['water'];
  //const objectBlockKeywords = ['mountain'];

  for (const tileset of mapData.tilesets) {
    if (!tileset.name) continue;
    const nameLower = tileset.name.toLowerCase();

    const tileCount = (tileset.imagewidth && tileset.tilewidth)
      ? Math.floor(tileset.imagewidth / tileset.tilewidth) *
        Math.floor(tileset.imageheight! / tileset.tileheight!)
      : 1;

    if (groundBlockKeywords.some(k => nameLower.includes(k))) {
      for (let i = 0; i < tileCount; i++) {
        nonWalkableGids.add(tileset.firstgid + i);
      }
    }

  }
  console.log('[tilemapUtils] Non-walkable ground GIDs:', [...nonWalkableGids]);
  console.log('[tilemapUtils] Blocking object GIDs:', [...blockingObjectGids]);
}

export function isTileInWalkableBounds(
  tileX: number,
  tileY: number,
  mapData: TiledMap
): boolean {
  const groundGid = getChunkedTileGid(tileX, tileY, mapData, 'Ground');
  if (groundGid === 0) return false;
  if (nonWalkableGids.has(groundGid)) return false;

  const objectGid = getChunkedTileGid(tileX, tileY, mapData, 'Objects');
  if (objectGid !== 0 && blockingObjectGids.has(objectGid)) return false;

  return true;
}