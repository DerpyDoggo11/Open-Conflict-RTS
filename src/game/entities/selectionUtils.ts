import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';
import { isTileInWalkableBounds, tileToScreen } from '../tilemap/tilemapUtils';
import { CharacterMovement } from './entityMovement';
import { resolveMapGids, type MapGids } from '../tilemap/tilesetLookup';

let mapGids: MapGids | null = null;

export function initMapGids(mapData: TiledMap): void {
  mapGids = resolveMapGids(mapData);
  console.log('[selectionUtils] Resolved GIDs:', mapGids);
}

export function getMapGids(): MapGids {
  if (!mapGids) throw new Error('initMapGids must be called before using GIDs');
  return mapGids;
}

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

  const cy = -mapData.tileheight / 2;

  const x1 = from.x;
  const y1 = from.y + cy;
  const x2 = to.x;
  const y2 = to.y + cy;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);
  const headLen = 60;
  const lineWidth = 20;

  const lineEndX = x2 - headLen * Math.cos(angle);
  const lineEndY = y2 - headLen * Math.sin(angle);

  arrowGraphics
    .moveTo(x1, y1)
    .lineTo(lineEndX, lineEndY)
    .stroke({ width: lineWidth, color: 0xffffff, alpha: 0.9 });

  arrowGraphics
    .moveTo(x2, y2)
    .lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6)
    )
    .lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6)
    )
    .closePath()
    .fill({ color: 0xffffff, alpha: 1 });
}

export function clearArrow(): void {
  arrowGraphics?.clear();
}

/* ── Grid overlay ── */

let gridGraphics: PIXI.Graphics | null = null;

export function initGrid(viewport: PIXI.Container, mapData: TiledMap): void {
  if (gridGraphics) {
    gridGraphics.destroy();
  }
  gridGraphics = new PIXI.Graphics();
  gridGraphics.zIndex = -1;
  viewport.addChild(gridGraphics);
  drawGrid(mapData);
}

function drawGrid(mapData: TiledMap): void {
  if (!gridGraphics) return;
  gridGraphics.clear();

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
    const [txStr, tyStr] = key.split(',');
    const tx = parseInt(txStr, 10);
    const ty = parseInt(tyStr, 10);

    const cx = (tx - ty) * hw;
    const cy = (tx + ty) * hh;

    gridGraphics
      .moveTo(cx, cy - hh)
      .lineTo(cx + hw, cy)
      .lineTo(cx, cy + hh)
      .lineTo(cx - hw, cy)
      .closePath()
      .stroke({ width: 1, color: 0xffffff, alpha: 0.08 });
  }
}

/* ── Selection radius ── */

const selectionSprites: PIXI.Sprite[] = [];
let selectionContainer: PIXI.Container | null = null;

export function initSelection(container: PIXI.Container): void {
  selectionContainer = container;
}

export function spawnSelectionRadius(
  tilesetTextures: Map<number, PIXI.Texture>,
  centerX: number,
  centerY: number,
  radius: number,
  tileGid: number,
  tileGidTransparent: number,
  mapData: TiledMap,
  movingCharacter: CharacterMovement,
  onHover: (tileX: number, tileY: number) => void,
  onHoverOut: () => void,
  onClick: (tileX: number, tileY: number) => void,
  isAttackMode: boolean = false,
): void {
  clearSelection();
  if (!selectionContainer) return;

  const opaqueTexture = tilesetTextures.get(tileGid);
  const transparentTexture = tilesetTextures.get(tileGidTransparent) ?? opaqueTexture;
  if (!transparentTexture) return;

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const tileX = centerX + dx;
      const tileY = centerY + dy;
      if (!isAttackMode && !isTileInWalkableBounds(tileX, tileY, mapData)) continue;
      if (tileX === centerX && tileY === centerY) continue;

      if (isAttackMode) {
        // show all tiles in attack range
      } else {
        const ddx = tileX - centerX;
        const ddy = tileY - centerY;
        const isMoving = ddx !== 0 || ddy !== 0;
        const prospectiveFdx = isMoving ? (ddx === 0 ? 0 : ddx / Math.abs(ddx)) : movingCharacter.facingDx;
        const prospectiveFdy = isMoving ? (ddy === 0 ? 0 : ddy / Math.abs(ddy)) : movingCharacter.facingDy;

        if (movingCharacter.wouldCollide(tileX, tileY, prospectiveFdx, prospectiveFdy)) continue;
      }

      const screenPos = tileToScreen(tileX, tileY, mapData);
      const sprite = new PIXI.Sprite(transparentTexture);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(screenPos.x, screenPos.y);
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';

      if (isAttackMode) {
        sprite.zIndex = 99999;
      }

      sprite.on('pointerenter', () => {
        if (opaqueTexture) sprite.texture = opaqueTexture;
        onHover(tileX, tileY);
      });
      sprite.on('pointerleave', () => {
        sprite.texture = transparentTexture;
        onHoverOut();
      });
      sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
      });
      sprite.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        onClick(tileX, tileY);
      });

      selectionContainer.addChild(sprite);
      selectionSprites.push(sprite);
    }
  }
}

