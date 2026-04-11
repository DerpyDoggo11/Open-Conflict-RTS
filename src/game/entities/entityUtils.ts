import * as PIXI from 'pixi.js';
import { type TiledMap } from '../types/tilemapTypes';
import { tileToScreen } from '../tilemap/tilemapUtils';
import { CharacterMovement, type TroopTextures } from './entityMovement';
import troopDefs from '../data/troops.json';
import actionDefs from '../data/actions.json';
import { colyseusClient } from '../network/colyseusClient';
import { TroopHUDController } from '../ui/troopHUDController';
import { ProjectileManager } from './projectileManager';
import { FloatingHealthBar } from './floatingHealthBar';

/**
 * Direction layout for 3×3 grid spritesheets:
 *
 *   Spritesheet grid:
 *     (0,0) SW    (1,0) S     (2,0) SE
 *     (0,1) W     (1,1) N     (2,1) E
 *     (0,2) NW    (1,2) NE    (2,2) EMPTY
 *
 *   Direction numbers (clockwise from dir 1):
 *     8(SW)  1(S)   2(SE)
 *     7(W)   4(N)   3(E)
 *     6(NW)  5(NE)  —
 *
 * For vertical strip spritesheets (128px troops):
 *   directions 1–8 top to bottom
 */
const GRID_DIR_MAP: Record<number, { col: number; row: number }> = {
  8: { col: 0, row: 0 },
  1: { col: 1, row: 0 },
  2: { col: 2, row: 0 },
  7: { col: 0, row: 1 },
  4: { col: 1, row: 1 },
  3: { col: 2, row: 1 },
  6: { col: 0, row: 2 },
  5: { col: 1, row: 2 },
};

const textureCache = new Map<string, TroopTextures>();

/**
 * Slice a spritesheet into per-direction textures.
 * layout "grid": 3×3 grid, each cell = source.width/3 × source.height/3
 * layout "vertical": 1 column, 8 rows
 */
async function sliceSpritesheet(
  baseTexture: PIXI.Texture,
  layout: 'grid' | 'vertical',
): Promise<Map<number, PIXI.Texture>> {
  const source = baseTexture.source;
  const result = new Map<number, PIXI.Texture>();

  // Wait for the image source to fully decode if not ready yet
  if (source.width === 0 || source.height === 0) {
    if (source.resource instanceof HTMLImageElement) {
      await source.resource.decode();
      source.update();
    } else if (source.resource instanceof ImageBitmap) {
      source.update();
    }
  }

  const srcW = source.width;
  const srcH = source.height;

  if (srcW === 0 || srcH === 0) {
    console.warn('[sliceSpritesheet] Source has zero dimensions:', srcW, srcH);
    return result;
  }

  if (layout === 'grid') {
    const cellW = Math.floor(srcW / 3);
    const cellH = Math.floor(srcH / 3);
    for (let dir = 1; dir <= 8; dir++) {
      const pos = GRID_DIR_MAP[dir];
      const rect = new PIXI.Rectangle(pos.col * cellW, pos.row * cellH, cellW, cellH);
      result.set(dir, new PIXI.Texture({ source, frame: rect }));
    }
  } else {
    const cellW = srcW;
    const cellH = Math.floor(srcH / 8);
    for (let dir = 1; dir <= 8; dir++) {
      const rect = new PIXI.Rectangle(0, (dir - 1) * cellH, cellW, cellH);
      result.set(dir, new PIXI.Texture({ source, frame: rect }));
    }
  }

  return result;
}

async function loadTroopTextures(spritePath: string, layout: 'grid' | 'vertical', hasShoot: boolean): Promise<TroopTextures> {
  const textures: TroopTextures = new Map();

  const idlePath = `${spritePath}idle.png`;
  let idleSheet: PIXI.Texture;
  try {
    idleSheet = await PIXI.Assets.load(idlePath);
  } catch {
    console.warn(`[entityUtils] Failed to load idle spritesheet: ${idlePath}`);
    return textures;
  }

  // Ensure the texture source is actually loaded and has dimensions
  if (!idleSheet || !idleSheet.source || idleSheet.source.width === 0) {
    console.warn(`[entityUtils] Idle sheet loaded but has no dimensions: ${idlePath}`);
    return textures;
  }

  const idleFrames = await sliceSpritesheet(idleSheet, layout);

  let shootFrames: Map<number, PIXI.Texture> | null = null;
  if (hasShoot) {
    try {
      const shootSheet = await PIXI.Assets.load(`${spritePath}shoot.png`);
      if (shootSheet?.source) {
        shootFrames = await sliceSpritesheet(shootSheet, layout);
      }
    } catch {
      // no shoot spritesheet — that's fine
    }
  }

  for (let dir = 1; dir <= 8; dir++) {
    const idle = idleFrames.get(dir);
    if (!idle) continue;
    textures.set(dir, {
      idle,
      shoot: shootFrames?.get(dir),
    });
  }

  return textures;
}

