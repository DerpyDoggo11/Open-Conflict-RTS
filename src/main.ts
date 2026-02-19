import * as PIXI from 'pixi.js';
import { loadTiledMap } from './code/tilemap/tilemapLoader';
import { createOceanMesh } from './code/tilemap/oceanBackground';
import { spawnCharacter } from './code/entities/entityUtils';
import { setupCamera } from './code/entities/camera';
import { CompositeTilemap } from '@pixi/tilemap';
import { clearArrow, clearSelection, drawArrowToTile, initArrow, spawnSelectionRadius, swapNearbyTrees } from './code/entities/selectionUtils';
import { getChunkedTileGid, screenToTile, tileToScreen } from './code/tilemap/tilemapUtils';
import { DebugOverlay } from './code/ui/debugOverlay';


async function main() {
  const app = new PIXI.Application();
  await app.init({ background: '#cfe4e7', resizeTo: window, preference: 'webgl' });
  document.body.appendChild(app.canvas);
  
  const viewport = new PIXI.Container();
  app.stage.addChild(viewport);

  const debugLayer = new PIXI.Container();
  viewport.addChild(debugLayer);

  
  // Load the tilemap and keep reference to mapData
  const { tilemaps, tilesetTextures, mapData } = await loadTiledMap(
    './src/assets/tilemaps/grasslands.json'
  );
  const groundTilemap = tilemaps.get('Ground')!;
  const objectsTilemap = tilemaps.get('Objects')!;
  const selectionTilemap = tilemaps.get('Selection')!;
  groundTilemap.label = 'Ground';
  objectsTilemap.label = 'Objects';
  selectionTilemap.label = 'Selection';

  const characterContainer = new PIXI.Container();

  viewport.addChild(groundTilemap);
  viewport.addChild(characterContainer);
  viewport.addChild(selectionTilemap);
  viewport.addChild(objectsTilemap);

  initArrow(viewport);

  createOceanMesh(app, viewport, mapData);


  const character = await spawnCharacter(
    10, -1, 
    mapData, 
    characterContainer, 
    './src/assets/troops/general/0003.png'
  );
  character.scale.set(0.5,0.5);
  
  let isSelected = false;
  let charTileX = 10;
  let charTileY = -1;
  const SELECTION_GID = 5;
  const SELECTION_RADIUS = 4;
  const TREE_SWAP_RADIUS = 5;

  let hoveredTileX: number | null = null;
  let hoveredTileY: number | null = null;

  function isInSelectionRadius(tileX: number, tileY: number): boolean {
    const dx = tileX - charTileX;
    const dy = tileY - charTileY;
    const onGround = !!getChunkedTileGid(tileX, tileY, mapData, 'Ground');
    return Math.abs(dx) + Math.abs(dy) <= SELECTION_RADIUS && onGround;
  }
  
  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;


  app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
    if (!isSelected) return;
    const worldPos = viewport.toLocal(e.global);
    const { tileX, tileY } = screenToTile(worldPos.x, worldPos.y, mapData);

    const isCharTile = tileX === charTileX && tileY === charTileY;

    if (!isCharTile && isInSelectionRadius(tileX, tileY)) {
      hoveredTileX = tileX;
      hoveredTileY = tileY;
      drawArrowToTile(charTileX, charTileY, tileX, tileY, mapData);
    } else {
      hoveredTileX = null;
      hoveredTileY = null;
      clearArrow();
    }
  });
    
  app.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
    const worldPos = viewport.toLocal(e.global);
    const { tileX, tileY } = screenToTile(worldPos.x, worldPos.y, mapData);

    const isClickOnCharTile = tileX === charTileX && tileY === charTileY;

    if (isSelected && hoveredTileX !== null && hoveredTileY !== null && !isClickOnCharTile) {
      const prevTileX = charTileX;
      const prevTileY = charTileY;

      charTileX = hoveredTileX;
      charTileY = hoveredTileY;

      const screenPos = tileToScreen(charTileX, charTileY, mapData);
      character.position.set(screenPos.x, screenPos.y + mapData.tileheight / 2);

      clearSelection(selectionTilemap);
      clearArrow();
      swapNearbyTrees(objectsTilemap, tilesetTextures, prevTileX, prevTileY, TREE_SWAP_RADIUS, mapData, false);
      spawnSelectionRadius(selectionTilemap, tilesetTextures, charTileX, charTileY, SELECTION_RADIUS, SELECTION_GID, mapData);
      swapNearbyTrees(objectsTilemap, tilesetTextures, charTileX, charTileY, TREE_SWAP_RADIUS, mapData, true);
      hoveredTileX = null;
      hoveredTileY = null;

    } else if (isClickOnCharTile) {
      if (isSelected) {
        clearSelection(selectionTilemap);
        clearArrow();
        swapNearbyTrees(objectsTilemap, tilesetTextures, charTileX, charTileY, TREE_SWAP_RADIUS, mapData, false);
        isSelected = false;
      } else {
        spawnSelectionRadius(selectionTilemap, tilesetTextures, charTileX, charTileY, SELECTION_RADIUS, SELECTION_GID, mapData);
        swapNearbyTrees(objectsTilemap, tilesetTextures, charTileX, charTileY, TREE_SWAP_RADIUS, mapData, true);
        isSelected = true;
      }
    } else if (isSelected) {
      clearSelection(selectionTilemap);
      clearArrow();
      swapNearbyTrees(objectsTilemap, tilesetTextures, charTileX, charTileY, TREE_SWAP_RADIUS, mapData, false);
      isSelected = false;
    }
  });

  viewport.pivot.set(0, 0);
  viewport.position.set(app.screen.width / 2, app.screen.height / 2);
  viewport.scale.set(0.5, 0.5);
  
  setupCamera(app, viewport);
}

main();