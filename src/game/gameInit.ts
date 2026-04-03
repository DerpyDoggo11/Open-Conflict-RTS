import * as PIXI from 'pixi.js';
import { loadTiledMap } from './tilemap/tilemapLoader';
import { createOceanMesh } from './tilemap/oceanBackground';
import { initTroopSync, spawnCharacter } from './entities/entityUtils';
import { setupCamera } from './entities/camera';
import {
  clearArrow, clearSelection, drawArrowToTile,
  initArrow, initSelection, initTrees, spawnSelectionRadius
} from './entities/selectionUtils';
//import { DebugOverlay } from './ui/debugOverlay';
import { colyseusClient } from './network/colyseusClient';
import { Intermission } from './intermission';
import { TroopHUDController } from './ui/troopHUDController';

export async function initGame() {

  console.log('[initGame] Starting game initialization...');
  const params     = new URLSearchParams(window.location.search);
  const playerName = localStorage.getItem('playerName') ?? 'Player';
  const map        = params.get('map') ?? 'grasslands';

  const app = new PIXI.Application();
  const appContainer = document.getElementById('app') as HTMLElement;

  if (!appContainer) {
    console.error('[initGame] #app element not found');
    return;
  }
  await app.init({ background: '#cfe4e7', resizeTo: appContainer, preference: 'webgl' });
  appContainer.appendChild(app.canvas);

  const viewport = new PIXI.Container();
  app.stage.addChild(viewport);
  
  const mapPath = `./assets/tilemaps/${map}.json`;
  console.log('[initGame] loading map:', mapPath);

  const { tilemaps, tilesetTextures, mapData } = await loadTiledMap(
    './assets/tilemaps/grasslands.json'
  );

  const groundTilemap = tilemaps.get('Ground')!;
  const objectsContainer = new PIXI.Container();
  initTrees(objectsContainer, tilesetTextures, mapData);
  objectsContainer.sortableChildren = true;
  objectsContainer.label = 'Objects';
  // const objectsTilemap = tilemaps.get('Objects')!;
  // groundTilemap.label = 'Ground';
  // objectsTilemap.label = 'Objects';

  const characterContainer = new PIXI.Container();
  const hudContainer = new PIXI.Container();
  const selectionContainer = new PIXI.Container();

  viewport.addChild(groundTilemap);
  viewport.addChild(objectsContainer);
  initSelection(selectionContainer);
  initArrow(viewport);
  viewport.addChild(characterContainer);
  viewport.addChild(selectionContainer);
  viewport.addChild(hudContainer);

  createOceanMesh(app, viewport, mapData);

  try {
    await colyseusClient.joinGame(playerName);
    console.log('[initGame] joined game as', playerName);
  } catch (e) {
    console.error('[initGame] failed to join game room:', e);
    return;
  }

  initTroopSync(mapData, characterContainer, hudContainer, app, viewport, objectsContainer, tilesetTextures);

  const spawnZone = { x: 5, y: 5, w: 4, h: 4 };
  new Intermission(
      app,
      viewport,
      mapData,
      tilesetTextures,
      characterContainer,
      hudContainer,
      objectsContainer,
      spawnZone,
      () => {
        console.log('Game started!');
      }
  );


  viewport.pivot.set(0, 0);
  viewport.position.set(app.screen.width / 2, app.screen.height / 2);
  viewport.scale.set(0.5, 0.5);
  setupCamera(app, viewport);
}

initGame().catch(console.error);