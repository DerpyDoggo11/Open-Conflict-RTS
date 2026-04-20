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
import { SoundManager } from '../sounds/soundHandler';


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

const VERTICAL_DIR_ORDER = [8, 1, 2, 7, 4, 3, 6, 5];


const textureCache = new Map<string, TroopTextures>();

async function sliceSpritesheet(
  baseTexture: PIXI.Texture,
  layout: 'grid' | 'vertical',
): Promise<Map<number, PIXI.Texture>> {
  const source = baseTexture.source;
  const result = new Map<number, PIXI.Texture>();

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
    for (let row = 0; row < 8; row++) {
      const dir = VERTICAL_DIR_ORDER[row];
      const rect = new PIXI.Rectangle(0, row * cellH, cellW, cellH);
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

let syncMapData: TiledMap | null = null;

type GameOverListener = (isVictory: boolean) => void;
const gameOverListeners: GameOverListener[] = [];
let gameOverFired = false;

export function onGameOver(fn: GameOverListener): void {
  gameOverListeners.push(fn);
}

function fireGameOver(isVictory: boolean): void {
  if (gameOverFired) return;
  gameOverFired = true;
  gameOverListeners.forEach(fn => fn(isVictory));
}

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
  syncMapData = mapData;

  if (!projectileManager) {
    objectsContainer.sortableChildren = true;
    projectileManager = new ProjectileManager(app, objectsContainer);
  }

  const isSpectator = colyseusClient.isSpectator;

  colyseusClient.onTroopSnapshot(async (troops) => {
    for (const t of troops) {
      if (troopRegistry.has(t.id)) continue;

      const movement = await spawnCharacter(
        t.type as TroopType,
        t.tileX, t.tileY,
        mapData, hudContainer,
        app, viewport, objectsContainer, tilesetTextures,
        false,
      );

      movement.ownerId = t.ownerId;
      movement.id = t.id;
      movement.health = t.health;
      movement.maxHealth = (troopDefs[t.type as TroopType]?.maxHealth) ?? t.health;

      movement.facingDx = t.facingDx;
      movement.facingDy = t.facingDy;
      movement.setTextures(textureCache.get(t.type) ?? new Map());

      movement.floatingHealthBar?.setHealth(t.health);

      movement.setVisible(true);

      troopRegistry.set(t.id, movement);
    }
  });

  colyseusClient.onTroopSpawn(async (msg) => {
    if (!isSpectator && msg.ownerId === colyseusClient.sessionId) return;
    if (troopRegistry.has(msg.id)) return;

    const movement = await spawnCharacter(
      msg.type as TroopType,
      msg.tileX, msg.tileY,
      mapData, hudContainer,
      app, viewport, objectsContainer, tilesetTextures,
      false,
    );

    if (isSpectator || intermissionComplete) {
      movement.setVisible(true);
    }

    movement.ownerId = msg.ownerId;
    movement.id = msg.id;
    movement.health = msg.health;

    if (msg.facingDx !== undefined && msg.facingDy !== undefined) {
      movement.facingDx = msg.facingDx;
      movement.facingDy = msg.facingDy;
      movement.setTextures(textureCache.get(msg.type) ?? new Map());
    }

    troopRegistry.set(msg.id, movement);
  });

  colyseusClient.onTroopMove((msg) => {
    const m = troopRegistry.get(msg.id);
    if (m && m.ownerId !== colyseusClient.sessionId) {
      m.moveTo(msg.tileX, msg.tileY);
    }
  });

  colyseusClient.onSplashDamage((msg) => {
    const attacker = troopRegistry.get(msg.attackerId);

    const action = attacker
      ? getActionForTroop(attacker.troopType, 'attack', msg.projectileDamage)
      : null;

    if (attacker && action?.sound) {
      SoundManager.play(action.sound, attacker.sprite.x, attacker.sprite.y);
    }

    if (attacker) {
      const dx = msg.targetTileX - attacker.tileX;
      const dy = msg.targetTileY - attacker.tileY;
      if (dx !== 0 || dy !== 0) {
        attacker.facingDx = Math.sign(dx) as -1 | 0 | 1;
        attacker.facingDy = Math.sign(dy) as -1 | 0 | 1;
      }
      attacker.playShoot();
    }

    const targetScreenPos = tileToScreen(msg.targetTileX, msg.targetTileY, mapData);
    const endX = targetScreenPos.x;
    const endY = targetScreenPos.y + mapData.tileheight / 2;

    const applyServerDamage = () => {
      for (const victim of msg.victims) {
        const m = troopRegistry.get(victim.id);
        if (!m) continue;

        m.health = victim.newHealth;
        m.takeDamage(0);
        m.floatingHealthBar?.setHealth(victim.newHealth);

        const hitPos = tileToScreen(m.tileX, m.tileY, mapData);
        SoundManager.play('troop_hit', hitPos.x, hitPos.y);

        if (victim.newHealth <= 0) {
          const deathSound = (troopDefs as any)[m.troopType]?.deathSound;
          if (deathSound) SoundManager.play(deathSound, hitPos.x, hitPos.y);
          if (m.troopType === 'general' && !isSpectator) {
            const isLocalGeneral = m.ownerId === colyseusClient.sessionId;
            fireGameOver(!isLocalGeneral);
          }
          troopRegistry.delete(victim.id);
          m.destroy();
        }
      }
    };

    if (action?.projectilePath && projectileManager && attacker) {
      projectileManager.spawnBurst(
        action.projectilePath,
        attacker.sprite.x,
        attacker.sprite.y - (attacker.sprite.height / 2),
        endX, endY,
        msg.shots,
        action.shotDelay ?? 200,
        undefined, undefined,
        (_shotIndex) => applyServerDamage(),
      );
    } else {
      const shotDelay = action?.shotDelay ?? 200;
      let remaining = msg.shots;
      const next = () => {
        if (remaining <= 0) return;
        applyServerDamage();
        remaining--;
        if (remaining > 0) setTimeout(next, shotDelay);
      };
      next();
    }
  });

  colyseusClient.onTroopDamage((msg) => {
    const m = troopRegistry.get(msg.id);
    if (!m) return;
    const attacker = troopRegistry.get(msg.attackerId);
    if (!isSpectator && attacker && attacker.ownerId === colyseusClient.sessionId) return;

    m.health = msg.newHealth;
    m.takeDamage(0);
    m.floatingHealthBar?.setHealth(msg.newHealth);

    if (m.health <= 0) {
      if (m.troopType === 'general' && !isSpectator) {
        const isLocalGeneral = m.ownerId === colyseusClient.sessionId;
        fireGameOver(!isLocalGeneral);
      }
      m.destroy();
      troopRegistry.delete(msg.id);
    }
  });

  colyseusClient.onTroopDied((id) => {
    const m = troopRegistry.get(id);
    if (m) {
      if (m.troopType === 'general' && !isSpectator) {
        const isLocalGeneral = m.ownerId === colyseusClient.sessionId;
        fireGameOver(!isLocalGeneral);
      }
      m.destroy();
      troopRegistry.delete(id);
    }
  });
}

function getAllAttackActions(type: TroopType): {
  damage: number; shots: number; shotDelay: number;
  splashRadius: number;
  projectilePath?: string; sound?: string;
}[] {
  const def = troopDefs[type] as any;
  if (!def.actions) return [];

  const results = [];
  for (const actionKey of def.actions) {
    const action = (actionDefs as any)[actionKey];
    if (action && action.type === 'attack') {
      results.push({
        damage: action.damage ?? 20,
        shots: action.shots ?? 1,
        shotDelay: action.shotDelay ?? 200,
        splashRadius: action.splashRadius ?? 1,
        projectilePath: action.projectilePath,
        sound: action.sound,
      });
    }
  }
  return results;
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
  const isSpectator = colyseusClient.isSpectator;

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
    sprite.visible = isSpectator ? true : false;
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
      visionRadius: (def as any).visionRadius ?? 5,
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

  if (isLocal && !isSpectator) {
    movement.teamId = localTeamId;

    if (localTeamId === 'Blue') {
      movement.facingDx = -1;
      movement.facingDy = 0;
    } else {
      movement.facingDx = 1;
      movement.facingDy = 0;
    }
    movement.setTextures(troopTextures);
  }

  if (isLocal && !isSpectator) {
    const troopId = `${colyseusClient.sessionId}_${type}_${tileX}_${tileY}_${Date.now()}`;
    troopRegistry.set(troopId, movement);
    colyseusClient.spawnTroop(troopId, type, tileX, tileY, def.maxHealth, movement.facingDx, movement.facingDy);
    movement.id = troopId;
    movement.ownerId = colyseusClient.sessionId;

    const originalMoveTo = movement.moveTo.bind(movement);
    const moveSound = (def as any).moveSound as string | undefined;
    movement.moveTo = (tx: number, ty: number) => {
      if (moveSound) {
        const pos = tileToScreen(movement.tileX, movement.tileY, mapData);
        SoundManager.play(moveSound, pos.x, pos.y);
      }
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

  if (isLocal && !isSpectator) {
    const attackActions = getAllAttackActions(type);
    if (attackActions.length > 0) {
      const originalOpenAttack = movement.openAttack.bind(movement);
      movement.openAttack = (callerOnAttackTile, callerDamage, callerShots) => {
        const matchedAction = attackActions.find(
          a => a.damage === callerDamage && a.shots === callerShots
        ) ?? attackActions[0];

        originalOpenAttack(
          (attackerId, targetTileX, targetTileY, damage, shots) => {
            colyseusClient.sendSplashAttackTile(
              attackerId, targetTileX, targetTileY,
              damage, shots, matchedAction.splashRadius,
            );
            callerOnAttackTile?.(attackerId, targetTileX, targetTileY, damage, shots);
          },
          matchedAction.damage,
          matchedAction.shots,
          matchedAction.splashRadius,
        );
      };
    }
  }

  return movement;
}

export function revealAllEnemies(localSessionId: string): void {
  for (const movement of troopRegistry.values()) {
    if (movement.ownerId !== localSessionId) movement.setVisible(true);
  }
}

export function revealAllTroops(): void {
  for (const movement of troopRegistry.values()) {
    movement.setVisible(true);
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

function getActionForTroop(type: string, actionType: string, damage?: number): any | null {
  const def = (troopDefs as any)[type];
  if (!def?.actions) return null;

  let fallback: any = null;
  for (const actionKey of def.actions) {
    const action = (actionDefs as any)[actionKey];
    if (action && action.type === actionType) {
      if (damage !== undefined && action.damage === damage) return action;
      if (!fallback) fallback = action;
    }
  }
  return fallback;
}