import * as PIXI from 'pixi.js';
import { loadTiledMap } from './code/tilemap/tilemapLoader';
import { createOceanBackground } from './code/tilemap/oceanBackground';
import { spawnCharacter } from './code/entities/entityUtils';
import { setupCamera } from './code/entities/camera';


async function main() {
  const app = new PIXI.Application();
  await app.init({ background: '#222', resizeTo: window });
  document.body.appendChild(app.canvas);
  
  const viewport = new PIXI.Container();
  app.stage.addChild(viewport);

  await createOceanBackground(app, viewport);

  
  // Load the tilemap and keep reference to mapData
  const { tilemap, tilesetTextures, mapData } = await loadTiledMap(
    './src/assets/tilemaps/grasslands.json'
  );
  viewport.addChild(tilemap);
  
  // const overlayFirstGid = 1000;
  
  // // Load the overlay tileset and get dimensions
  // const overlayTexture = await PIXI.Assets.load('./src/assets/tilesets/256x128 Tile Overlays.png');
  // const tilesPerRow = Math.floor(overlayTexture.width / 256);
  
  // await loadOverlayTileset(
  //   tilesetTextures,
  //   './src/assets/tilesets/256x128 Tile Overlays.png',
  //   overlayFirstGid,
  //   256,
  //   128
  // );
  
  
  // Spawn a character at tile position (10, 10)
  const character = await spawnCharacter(
    0, 0, 
    mapData, 
    viewport, 
    './src/assets/troops/general/0003.png'
  );
  character.scale.set(0.5,0.5);
  
  // const targetTileGid = getTileGidFromPosition(
  //   overlayFirstGid,
  //   2,  // 3 to the right (column 3)
  //   5,  // 6 down (row 6)
  //   tilesPerRow
  // );
  
  // setTile(tilemap, mapData, 'selectionLayer', 25, 15, targetTileGid, tilesetTextures);


  viewport.position.set(app.screen.width / 2, app.screen.height / 2);
  viewport.scale.set(0.5, 0.5);
  
  setupCamera(app, viewport);
  
  console.log('Character spawned at tile (10, 10)');
}

main();