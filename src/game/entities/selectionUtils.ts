import * as PIXI from 'pixi.js';
import { type TiledMap } from '../types/tilemapTypes';
import { isTileInWalkableBounds, tileToScreen, screenToTile } from '../tilemap/tilemapUtils';
import { CharacterMovement } from './entityMovement';
import { resolveMapGids, type MapGids } from '../tilemap/tilesetLookup';

let mapGids: MapGids | null = null;

export function initMapGids(mapData: TiledMap): void {
  mapGids = resolveMapGids(mapData);
}

export function getMapGids(): MapGids {
  if (!mapGids) throw new Error('initMapGids must be called before using GIDs');
  return mapGids;
}

/* ── Arrow ── */

let arrowGraphics: PIXI.Graphics | null = null;

export function initArrow(viewport: PIXI.Container): void {
  arrowGraphics = new PIXI.Graphics();
  viewport.addChild(arrowGraphics);
}

export function drawArrowToTile(
  fromTileX: number, fromTileY: number,
  toTileX: number, toTileY: number,
  mapData: TiledMap
): void {
  if (!arrowGraphics) return;
  arrowGraphics.clear();

  const from = tileToScreen(fromTileX, fromTileY, mapData);
  const to = tileToScreen(toTileX, toTileY, mapData);
  const cy = (-mapData.tileheight / 2) + 16;
  const x1 = from.x, y1 = from.y + cy;
  const x2 = to.x, y2 = to.y + cy;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 16;

  const lineEndX = x2 - headLen * Math.cos(angle);
  const lineEndY = y2 - headLen * Math.sin(angle);

  arrowGraphics.moveTo(x1, y1).lineTo(lineEndX, lineEndY)
    .stroke({ width: 8, color: 0xffffff, alpha: 0.9 });
  arrowGraphics.moveTo(x2, y2)
    .lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6))
    .lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6))
    .closePath().fill({ color: 0xffffff, alpha: 1 });
}

export function clearArrow(): void { arrowGraphics?.clear(); }

/* ── Grid overlay ── */

let gridGraphics: PIXI.Graphics | null = null;

export function initGrid(viewport: PIXI.Container, mapData: TiledMap): void {
  if (gridGraphics) gridGraphics.destroy();
  gridGraphics = new PIXI.Graphics();
  gridGraphics.zIndex = -1;
  viewport.addChild(gridGraphics);

  const hw = mapData.tilewidth / 2;
  const hh = mapData.tileheight / 2;
  const groundLayer = mapData.layers.find(l => l.name === 'Ground');
  if (!groundLayer?.chunks) return;

  const tileSet = new Set<string>();
  for (const chunk of groundLayer.chunks) {
    for (let i = 0; i < chunk.data.length; i++) {
      if (chunk.data[i] === 0) continue;
      const lx = i % chunk.width;
      const ly = Math.floor(i / chunk.width);
      tileSet.add(`${chunk.x + lx},${chunk.y + ly}`);
    }
  }

  for (const key of tileSet) {
    const [tx, ty] = key.split(',').map(Number);
    const cx = (tx - ty) * hw;
    const cy = (tx + ty) * hh;
    gridGraphics!.moveTo(cx, cy - hh).lineTo(cx + hw, cy)
      .lineTo(cx, cy + hh).lineTo(cx - hw, cy).closePath()
      .stroke({ width: 1, color: 0xffffff, alpha: 0.08 });
  }
}

/* ── Tile-based click system ── */

interface TileZone {
  tiles: Map<string, { tileX: number; tileY: number }>;
  onClick: (tileX: number, tileY: number) => void;
  onHover?: (tileX: number, tileY: number) => void;
  onHoverOut?: () => void;
  sprites: Map<string, PIXI.Sprite>;
  baseAlpha: number;
  hoverAlpha: number;
}

let activeSelectionZone: TileZone | null = null;
let activeSpawnZone: TileZone | null = null;
let selectionContainer: PIXI.Container | null = null;
let spawnZoneContainer: PIXI.Container | null = null;
let hoveredTileKey: string | null = null;

let viewportRef: PIXI.Container | null = null;
let mapDataRef: TiledMap | null = null;
let appRef: PIXI.Application | null = null;
let inputBound = false;

export function initSelection(container: PIXI.Container): void {
  selectionContainer = container;
}

export function initSpawnZone(container: PIXI.Container): void {
  spawnZoneContainer = container;
}

