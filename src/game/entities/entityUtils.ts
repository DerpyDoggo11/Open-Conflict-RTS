import * as PIXI from 'pixi.js';
import { type TiledMap } from '../types/tilemapTypes';
import { tileToScreen } from '../tilemap/tilemapUtils';
import { CharacterMovement, type TroopAnimations } from './entityMovement';
import troopDefs from '../data/troops.json';
import actionDefs from '../data/actions.json';
import { colyseusClient } from '../network/colyseusClient';
import { TroopHUDController } from '../ui/troopHUDController';


const ANIM_CLIP_NAMES = ['Idle', 'Move', 'Shoot'] as const;
const MAX_FRAMES = 12;
const animationCache = new Map<string, TroopAnimations>();

async function loadTroopAnimations(spritePath: string): Promise<TroopAnimations> {
  const animations: TroopAnimations = new Map();

  for (let dir = 1; dir <= 8; dir++) {
    const dirMap = new Map<string, PIXI.Texture[]>();

    for (const animName of ANIM_CLIP_NAMES) {
      const frames: PIXI.Texture[] = [];

      for (let f = 1; f <= MAX_FRAMES; f++) {
        const url = `${spritePath}${dir}/${animName}/${f}.png`;
        try {
          const tex = await PIXI.Assets.load(url);
          frames.push(tex);
        } catch {
          break;
        }
      }

      if (frames.length > 0) {
        dirMap.set(animName, frames);
      }
    }

    animations.set(dir, dirMap);
  }

  return animations;
}

export type TroopType = keyof typeof troopDefs;

const troopRegistry = new Map<string, CharacterMovement>();
let intermissionComplete = false;

