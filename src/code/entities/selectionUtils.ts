import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';
import { getChunkedTileGid, isTileInWalkableBounds, tileToScreen } from '../tilemap/tilemapUtils';

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
  selectionGid: number,
  mapData: TiledMap,
  onHover: (tileX: number, tileY: number) => void,
  onHoverOut: () => void,
  onClick: (tileX: number, tileY: number) => void,
): void {
  clearSelection();
  if (!selectionContainer) return;

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const tileX = centerX + dx;
      const tileY = centerY + dy;
      if (!isTileInWalkableBounds(tileX, tileY, mapData)) continue;
      if (tileX === centerX && tileY === centerY) continue;

      const texture = tilesetTextures.get(selectionGid);
      if (!texture) continue;

      const screenPos = tileToScreen(tileX, tileY, mapData);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(screenPos.x, screenPos.y);
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';

      sprite.on('pointerenter', () => onHover(tileX, tileY));
      sprite.on('pointerleave', () => onHoverOut());
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

export function closeSelection(objectsTilemap: CompositeTilemap, tilesetTextures: Map<number, PIXI.Texture<PIXI.TextureSource<any>>>, charTileX: number, charTileY: number, TREE_SWAP_RADIUS: number, mapData: TiledMap) {
  clearSelection();
  clearArrow();
  swapNearbyTrees(objectsTilemap, tilesetTextures, charTileX, charTileY, TREE_SWAP_RADIUS, mapData, false);
  swapNearbyTrees(objectsTilemap, tilesetTextures, charTileX, charTileY, 3, mapData, true);
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