export type TroopType = keyof typeof troopDefs;

const troopRegistry = new Map<string, CharacterMovement>();
let intermissionComplete = false;

let localTeamId = '';
let projectileManager: ProjectileManager | null = null;

export function setLocalTeamId(teamId: string): void {
  localTeamId = teamId;
}

export function getLocalTeamId(): string {
  return localTeamId;
}

export function initTroopSync(
  mapData: TiledMap,
  hudContainer: PIXI.Container,
  app: PIXI.Application,
  viewport: PIXI.Container,
  objectsContainer: PIXI.Container,
  tilesetTextures: Map<number, PIXI.Texture>,
): void {
  if (!projectileManager) {
    objectsContainer.sortableChildren = true;
    projectileManager = new ProjectileManager(app, objectsContainer);
  }

  colyseusClient.onTroopSpawn(async (msg) => {
    if (msg.ownerId === colyseusClient.sessionId) return;

    const movement = await spawnCharacter(
      msg.type as TroopType,
      msg.tileX, msg.tileY,
      mapData, hudContainer,
      app, viewport, objectsContainer, tilesetTextures,
      false,
    );

    if (intermissionComplete) movement.setVisible(true);

    movement.ownerId = msg.ownerId;
    movement.id = msg.id;
    movement.health = msg.health;
    troopRegistry.set(msg.id, movement);
  });

  colyseusClient.onTroopMove((msg) => {
    const m = troopRegistry.get(msg.id);
    if (m && m.ownerId !== colyseusClient.sessionId) {
      m.moveTo(msg.tileX, msg.tileY);
    }
  });

  colyseusClient.onTroopDamage((msg) => {
    const m = troopRegistry.get(msg.id);
    if (m) {
      const attacker = troopRegistry.get(msg.attackerId);
      if (attacker && attacker.ownerId !== colyseusClient.sessionId && projectileManager) {
        const action = getActionForTroop(attacker.troopType, 'attack');
        if (action?.projectilePath) {
          const targetScreenPos = tileToScreen(m.tileX, m.tileY, mapData);
          const targetY = targetScreenPos.y + mapData.tileheight / 2 + ((troopDefs as any)[m.troopType]?.spriteYOffset ?? 0);
          projectileManager.spawn({
            texturePath: action.projectilePath,
            startX: attacker.sprite.x,
            startY: attacker.sprite.y - (attacker.sprite.height / 2),
            endX: targetScreenPos.x,
            endY: targetY - (m.sprite.height / 2),
            onImpact: () => {
              m.health = msg.newHealth;
              m.takeDamage(0);
              m.health = msg.newHealth;
              m.floatingHealthBar?.setHealth(m.health);
              if (m.health <= 0) {
                m.destroy();
                troopRegistry.delete(msg.id);
              }
            },
          });
          return;
        }
      }

      m.health = msg.newHealth;
      m.takeDamage(0);
      m.health = msg.newHealth;
      m.floatingHealthBar?.setHealth(m.health);
      if (m.health <= 0) {
        m.destroy();
        troopRegistry.delete(msg.id);
      }
    }
  });

  colyseusClient.onTroopDied((id) => {
    const m = troopRegistry.get(id);
    if (m) {
      m.destroy();
      troopRegistry.delete(id);
    }
  });
}

function getAttackAction(type: TroopType): { damage: number; shots: number; shotDelay: number; projectilePath?: string } | null {
  const def = troopDefs[type] as any;
  if (!def.actions) return null;

  for (const actionKey of def.actions) {
    const action = (actionDefs as any)[actionKey];
    if (action && action.type === 'attack') {
      return {
        damage: action.damage ?? 20,
        shots: action.shots ?? 1,
        shotDelay: action.shotDelay ?? 200,
        projectilePath: action.projectilePath,
      };
    }
  }
  return null;
}

function troopHasShootAction(type: TroopType): boolean {
  const def = troopDefs[type] as any;
  if (!def.actions) return false;
  return def.actions.some((key: string) => {
    const action = (actionDefs as any)[key];
    return action && action.type === 'attack';
  });
}

