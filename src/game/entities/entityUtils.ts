import * as PIXI from 'pixi.js';
import { type TiledMap } from '../types/tilemapTypes';
import { tileToScreen } from '../tilemap/tilemapUtils';
import { CharacterMovement } from './entityMovement';
import troopDefs from '../data/troops.json';
import { colyseusClient } from '../network/colyseusClient';
import { TroopHUDController } from '../ui/troopHUDController';

export type TroopType = keyof typeof troopDefs;

const troopRegistry = new Map<string, CharacterMovement>();
let intermissionComplete = false;

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

    if (intermissionComplete) {
      movement.setVisible(true);
    }

    movement.ownerId  = msg.ownerId;
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

  colyseusClient.onTroopDied((id) => {
    const m = troopRegistry.get(id);
    if (m) {
      m.destroy();
      troopRegistry.delete(id);
    }
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
  const texture = await PIXI.Assets.load(def.spritePath + '0004.png');
  const sprite = new PIXI.Sprite(texture);
  const screenPos = tileToScreen(tileX, tileY, mapData);

  sprite.anchor.set(0.5, 1);
  const yOffset = (def as any).spriteYOffset ?? 0;
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
      spriteYOffset: (def as any).spriteYOffset ?? 0,
      footprint: (def as any).footprint ?? { forward: 0, backward: 0, left: 0, right: 0 },
      isLocal,
    },
  );

  movement.health    = def.maxHealth;
  movement.maxHealth = def.maxHealth;
  movement.troopType = type;
  movement.portraitPath = def.portraitPath;

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

  const originalOpen  = movement.open.bind(movement);
  const originalClose = movement.close.bind(movement);

  movement.open = () => {
    if (isLocal) console.log('[entityUtils] open called for', movement.id);
    originalOpen();
    hudController.selectTroop(movement);
  };
  movement.close = () => {
    originalClose();
    hudController.deselect();
  };

  return movement;
}

export function revealAllEnemies(localSessionId: string): void {
  for (const movement of troopRegistry.values()) {
    if (movement.ownerId !== localSessionId) {
      movement.setVisible(true);
    }
  }
}

export function setIntermissionComplete(): void {
  intermissionComplete = true;
}