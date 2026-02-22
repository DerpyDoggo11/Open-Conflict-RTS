import * as PIXI from 'pixi.js';
import { loadTiledMap } from './code/tilemap/tilemapLoader';
import { createOceanMesh } from './code/tilemap/oceanBackground';
import { spawnCharacter } from './code/entities/entityUtils';
import { setupCamera } from './code/entities/camera';
import {
  clearArrow, clearSelection, closeSelection, drawArrowToTile,
  initArrow, initSelection, spawnSelectionRadius, swapNearbyTrees
} from './code/entities/selectionUtils';
import { DebugOverlay } from './code/ui/debugOverlay';
import { CharacterMovement } from './code/entities/entityMovement';

async function main() {
  const app = new PIXI.Application();
  await app.init({ background: '#cfe4e7', resizeTo: window, preference: 'webgl' });
  document.body.appendChild(app.canvas);

  const viewport = new PIXI.Container();
  app.stage.addChild(viewport);

  const { tilemaps, tilesetTextures, mapData } = await loadTiledMap(
    './src/assets/tilemaps/grasslands.json'
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

  // const debugOverlay = new DebugOverlay(viewport, viewport);
  // debugOverlay.initPolygonEditor(mapData, app);

  viewport.addChild(selectionContainer);


  createOceanMesh(app, viewport, mapData);

  const character = await spawnCharacter(
    10, -1,
    mapData,
    characterContainer,
    './src/assets/troops/general/0004.png'
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
      spritePath: './src/assets/troops/general/',
    }
  );






  viewport.pivot.set(0, 0);
  viewport.position.set(app.screen.width / 2, app.screen.height / 2);
  viewport.scale.set(0.5, 0.5);

  setupCamera(app, viewport);
}

main();