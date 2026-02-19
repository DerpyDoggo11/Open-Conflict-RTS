import * as PIXI from 'pixi.js';
import { loadTiledMap } from './code/tilemap/tilemapLoader';
import { createOceanMesh } from './code/tilemap/oceanBackground';
import { spawnCharacter } from './code/entities/entityUtils';
import { setupCamera } from './code/entities/camera';
import { CompositeTilemap } from '@pixi/tilemap';
import { clearSelection, spawnSelectionRadius, swapNearbyTrees } from './code/entities/selectionUtils';
import { screenToTile } from './code/tilemap/tilemapUtils';


async function main() {
  const app = new PIXI.Application();
  await app.init({ background: '#222', resizeTo: window, preference: 'webgl' });
  document.body.appendChild(app.canvas);
  
  const viewport = new PIXI.Container();
  app.stage.addChild(viewport);

  
  // Load the tilemap and keep reference to mapData
  const { tilemaps, tilesetTextures, mapData } = await loadTiledMap(
    './src/assets/tilemaps/grasslands.json'
  );
  const groundTilemap = tilemaps.get('Ground')!;
  const objectsTilemap = tilemaps.get('Objects')!;
  groundTilemap.label = 'Ground';
  objectsTilemap.label = 'Objects';
  
  const selectionTilemap = new CompositeTilemap();
  selectionTilemap.label = 'Selection';

  const characterContainer = new PIXI.Container();

  viewport.addChild(groundTilemap);
  viewport.addChild(characterContainer);
  viewport.addChild(selectionTilemap);
  viewport.addChild(objectsTilemap);

  createOceanMesh(app, viewport, mapData);


  const character = await spawnCharacter(
    9, -1, 
    mapData, 
    characterContainer, 
    './src/assets/troops/general/0003.png'
  );
  character.scale.set(0.5,0.5);
  
  let isSelected = false;
  let charTileX = 9;
  let charTileY = -1;
  const SELECTION_GID = 5;
  const SELECTION_RADIUS = 4;

  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  const TREE_SWAP_RADIUS = 4;

  app.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
    const worldPos = viewport.toLocal(e.global);
    const { tileX, tileY } = screenToTile(worldPos.x, worldPos.y, mapData);

    const isClickOnCharTile = tileX === charTileX && tileY === charTileY;

    if (isClickOnCharTile) {
      if (isSelected) {
        clearSelection(selectionTilemap);
        swapNearbyTrees(objectsTilemap, tilesetTextures, charTileX, charTileY, TREE_SWAP_RADIUS, mapData, false);
        isSelected = false;
      } else {
        spawnSelectionRadius(selectionTilemap, tilesetTextures, charTileX, charTileY, SELECTION_RADIUS, SELECTION_GID, mapData);
        swapNearbyTrees(objectsTilemap, tilesetTextures, charTileX, charTileY, TREE_SWAP_RADIUS, mapData, true);
        isSelected = true;
      }
    } else if (isSelected) {
      clearSelection(selectionTilemap);
      swapNearbyTrees(objectsTilemap, tilesetTextures, charTileX, charTileY, TREE_SWAP_RADIUS, mapData, false);
      isSelected = false;
    }
  });


  viewport.position.set(app.screen.width / 2, app.screen.height / 2);
  viewport.scale.set(0.5, 0.5);
  
  setupCamera(app, viewport);
}

main();