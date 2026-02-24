import * as PIXI from 'pixi.js';
import { loadTiledMap } from './code/tilemap/tilemapLoader';
import { createOceanMesh } from './code/tilemap/oceanBackground';
import { spawnCharacter } from './code/entities/entityUtils';
import { setupCamera } from './code/entities/camera';
import { initArrow, initSelection } from './code/entities/selectionUtils';
import { DebugOverlay } from './code/ui/debugOverlay';
import { CharacterMovement } from './code/entities/entityMovement';
import { gameMenu, menu, UIHandler } from './code/ui';


async function main() {
  const app = new PIXI.Application();
  await app.init({ background: '#cfe4e7', resizeTo: window, preference: 'webgl' });

  app.canvas.style.position = 'fixed';
  app.canvas.style.top = '0';
  app.canvas.style.left = '0';

  document.body.appendChild(app.canvas);

  const ui = new UIHandler();
  const inGameMenu = new gameMenu(ui);

  ui
    .register('main-menu', new menu(ui))
    .register('in-game', inGameMenu);

  ui.show('main-menu');

  window.addEventListener('game:pause', (e) => {
    const { paused } = (e as CustomEvent<{ paused: boolean }>).detail;
    paused ? app.ticker.stop() : app.ticker.start();
  });
  

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
  const selectionContainer = new PIXI.Container();

  viewport.addChild(groundTilemap);
  viewport.addChild(objectsTilemap);
  initSelection(selectionContainer);
  initArrow(viewport);
  viewport.addChild(characterContainer);
  viewport.addChild(selectionContainer);
  createOceanMesh(app, viewport, mapData);

  const character = await spawnCharacter(
    10, -1,
    mapData,
    characterContainer,
    './assets/troops/general/0004.png'
  );
  character.scale.set(0.5, 0.5);

  const characterMovement = new CharacterMovement(
    character, 10, -1,
    app, viewport,
    objectsTilemap, tilesetTextures, mapData,
    {
      selectionGid: 6,
      selectionRadius: 2,
      treeSwapRadius: 5,
      spritePath: './assets/troops/general/',
    }
  );

  const grunt = await spawnCharacter(
    9, -1,
    mapData,
    characterContainer,
    './assets/troops/grunt/0004.png'
  );
  grunt.scale.set(0.5, 0.5);

  const gruntMovement = new CharacterMovement(
    grunt, 9, -1,
    app, viewport,
    objectsTilemap, tilesetTextures, mapData,
    {
      selectionGid: 6,
      selectionRadius: 2,
      treeSwapRadius: 5,
      spritePath: './assets/troops/grunt/',
    }
  );

  const machineGunner = await spawnCharacter(
    8, -1,
    mapData,
    characterContainer,
    './assets/troops/machineGunner/0004.png'
  );
  machineGunner.scale.set(0.5, 0.5);

  const machineGunnerMovement = new CharacterMovement(
    machineGunner, 8, -1,
    app, viewport,
    objectsTilemap, tilesetTextures, mapData,
    {
      selectionGid: 6,
      selectionRadius: 2,
      treeSwapRadius: 5,
      spritePath: './assets/troops/machineGunner/',
    }
  );

  const tankDestroyer = await spawnCharacter(
    7, -1,
    mapData,
    characterContainer,
    './assets/troops/tankDestroyer/0004.png'
  );

  const tankDestroyerMovement = new CharacterMovement(
    tankDestroyer, 7, -1,
    app, viewport,
    objectsTilemap, tilesetTextures, mapData,
    {
      selectionGid: 6,
      selectionRadius: 5,
      treeSwapRadius: 5,
      spritePath: './assets/troops/tankDestroyer/',
    }
  );


  viewport.pivot.set(0, 0);
  viewport.position.set(app.screen.width / 2, app.screen.height / 2);
  viewport.scale.set(0.5, 0.5);

  setupCamera(app, viewport);
  let metal = 0, supply = 0;
  setInterval(() => {
    metal += Math.floor(Math.random() * 10);
    supply += Math.floor(Math.random() * 5);
    inGameMenu.updateResources(metal, supply);
  }, 1000);
}

main();