export function clearSelection(): void {
  for (const sprite of selectionSprites) {
    sprite.destroy();
  }
  selectionSprites.length = 0;
}

/* ── Spawn zone ── */

const spawnZoneSprites: PIXI.Sprite[] = [];
let spawnZoneContainer: PIXI.Container | null = null;

export function initSpawnZone(container: PIXI.Container): void {
  spawnZoneContainer = container;
}

export function spawnSpawnZone(
  tilesetTextures: Map<number, PIXI.Texture>,
  spawnZone: { x: number; y: number; w: number; h: number },
  spawnGid: number,
  spawnGidTransparent: number,
  mapData: TiledMap,
  onClick: (tileX: number, tileY: number) => void,
): void {
  clearSpawnZone();
  if (!spawnZoneContainer) return;

  const opaqueTexture = tilesetTextures.get(spawnGid);
  const transparentTexture = tilesetTextures.get(spawnGidTransparent) ?? opaqueTexture;
  if (!transparentTexture) return;

  const blockedSet = new Set(
    CharacterMovement.getAllOccupiedTiles().map(t => `${t.tileX},${t.tileY}`)
  );

  for (let dx = 0; dx < spawnZone.w; dx++) {
    for (let dy = 0; dy < spawnZone.h; dy++) {
      const tileX = spawnZone.x + dx;
      const tileY = spawnZone.y + dy;

      if (!isTileInWalkableBounds(tileX, tileY, mapData)) continue;
      if (blockedSet.has(`${tileX},${tileY}`)) continue;

      const screenPos = tileToScreen(tileX, tileY, mapData);
      const sprite = new PIXI.Sprite(transparentTexture);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(screenPos.x, screenPos.y);
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';

      sprite.on('pointerenter', () => {
        if (opaqueTexture) sprite.texture = opaqueTexture;
      });
      sprite.on('pointerleave', () => {
        sprite.texture = transparentTexture;
      });
      sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
      });
      sprite.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        onClick(tileX, tileY);
      });

      spawnZoneContainer.addChild(sprite);
      spawnZoneSprites.push(sprite);
    }
  }
}

export function clearSpawnZone(): void {
  for (const sprite of spawnZoneSprites) {
    sprite.destroy();
  }
  spawnZoneSprites.length = 0;
}

/* ── Trees ── */

const treeSprites: Map<string, { sprite: PIXI.Sprite; originalGid: number }> = new Map();
let objectsContainerRef: PIXI.Container | null = null;
let tilesetTexturesRef: Map<number, PIXI.Texture> | null = null;
let mapDataRef: TiledMap | null = null;

export function initTrees(
  objectsContainer: PIXI.Container,
  tilesetTextures: Map<number, PIXI.Texture>,
  mapData: TiledMap
): void {
  objectsContainer.sortableChildren = true;
  objectsContainerRef = objectsContainer;
  tilesetTexturesRef = tilesetTextures;
  mapDataRef = mapData;

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
        const key = `${worldX},${worldY}`;
        treeSprites.set(key, { sprite, originalGid: gid });
      }
    }
  }
}

export function updateTreeTransparency(
  transparentZones: { x: number; y: number; radius: number }[]
): void {
  if (!tilesetTexturesRef || !mapDataRef || !mapGids) return;

  const normalTex = tilesetTexturesRef.get(mapGids.tree);
  const transparentTex = tilesetTexturesRef.get(mapGids.transparentTree);
  if (!normalTex || !transparentTex) return;

  for (const [key, entry] of treeSprites) {
    if (entry.originalGid !== mapGids.tree) continue;

    const [wxStr, wyStr] = key.split(',');
    const worldX = parseInt(wxStr, 10);
    const worldY = parseInt(wyStr, 10);

    let shouldBeTransparent = false;
    for (const zone of transparentZones) {
      const dist = Math.abs(worldX - zone.x) + Math.abs(worldY - zone.y);
      if (dist <= zone.radius) {
        shouldBeTransparent = true;
        break;
      }
    }

    entry.sprite.texture = shouldBeTransparent ? transparentTex : normalTex;
  }
}