export function initTileInput(app: PIXI.Application, viewport: PIXI.Container, mapData: TiledMap): void {
  if (inputBound) return;
  inputBound = true;
  viewportRef = viewport;
  mapDataRef = mapData;
  appRef = app;

  viewport.eventMode = 'static';
  viewport.on('pointertap', onViewportTap);
  viewport.on('pointermove', onViewportMove);
}

function tileKey(tx: number, ty: number): string { return `${tx},${ty}`; }

function onViewportTap(e: PIXI.FederatedPointerEvent): void {
  if (!viewportRef || !mapDataRef) return;
  const worldPos = viewportRef.toLocal(e.global);
  const { tileX, tileY } = screenToTile(worldPos.x, worldPos.y, mapDataRef);
  const key = tileKey(tileX, tileY);

  // Selection zone has priority (move/attack tiles)
  if (activeSelectionZone?.tiles.has(key)) {
    e.stopPropagation();
    activeSelectionZone.onClick(tileX, tileY);
    return;
  }

  // Spawn zone
  if (activeSpawnZone?.tiles.has(key)) {
    e.stopPropagation();
    activeSpawnZone.onClick(tileX, tileY);
    return;
  }
}

function onViewportMove(e: PIXI.FederatedPointerEvent): void {
  if (!viewportRef || !mapDataRef || !appRef) return;
  const worldPos = viewportRef.toLocal(e.global);
  const { tileX, tileY } = screenToTile(worldPos.x, worldPos.y, mapDataRef);
  const key = tileKey(tileX, tileY);

  // Check if hovering any interactive tile
  const zone = activeSelectionZone?.tiles.has(key) ? activeSelectionZone
    : activeSpawnZone?.tiles.has(key) ? activeSpawnZone : null;

  if (hoveredTileKey !== key) {
    // Un-hover previous
    if (hoveredTileKey) {
      const prevZone = activeSelectionZone?.sprites.has(hoveredTileKey) ? activeSelectionZone
        : activeSpawnZone?.sprites.has(hoveredTileKey) ? activeSpawnZone : null;
      if (prevZone) {
        const prevSprite = prevZone.sprites.get(hoveredTileKey);
        if (prevSprite) prevSprite.alpha = prevZone.baseAlpha;
        prevZone.onHoverOut?.();
      }
    }

    hoveredTileKey = key;

    if (zone) {
      const sprite = zone.sprites.get(key);
      if (sprite) sprite.alpha = zone.hoverAlpha;
      zone.onHover?.(tileX, tileY);
      appRef.canvas.style.cursor = 'pointer';
    } else {
      appRef.canvas.style.cursor = 'default';
    }
  }
}

/* ── Selection radius ── */

export function spawnSelectionRadius(
  tilesetTextures: Map<number, PIXI.Texture>,
  centerX: number, centerY: number,
  radius: number,
  tileGid: number,
  mapData: TiledMap,
  movingCharacter: CharacterMovement,
  onHover: (tileX: number, tileY: number) => void,
  onHoverOut: () => void,
  onClick: (tileX: number, tileY: number) => void,
  isAttackMode: boolean = false,
): void {
  clearSelection();
  if (!selectionContainer) return;

  const texture = tilesetTextures.get(tileGid);
  if (!texture) return;

  const tiles = new Map<string, { tileX: number; tileY: number }>();
  const sprites = new Map<string, PIXI.Sprite>();

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const tileX = centerX + dx;
      const tileY = centerY + dy;
      if (!isAttackMode && !isTileInWalkableBounds(tileX, tileY, mapData)) continue;
      if (tileX === centerX && tileY === centerY) continue;

      if (!isAttackMode) {
        const ddx = tileX - centerX;
        const ddy = tileY - centerY;
        const isMoving = ddx !== 0 || ddy !== 0;
        const pFdx = isMoving ? (ddx === 0 ? 0 : ddx / Math.abs(ddx)) : movingCharacter.facingDx;
        const pFdy = isMoving ? (ddy === 0 ? 0 : ddy / Math.abs(ddy)) : movingCharacter.facingDy;
        if (movingCharacter.wouldCollide(tileX, tileY, pFdx, pFdy)) continue;
      }

      const key = tileKey(tileX, tileY);
      tiles.set(key, { tileX, tileY });

      const screenPos = tileToScreen(tileX, tileY, mapData);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(screenPos.x, screenPos.y);
      sprite.alpha = 0.4;
      sprite.zIndex = isAttackMode ? 99999 : -10;
      sprite.eventMode = 'none';

      selectionContainer.addChild(sprite);
      sprites.set(key, sprite);
    }
  }

  activeSelectionZone = {
    tiles, sprites, onClick, onHover, onHoverOut,
    baseAlpha: 0.4, hoverAlpha: 0.9,
  };
}