/** Local team ID, set when we know which team the local player is on */
let localTeamId = '';

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
    movement.id      = msg.id;
    movement.health  = msg.health;
    troopRegistry.set(msg.id, movement);
  });

  colyseusClient.onTroopMove((msg) => {
    const m = troopRegistry.get(msg.id);
    if (m && m.ownerId !== colyseusClient.sessionId) {
      m.moveTo(msg.tileX, msg.tileY);
    }
  });

  // Handle damage received from server (multi-hit with fireRate)
  colyseusClient.onTroopDamage((msg) => {
    const m = troopRegistry.get(msg.id);
    if (m) {
      m.health = msg.newHealth;
      // Trigger health change listeners to update healthbar
      m.takeDamage(0); // triggers listeners with current health (damage already applied)
      // Override to the server-authoritative value
      m.health = msg.newHealth;

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

/**
 * Get the attack action definition for a troop type.
 * Returns the first action with type "attack" from the troop's action list.
 */
function getAttackAction(type: TroopType): { damage: number; fireRate: number } | null {
  const def = troopDefs[type] as any;
  if (!def.actions) return null;

  for (const actionKey of def.actions) {
    const action = (actionDefs as any)[actionKey];
    if (action && action.type === 'attack') {
      return { damage: action.damage ?? 20, fireRate: action.fireRate ?? 1 };
    }
  }
  return null;
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

  const animations = animationCache.get(type) || new Map();
  const idleFrames = animations.get(4)?.get('Idle') ?? [];

  let sprite: PIXI.AnimatedSprite;
  if (idleFrames.length > 0) {
    sprite = new PIXI.AnimatedSprite(idleFrames);
  } else {
    sprite = new PIXI.AnimatedSprite([PIXI.Texture.WHITE]);
  }
  
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
      attackRadius:    def.attackRadius,
      treeSwapRadius:  def.treeSwapRadius,
      spritePath:      def.spritePath,
      spriteYOffset:   yOffset,
      footprint: (def as any).footprint ?? { forward: 0, backward: 0, left: 0, right: 0 },
      isLocal,
      animations,
      animationSpeed: (def as any).animationSpeed ?? 12,
      moveSpeed: (def as any).moveSpeed      ?? 300,
      shootLoops: (def as any).shootLoops     ?? 1,
    },
  );

  movement.health = def.maxHealth;
  movement.maxHealth = def.maxHealth;
  movement.troopType = type;
  movement.portraitPath = def.portraitPath;

  // Assign team: local troops get the local team, remote troops get detected later
  // or set by the caller after spawn
  if (isLocal) {
    movement.teamId = localTeamId;
  }

  if (isLocal) {
    const troopId = `${colyseusClient.sessionId}_${type}_${tileX}_${tileY}_${Date.now()}`;
    troopRegistry.set(troopId, movement);
    colyseusClient.spawnTroop(troopId, type, tileX, tileY, def.maxHealth);
    movement.id      = troopId;
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

  // Auto-deselect HUD when this troop dies
  movement.onHealthChange((hp) => {
    if (hp <= 0) {
      hudController.deselect();
    }
  });

  // Override openAttack to include damage/fireRate from action definitions
  // and send attack to server
  if (isLocal) {
    const attackAction = getAttackAction(type);
    if (attackAction) {
      const originalOpenAttack = movement.openAttack.bind(movement);
      movement.openAttack = (
        _onAttackTile?: any,
        _damage?: number,
        _fireRate?: number,
      ) => {
        originalOpenAttack(
          (attackerId: string, targetTileX: number, targetTileY: number, damage: number, fireRate: number) => {
            // Send attack to server with fireRate for multi-hit
            colyseusClient.sendAttackTile(attackerId, targetTileX, targetTileY, damage, fireRate);

            // Apply damage locally for immediate feedback
            const enemy = CharacterMovement.getEnemyAtTile(targetTileX, targetTileY);
            if (enemy) {
              applyMultiHitDamage(enemy, damage, fireRate);
            }
          },
          attackAction.damage,
          attackAction.fireRate,
        );
      };
    }
  }

  return movement;
}

/**
 * Apply damage multiple times based on fireRate, with a short delay between hits.
 */
function applyMultiHitDamage(target: CharacterMovement, damagePerHit: number, fireRate: number): void {
  let hitsRemaining = fireRate;
  const hitInterval = 200; // ms between each hit

  function applyNextHit() {
    if (hitsRemaining <= 0 || target.health <= 0) return;

    target.takeDamage(damagePerHit);
    hitsRemaining--;

    if (target.health <= 0) {
      // Troop is dead — remove from game
      troopRegistry.delete(target.id);
      target.destroy();
      return;
    }

    if (hitsRemaining > 0) {
      setTimeout(applyNextHit, hitInterval);
    }
  }

  applyNextHit();
}

export function revealAllEnemies(localSessionId: string): void {
  for (const movement of troopRegistry.values()) {
    if (movement.ownerId !== localSessionId) movement.setVisible(true);
  }
}

export function setIntermissionComplete(): void {
  intermissionComplete = true;
}

/**
 * Assign team IDs to all troops in the registry based on playersUpdate data.
 * Call this when you receive team info from the server.
 */
export function assignTeamsToTroops(teams: { teamName: string; players: { id: string; name: string }[] }[]): void {
  // Build a map of playerId -> teamName
  const playerTeamMap = new Map<string, string>();
  for (const team of teams) {
    for (const player of team.players) {
      playerTeamMap.set(player.id, team.teamName);
    }
  }

  // Set local team
  const myTeam = playerTeamMap.get(colyseusClient.sessionId);
  if (myTeam) {
    setLocalTeamId(myTeam);
  }

  // Assign teams to all registered troops
  for (const movement of troopRegistry.values()) {
    const team = playerTeamMap.get(movement.ownerId);
    if (team) {
      movement.teamId = team;
    }
  }
}

async function getTroopAnimations(type: TroopType, spritePath: string): Promise<TroopAnimations> {
  if (animationCache.has(type)) {
    return animationCache.get(type)!;
  }
  const anims = await loadTroopAnimations(spritePath);
  animationCache.set(type, anims);
  return anims;
}

async function progressivelyLoadAnimations(animMap: TroopAnimations, spritePath: string) {
  for (let dir = 1; dir <= 8; dir++) {
    let dirMap = animMap.get(dir);
    if (!dirMap) {
      dirMap = new Map<string, PIXI.Texture[]>();
      animMap.set(dir, dirMap);
    }

    for (const animName of ANIM_CLIP_NAMES) {
      const frames: PIXI.Texture[] = [];
      for (let f = 1; f <= MAX_FRAMES; f++) {
        const url = `${spritePath}${dir}/${animName}/${f}.png`;
        try {
          const tex = await PIXI.Assets.load(url);
          frames.push(tex);
        } catch {
          break;
        }
      }
      
      if (frames.length > 0) {
        dirMap.set(animName, frames);
      }
    }
  }
}

export async function preloadAllTroopAssets(): Promise<void> {
  console.log('[entityUtils] Fast-preloading fallbacks...');
  const types = Object.keys(troopDefs) as TroopType[];

  await Promise.all(types.map(async (type) => {
    const def = troopDefs[type as TroopType];
    const animMap: TroopAnimations = new Map();
    animationCache.set(type, animMap);

    let fallbackTex: PIXI.Texture | null = null;
    try {
      fallbackTex = await PIXI.Assets.load(`${def.spritePath}4/Idle/1.png`);
    } catch {
      try { fallbackTex = await PIXI.Assets.load(`${def.spritePath}0004.png`); } catch {}
    }

    if (fallbackTex) {
      const dirMap = new Map<string, PIXI.Texture[]>();
      dirMap.set('Idle', [fallbackTex]);
      animMap.set(4, dirMap);
    }

    progressivelyLoadAnimations(animMap, def.spritePath).catch(console.error);
  }));

  console.log('[entityUtils] Fast-preload complete, background loading started.');
}