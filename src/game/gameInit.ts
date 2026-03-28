import * as PIXI from 'pixi.js';
import { loadTiledMap } from './tilemap/tilemapLoader';
import { createOceanMesh } from './tilemap/oceanBackground';
import { initTroopSync, spawnCharacter } from './entities/entityUtils';
import { setupCamera } from './entities/camera';
import {
  clearArrow, clearSelection, closeSelection, drawArrowToTile,
  initArrow, initSelection, spawnSelectionRadius, swapNearbyTrees
} from './entities/selectionUtils';
//import { DebugOverlay } from './ui/debugOverlay';
import { colyseusClient } from './network/colyseusClient';
import { Intermission } from './intermission';

export async function initGame() {
  const app = new PIXI.Application();
  const appContainer = document.getElementById('app') as HTMLElement;
  await app.init({ background: '#cfe4e7', resizeTo: appContainer, preference: 'webgl' });
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

  initTroopSync(mapData, characterContainer, hudContainer, app, viewport, objectsTilemap, tilesetTextures);

  await colyseusClient.joinGame("Player");

  const spawnZone = { x: 5, y: 5, w: 4, h: 4 };
  new Intermission(
      app,
      viewport,
      mapData,
      tilesetTextures,
      characterContainer,
      hudContainer,
      objectsTilemap,
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