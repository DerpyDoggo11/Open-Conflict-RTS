import * as PIXI from 'pixi.js';
import { loadTiledMap } from './tilemap/tilemapLoader';
import { createOceanMesh } from './tilemap/oceanBackground';
import { initTroopSync, spawnCharacter } from './entities/entityUtils';
import { setupCamera } from './entities/camera';
import {
  clearArrow, clearSelection, closeSelection, drawArrowToTile,
  initArrow, initSelection, spawnSelectionRadius, swapNearbyTrees
} from './entities/selectionUtils';
import { DebugOverlay } from './ui/debugOverlay';
import { Intermission } from './intermission';
import { colyseusClient } from './network/colyseusClient';
import { gameChat } from './ui/gameChat';
import { tickGameTimer } from './ui/gameTimer';

export async function initGame() {
  const chat = new gameChat();
  chat.show();
  const toggle = document.getElementById("chat-toggle") as HTMLElement;
  const closeBtn = document.getElementById("chat-close") as HTMLElement;
  toggle.addEventListener("click", () => {
    chat.show();
    toggle.classList.add("hidden");
  });
  closeBtn.addEventListener("click", () => {
    chat.hide();
    toggle.classList.remove("hidden");
  });

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

  // Register opponent sync listeners BEFORE joining so we don't miss the initial state
  initTroopSync(mapData, characterContainer, hudContainer, app, viewport, objectsTilemap, tilesetTextures);

  // Join the server AFTER everything is set up
  await colyseusClient.joinGame("Player");

  new Intermission(
    app, viewport, mapData,
    tilesetTextures, characterContainer, hudContainer, objectsTilemap,
    { x: 7, y: -3, w: 5, h: 3 },
    () => {
      console.log('Intermission over — game started!');
    }
  );

  colyseusClient.onTick(({ timeRemaining, intermissionDuration, gameDuration }) => {
    tickGameTimer(timeRemaining, intermissionDuration, gameDuration);
  });

  viewport.pivot.set(0, 0);
  viewport.position.set(app.screen.width / 2, app.screen.height / 2);
  viewport.scale.set(0.5, 0.5);
  setupCamera(app, viewport);
}