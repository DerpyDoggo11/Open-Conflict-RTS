import * as PIXI from 'pixi.js';
import { loadTiledMap } from './tilemap/tilemapLoader';
import { createOceanMesh } from './tilemap/oceanBackground';
import { spawnCharacter } from './entities/entityUtils';
import { setupCamera } from './entities/camera';
import {
  clearArrow, clearSelection, closeSelection, drawArrowToTile,
  initArrow, initSelection, spawnSelectionRadius, swapNearbyTrees
} from './entities/selectionUtils';
import { DebugOverlay } from './ui/debugOverlay';
import { CharacterMovement } from './entities/entityMovement';
import { CharacterHUD } from './ui/characterHUD';

export async function initGame() {
  const app = new PIXI.Application();
  const appContainer = document.getElementById('app') as HTMLElement;
  await app.init({background: '#cfe4e7', resizeTo: appContainer, preference: 'webgl'});
  appContainer.appendChild(app.canvas);

  const viewport = new PIXI.Container();
  app.stage.addChild(viewport);

  const { tilemaps, tilesetTextures, mapData } = await loadTiledMap(
    './assets/tilemaps/grasslands.json'
  );

  const groundTilemap = tilemaps.get('Ground')!;
  const objectsTilemap = tilemaps.get('Objects')!;
  groundTilemap.label = 'Ground';
  objectsTilemap.label = 'Objects';

  const characterContainer = new PIXI.Container();
  const hudContainer = new PIXI.Container();
  const selectionContainer = new PIXI.Container();

  viewport.addChild(groundTilemap);
  viewport.addChild(objectsTilemap);
  initSelection(selectionContainer);
  initArrow(viewport);
  viewport.addChild(characterContainer);
  viewport.addChild(selectionContainer);
  viewport.addChild(hudContainer);
  createOceanMesh(app, viewport, mapData);

  const spawnArgs = [mapData, characterContainer, hudContainer, app, viewport, objectsTilemap, tilesetTextures] as const;

  await spawnCharacter(10, -1, ...spawnArgs, {
    scale: 0.5, selectionRadius: 2, treeSwapRadius: 5,
    spritePath: './assets/troops/general/',
  });
  await spawnCharacter(9, -1, ...spawnArgs, {
    scale: 0.5, selectionRadius: 2, treeSwapRadius: 5,
    spritePath: './assets/troops/grunt/',
  });
  await spawnCharacter(8, -1, ...spawnArgs, {
    scale: 0.5, selectionRadius: 2, treeSwapRadius: 5,
    spritePath: './assets/troops/machineGunner/',
  });
  await spawnCharacter(7, -1, ...spawnArgs, {
    scale: 1, selectionRadius: 5, treeSwapRadius: 5,
    spritePath: './assets/troops/tankDestroyer/',
  });


  viewport.pivot.set(0, 0);
  viewport.position.set(app.screen.width / 2, app.screen.height / 2);
  viewport.scale.set(0.5, 0.5);

  setupCamera(app, viewport);
}