export function clearSelection(): void {
  if (activeSelectionZone) {
    for (const sprite of activeSelectionZone.sprites.values()) sprite.destroy();
    activeSelectionZone = null;
  }
  hoveredTileKey = null;
}

/* ── Spawn zone ── */

export function spawnSpawnZone(
  tilesetTextures: Map<number, PIXI.Texture>,
  spawnZone: { x: number; y: number; w: number; h: number },
  spawnGid: number,
  mapData: TiledMap,
  onClick: (tileX: number, tileY: number) => void,
): void {
  clearSpawnZone();
  if (!spawnZoneContainer) return;

  const texture = tilesetTextures.get(spawnGid);
  if (!texture) return;

  const blockedSet = new Set(
    CharacterMovement.getAllOccupiedTiles().map(t => `${t.tileX},${t.tileY}`)
  );

  const tiles = new Map<string, { tileX: number; tileY: number }>();
  const sprites = new Map<string, PIXI.Sprite>();

  for (let dx = 0; dx < spawnZone.w; dx++) {
    for (let dy = 0; dy < spawnZone.h; dy++) {
      const tileX = spawnZone.x + dx;
      const tileY = spawnZone.y + dy;
      if (!isTileInWalkableBounds(tileX, tileY, mapData)) continue;
      if (blockedSet.has(`${tileX},${tileY}`)) continue;

      const key = tileKey(tileX, tileY);
      tiles.set(key, { tileX, tileY });

      const screenPos = tileToScreen(tileX, tileY, mapData);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(screenPos.x, screenPos.y);
      sprite.alpha = 0.4;
      sprite.zIndex = -10;
      sprite.eventMode = 'none';

      spawnZoneContainer.addChild(sprite);
      sprites.set(key, sprite);
    }
  }

  activeSpawnZone = {
    tiles, sprites, onClick,
    baseAlpha: 0.4, hoverAlpha: 0.9,
  };
}

export function clearSpawnZone(): void {
  if (activeSpawnZone) {
    for (const sprite of activeSpawnZone.sprites.values()) sprite.destroy();
    activeSpawnZone = null;
  }
}

/* ── Trees ── */

const treeSprites: Map<string, PIXI.Sprite> = new Map();

export function initTrees(
  objectsContainer: PIXI.Container,
  tilesetTextures: Map<number, PIXI.Texture>,
  mapData: TiledMap
): void {
  objectsContainer.sortableChildren = true;
  const layer = mapData.layers.find(l => l.name === 'Objects');
  if (!layer?.chunks) return;

  for (const chunk of layer.chunks) {
    for (let localY = 0; localY < chunk.height; localY++) {
      for (let localX = 0; localX < chunk.width; localX++) {
        const index = localY * chunk.width + localX;
        const gid = chunk.data[index];
        if (!gid) continue;

        const worldX = chunk.x + localX;
        const worldY = chunk.y + localY;
        const texture = tilesetTextures.get(gid);
        if (!texture) continue;

        const sprite = new PIXI.Sprite(texture);
        const footTileX = worldX + 1;
        const footTileY = worldY + 1;
        const footScreen = tileToScreen(footTileX, footTileY, mapData);

        sprite.anchor.set(0.5, 1);
        sprite.position.set(footScreen.x, footScreen.y + mapData.tileheight / 2);
        sprite.zIndex = footTileX + footTileY;

        objectsContainer.addChild(sprite);
        treeSprites.set(`${worldX},${worldY}`, sprite);
      }
    }
  }
}

export function updateTreeTransparency(
  transparentZones: { x: number; y: number; radius: number }[]
): void {
  for (const [key, sprite] of treeSprites) {
    const [wx, wy] = key.split(',').map(Number);

    let shouldBeTransparent = false;
    for (const zone of transparentZones) {
      if (Math.abs(wx - zone.x) + Math.abs(wy - zone.y) <= zone.radius) {
        shouldBeTransparent = true;
        break;
      }
    }

    sprite.alpha = shouldBeTransparent ? 0.35 : 1;
  }
}