export async function spawnCharacter(
  type: TroopType,
  tileX: number,
  tileY: number,
  mapData: TiledMap,
  hudContainer: PIXI.Container,
  app: PIXI.Application,
  viewport: PIXI.Container,
  objectsContainer: PIXI.Container,
  tilesetTextures: Map<number, PIXI.Texture>,
  isLocal: boolean = true,
): Promise<CharacterMovement> {
  const def = troopDefs[type];

  let troopTextures = textureCache.get(type);
  if (!troopTextures || troopTextures.size === 0) {
    console.log(`[spawnCharacter] Textures not cached for ${type}, loading now...`);
    const layout: 'grid' | 'vertical' = def.scale >= 1 ? 'vertical' : 'grid';
    const hasShoot = troopHasShootAction(type);
    try {
      troopTextures = await loadTroopTextures(def.spritePath, layout, hasShoot);
      textureCache.set(type, troopTextures);
      console.log(`[spawnCharacter] Loaded ${troopTextures.size} directions for ${type}`);
    } catch (e) {
      console.warn(`[spawnCharacter] Failed to load textures for ${type}:`, e);
      troopTextures = new Map();
    }
  }

  let initialTex: PIXI.Texture = PIXI.Texture.WHITE;
  const dir4 = troopTextures.get(4);
  if (dir4?.idle) {
    initialTex = dir4.idle;
  } else {
    for (const [, entry] of troopTextures) {
      if (entry?.idle) { initialTex = entry.idle; break; }
    }
  }

  if (initialTex === PIXI.Texture.WHITE && troopTextures.size > 0) {
    console.warn(`[spawnCharacter] ${type}: textures cached but no idle found in any direction`);
  }

  const sprite = new PIXI.Sprite(initialTex);
  const screenPos = tileToScreen(tileX, tileY, mapData);
  const yOffset: number = (def as any).spriteYOffset ?? 0;

  sprite.anchor.set(0.5, 1);
  sprite.position.set(screenPos.x, screenPos.y + mapData.tileheight / 2 + yOffset);
  sprite.scale.set(def.scale);

  if (!isLocal) {
    sprite.visible = false;
    sprite.tint = new PIXI.Color('#D9CACC');
  }

  objectsContainer.addChild(sprite);

  const movement = new CharacterMovement(
    sprite, tileX, tileY,
    app, viewport,
    objectsContainer, tilesetTextures, mapData,
    {
      selectionRadius: def.selectionRadius,
      attackRadius: def.attackRadius,
      treeSwapRadius: def.treeSwapRadius,
      spritePath: def.spritePath,
      spriteYOffset: yOffset,
      footprint: (def as any).footprint ?? { forward: 0, backward: 0, left: 0, right: 0 },
      isLocal,
      textures: troopTextures,
      moveSpeed: (def as any).moveSpeed ?? 300,
      shootDuration: (def as any).shootDuration ?? 600,
    },
  );

  movement.health = def.maxHealth;
  movement.maxHealth = def.maxHealth;
  movement.troopType = type;
  movement.portraitPath = def.portraitPath;

  if (!isLocal) {
    const bar = new FloatingHealthBar(
      app, objectsContainer, sprite, def.maxHealth,
      '/assets/ui/healthBar.png',
    );
    movement.floatingHealthBar = bar;
  }

  if (isLocal) {
    movement.teamId = localTeamId;
  }

  if (isLocal) {
    const troopId = `${colyseusClient.sessionId}_${type}_${tileX}_${tileY}_${Date.now()}`;
    troopRegistry.set(troopId, movement);
    colyseusClient.spawnTroop(troopId, type, tileX, tileY, def.maxHealth);
    movement.id = troopId;
    movement.ownerId = colyseusClient.sessionId;

    const originalMoveTo = movement.moveTo.bind(movement);
    movement.moveTo = (tx: number, ty: number) => {
      originalMoveTo(tx, ty);
      colyseusClient.moveTroop(troopId, tx, ty);
    };
  }

  const hudController = new TroopHUDController(
    app, viewport, mapData, tilesetTextures, objectsContainer
  );
  hudController.mount();

  const originalOpen = movement.open.bind(movement);
  const originalClose = movement.close.bind(movement);

  movement.open = () => {
    originalOpen();
    hudController.selectTroop(movement);
  };
  movement.close = () => {
    originalClose();
    hudController.deselect();
  };

  movement.onHealthChange((hp) => {
    if (hp <= 0) {
      hudController.deselect();
    }
  });

  if (isLocal) {
    const attackAction = getAttackAction(type);
    if (attackAction) {
      const originalOpenAttack = movement.openAttack.bind(movement);
      movement.openAttack = (
        _onAttackTile?: any,
        _damage?: number,
        _shots?: number,
      ) => {
        originalOpenAttack(
          (attackerId: string, targetTileX: number, targetTileY: number, damage: number, shots: number) => {
            colyseusClient.sendAttackTile(attackerId, targetTileX, targetTileY, damage, shots);

            const enemy = CharacterMovement.getEnemyAtTile(targetTileX, targetTileY);
            if (enemy) {
              applyMultiHitDamage(
                movement,
                enemy,
                damage,
                shots,
                attackAction.shotDelay,
                attackAction.projectilePath,
                mapData,
              );
            }
          },
          attackAction.damage,
          attackAction.shots,
        );
      };
    }
  }

  return movement;
}

