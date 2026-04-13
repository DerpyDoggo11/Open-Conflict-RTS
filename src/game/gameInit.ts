import * as PIXI from 'pixi.js';
import { loadTiledMap } from './tilemap/tilemapLoader';
// import { createOceanMesh } from './tilemap/oceanBackground';
import { initTroopSync, preloadAllTroopAssets, setLocalTeamId, spawnCharacter } from './entities/entityUtils';
import { setupCamera } from './entities/camera';
import {
  clearArrow, clearSelection, drawArrowToTile,
  initArrow, initGrid, initMapGids, initSelection, initTileInput, initTrees, spawnSelectionRadius
} from './entities/selectionUtils';
import { colyseusClient } from './network/colyseusClient';
import { Intermission } from './intermission';
import { TroopHUDController } from './ui/troopHUDController';
import { initWalkableGids } from './tilemap/tilemapUtils';
import { tileToScreen } from './tilemap/tilemapUtils';
import { FogOfWar } from './tilemap/fogOfWar';
import { SoundManager } from './sounds/soundHandler';
import soundDefs from './data/sounds.json';

const TEAM_SPAWN_ZONES: Record<string, { x: number; y: number; w: number; h: number }> = {
  Red:  { x: -9,  y: -4,  w: 3, h: 9 },
  Blue: { x: 18, y: -4, w: 3, h: 9 },
};

const TEAM_GENERAL_SPAWNS: Record<string, { tileX: number; tileY: number }> = {
  Red:  { tileX: -9, tileY: 0 },
  Blue: { tileX: 20, tileY: 0 },
};

export async function initGame() {
  console.log('[initGame] Starting game initialization...');

  const params = new URLSearchParams(window.location.search);
  const playerName = localStorage.getItem('playerName') ?? 'Player';
  const map = params.get('map') || 'isle';

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

  await SoundManager.init(app, viewport);
  await SoundManager.registerAll(soundDefs as Record<string, any>);
 
  const { tilemaps, tilesetTextures, mapData } = await loadTiledMap(
    `./assets/tilemaps/${map}.json`
  );

  initMapGids(mapData);
  initWalkableGids(mapData);
  initGrid(viewport, mapData);

  const groundTilemap = tilemaps.get('Ground')!;
  const objectsContainer = new PIXI.Container();
  objectsContainer.sortableChildren = true;
  objectsContainer.label = 'Objects';

  const hudContainer = new PIXI.Container();

  viewport.addChild(groundTilemap);
  initArrow(viewport);
  viewport.addChild(objectsContainer);
  initSelection(objectsContainer);
  viewport.addChild(hudContainer);

  try {
    await preloadAllTroopAssets();
  } catch (e) {
    console.error('[initGame] Failed to preload troop assets:', e);
  }

  try {
    await colyseusClient.joinGame(playerName);
    console.log('[initGame] joined game as', playerName);
  } catch (e) {
    console.error('[initGame] failed to join game room:', e);
    return;
  }

  initTrees(objectsContainer, tilesetTextures, mapData);

  initTroopSync(
    mapData,
    hudContainer,
    app,
    viewport,
    objectsContainer,
    tilesetTextures
  );

  viewport.pivot.set(0, 0);
  viewport.position.set(app.screen.width / 2, app.screen.height / 2);
  viewport.scale.set(0.5, 0.5);

  initTileInput(app, viewport, mapData);
  const camera = setupCamera(app, viewport);

  const fog = new FogOfWar(app, viewport, mapData);
 
  let intermission: Intermission | null = null;

  colyseusClient.onPlayersUpdate((teams) => {
    let myTeam: string | null = null;
    for (const team of teams) {
      for (const player of team.players) {
        if (player.id === colyseusClient.sessionId) {
          myTeam = team.teamName;
          break;
        }
      }
      if (myTeam) break;
    }

    if (myTeam && !intermission) {
      setLocalTeamId(myTeam);
      const spawnZone = TEAM_SPAWN_ZONES[myTeam] ?? TEAM_SPAWN_ZONES['Red'];
      const generalSpawn = TEAM_GENERAL_SPAWNS[myTeam] ?? TEAM_GENERAL_SPAWNS['Red'];

      intermission = new Intermission(
        app,
        viewport,
        mapData,
        tilesetTextures,
        hudContainer,
        objectsContainer,
        spawnZone,
        generalSpawn,
        () => {
          console.log('Game started!');
          fog.enable();
        }
      );
      intermission.updateTeamsList(teams);

      const centerTileX = spawnZone.x + spawnZone.w / 2;
      const centerTileY = spawnZone.y + spawnZone.h / 2;
      const screenPos = tileToScreen(centerTileX, centerTileY, mapData);
      camera.lerpTo(screenPos.x, screenPos.y, 1500);
    } else if (intermission) {
      intermission.updateTeamsList(teams);
    }
  });

  // background music

  let gameAudioCtx = new AudioContext();

  if (gameAudioCtx.state === "suspended") {
      const resume = () => {
          gameAudioCtx.resume();
          window.removeEventListener("pointerdown", resume);
          window.removeEventListener("keydown", resume);
      };
      window.addEventListener("pointerdown", resume);
      window.addEventListener("keydown", resume);
  }

  const resp = await fetch('/assets/sounds/music/game.mp3');
  const buf = await resp.arrayBuffer();
  const audioBuf = await gameAudioCtx.decodeAudioData(buf);

  let gameMusic = gameAudioCtx.createBufferSource();
  gameMusic.buffer = audioBuf;
  gameMusic.loop = true;

  const gain = gameAudioCtx.createGain();
  gain.gain.value = 0.7;
  gameMusic.connect(gain).connect(gameAudioCtx.destination);

  gameMusic.start();

}

initGame().catch(console.error);