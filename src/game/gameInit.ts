import * as PIXI from 'pixi.js';
import { loadTiledMap } from './tilemap/tilemapLoader';
import { createOceanMesh } from './tilemap/oceanBackground';
import { initTroopSync, preloadAllTroopAssets, spawnCharacter } from './entities/entityUtils';
import { setupCamera } from './entities/camera';
import {
  clearArrow, clearSelection, drawArrowToTile,
  initArrow, initSelection, initTrees, spawnSelectionRadius
} from './entities/selectionUtils';
import { colyseusClient } from './network/colyseusClient';
import { Intermission } from './intermission';
import { TroopHUDController } from './ui/troopHUDController';

const TEAM_SPAWN_ZONES: Record<string, { x: number; y: number; w: number; h: number }> = {
  Red:  { x: -11,  y: -4,  w: 4, h: 4 },
  Blue: { x: 8, y: -4, w: 4, h: 4 },
};

export async function initGame() {
  console.log('[initGame] Starting game initialization...');

  const params = new URLSearchParams(window.location.search);
  const playerName = localStorage.getItem('playerName') ?? 'Player';
  const map = params.get('map') ?? 'grasslands';

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

  const { tilemaps, tilesetTextures, mapData } = await loadTiledMap(
    './assets/tilemaps/grasslands.json'
  );

  const groundTilemap = tilemaps.get('Ground')!;

  const objectsContainer = new PIXI.Container();
  objectsContainer.sortableChildren = true;
  objectsContainer.label = 'Objects';

  const hudContainer = new PIXI.Container();
  const selectionContainer = new PIXI.Container();

  viewport.addChild(groundTilemap);
  viewport.addChild(objectsContainer);
  initSelection(selectionContainer);
  initArrow(viewport);
  viewport.addChild(selectionContainer);
  viewport.addChild(hudContainer);

  createOceanMesh(app, viewport, mapData);

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
      const spawnZone = TEAM_SPAWN_ZONES[myTeam] ?? TEAM_SPAWN_ZONES['Red'];

      intermission = new Intermission(
        app,
        viewport,
        mapData,
        tilesetTextures,
        hudContainer,
        objectsContainer,
        spawnZone,
        () => {
          console.log('Game started!');
        }
      );

      intermission.updateTeamsList(teams);
    } else if (intermission) {
      intermission.updateTeamsList(teams);
    }
  });

  viewport.pivot.set(0, 0);
  viewport.position.set(app.screen.width / 2, app.screen.height / 2);
  viewport.scale.set(0.5, 0.5);
  setupCamera(app, viewport);
}

initGame().catch(console.error);