function applyMultiHitDamage(attacker: CharacterMovement, target: CharacterMovement, damagePerHit: number, shots: number, shotDelay: number, projectilePath: string | undefined, mapData: TiledMap): void {
  if (projectilePath && projectileManager) {
    const targetScreenPos = tileToScreen(target.tileX, target.tileY, mapData);
    const targetYOffset = ((troopDefs as any)[target.troopType]?.spriteYOffset ?? 0);
    const targetY = targetScreenPos.y + mapData.tileheight / 2 + targetYOffset;

    projectileManager.spawnBurst(
      projectilePath,
      attacker.sprite.x,
      attacker.sprite.y - (attacker.sprite.height / 2),
      targetScreenPos.x,
      targetY - (target.sprite.height / 2),
      shots,
      shotDelay,
      undefined,
      undefined,
      (_shotIndex) => {
        if (target.health <= 0) return;
        target.takeDamage(damagePerHit);
        target.floatingHealthBar?.setHealth(target.health);
        if (target.health <= 0) {
          troopRegistry.delete(target.id);
          target.destroy();
        }
      },
    );
  } else {
    let hitsRemaining = shots;
    function applyNextHit() {
      if (hitsRemaining <= 0 || target.health <= 0) return;
      target.takeDamage(damagePerHit);
      hitsRemaining--;
      if (target.health <= 0) {
        troopRegistry.delete(target.id);
        target.destroy();
        return;
      }
      if (hitsRemaining > 0) {
        setTimeout(applyNextHit, shotDelay);
      }
    }
    applyNextHit();
  }
}

export function revealAllEnemies(localSessionId: string): void {
  for (const movement of troopRegistry.values()) {
    if (movement.ownerId !== localSessionId) movement.setVisible(true);
  }
}

export function setIntermissionComplete(): void {
  intermissionComplete = true;
}

export function assignTeamsToTroops(teams: { teamName: string; players: { id: string; name: string }[] }[]): void {
  const playerTeamMap = new Map<string, string>();
  for (const team of teams) {
    for (const player of team.players) {
      playerTeamMap.set(player.id, team.teamName);
    }
  }

  const myTeam = playerTeamMap.get(colyseusClient.sessionId);
  if (myTeam) {
    setLocalTeamId(myTeam);
  }

  for (const movement of troopRegistry.values()) {
    const team = playerTeamMap.get(movement.ownerId);
    if (team) {
      movement.teamId = team;
    }
  }
}

/**
 * Preload all troop spritesheets. Determines layout from scale:
 * scale >= 1 → vertical strip, otherwise → 3×3 grid.
 */
export async function preloadAllTroopAssets(): Promise<void> {
  console.log('[entityUtils] Preloading troop spritesheets...');
  const types = Object.keys(troopDefs) as TroopType[];

  await Promise.all(types.map(async (type) => {
    const def = troopDefs[type];
    const layout: 'grid' | 'vertical' = def.scale >= 1 ? 'vertical' : 'grid';
    const hasShoot = troopHasShootAction(type);

    try {
      const textures = await loadTroopTextures(def.spritePath, layout, hasShoot);
      textureCache.set(type, textures);
      console.log(`[entityUtils] Preloaded ${type}: ${textures.size} directions`);
    } catch (err) {
      console.error(`[entityUtils] Failed to preload ${type}:`, err);
    }
  }));

  console.log('[entityUtils] Spritesheet preload complete.');
}

function getActionForTroop(type: string, actionType: string): any | null {
  const def = (troopDefs as any)[type];
  if (!def?.actions) return null;
  for (const actionKey of def.actions) {
    const action = (actionDefs as any)[actionKey];
    if (action && action.type === actionType) return action;
  }
  return null;
}