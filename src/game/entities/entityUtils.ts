import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';
import { tileToScreen } from '../tilemap/tilemapUtils';
import { CharacterMovement } from './entityMovement';
import troopDefs from '../data/troops.json';
import { clearArrow, clearSelection } from './selectionUtils';
import { colyseusClient } from '../network/colyseusClient';

export type TroopType = keyof typeof troopDefs;


// const unitPanel = new troopInfoOverlay();

// Registry lives here — scoped to this module
const troopRegistry = new Map<string, CharacterMovement>();

// Call once after joining to wire up opponent sync
export function initTroopSync(
  mapData: TiledMap,
  characterContainer: PIXI.Container,
  hudContainer: PIXI.Container,
  app: PIXI.Application,
  viewport: PIXI.Container,
  objectsTilemap: CompositeTilemap,
  tilesetTextures: Map<number, PIXI.Texture>,
): void {

  colyseusClient.onTroopSpawn(async (msg) => {
    console.log("spawn received:", msg.id, "owner:", msg.ownerId, "me:", colyseusClient.sessionId);
    
    if (msg.ownerId === colyseusClient.sessionId) {
      console.log("skipping own troop");
      return;
    }

    const movement = await spawnCharacter(
      msg.type as TroopType,
      msg.tileX, msg.tileY,
      mapData, characterContainer, hudContainer,
      app, viewport, objectsTilemap, tilesetTextures,
      false,
    );
    troopRegistry.set(msg.id, movement);
  });

  colyseusClient.onTroopMove((msg) => {
    const m = troopRegistry.get(msg.id);
    if (m) m.moveTo(msg.tileX, msg.tileY);
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
  characterContainer: PIXI.Container,
  hudContainer: PIXI.Container,
  app: PIXI.Application,
  viewport: PIXI.Container,
  objectsTilemap: CompositeTilemap,
  tilesetTextures: Map<number, PIXI.Texture>,
  isLocal: boolean = true,
): Promise<CharacterMovement> {
  const def = troopDefs[type];
  const texture = await PIXI.Assets.load(def.spritePath + '0004.png');
  const sprite = new PIXI.Sprite(texture);
  const screenPos = tileToScreen(tileX, tileY, mapData);
  sprite.anchor.set(0.5, 1);
  sprite.position.set(screenPos.x, screenPos.y + mapData.tileheight / 2);
  sprite.scale.set(def.scale);
  characterContainer.addChild(sprite);

  const movement = new CharacterMovement(
    sprite, tileX, tileY,
    app, viewport,
    objectsTilemap, tilesetTextures, mapData,
    {
      selectionRadius: def.selectionRadius,
      attackRadius:    def.attackRadius,
      treeSwapRadius:  def.treeSwapRadius,
      spritePath:      def.spritePath,
    },
  );

  const troopId = `${colyseusClient.sessionId}_${type}_${tileX}_${tileY}_${Date.now()}`;

  if (isLocal) {
    troopRegistry.set(troopId, movement);

    colyseusClient.spawnTroop(troopId, type, tileX, tileY, def.maxHealth);

    const originalMoveTo = movement.moveTo.bind(movement);
    movement.moveTo = (tx: number, ty: number) => {
      originalMoveTo(tx, ty);
      colyseusClient.moveTroop(troopId, tx, ty);
    };
  }

  // if (isLocal) {
  //   const hud = new CharacterHUD(hudContainer, (action) => {
  //     clearSelection();
  //     clearArrow();
  //     if (action === 'move')   movement.openMove();
  //     if (action === 'attack') movement.openAttack();
  //   });

  //   const originalOpen  = movement.open.bind(movement);
  //   const originalClose = movement.close.bind(movement);

  //   movement.open = () => {
  //     originalOpen();
  //     hud.attachTo(movement.sprite);
  //     unitPanel.show(def.spritePath, type, def.maxHealth, def.maxHealth);
  //   };

  //   movement.close = () => {
  //     originalClose();
  //     hud.hide();
  //     unitPanel.hide();
  //   };

  //   app.ticker.add(() => hud.update(movement.sprite));
  // }

  return movement;
}