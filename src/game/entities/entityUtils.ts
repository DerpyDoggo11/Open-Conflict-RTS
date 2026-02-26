import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';
import { tileToScreen } from '../tilemap/tilemapUtils';
import { CharacterMovement } from './entityMovement';
import { CharacterHUD } from '../ui/characterHUD';
import troopDefs from '../data/troops.json';
import { clearArrow, clearSelection } from './selectionUtils';
import { troopInfoOverlay } from '../ui/troopInfoOverlay';


export type TroopType = keyof typeof troopDefs;
const unitPanel = new troopInfoOverlay();

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

  const hud = new CharacterHUD(hudContainer, (action) => {
    clearSelection();
    clearArrow();
    if (action === 'move')   movement.openMove();
    if (action === 'attack') movement.openAttack();
  });

  const originalOpen  = movement.open.bind(movement);
  const originalClose = movement.close.bind(movement);

  movement.open = () => {
    originalOpen();
    hud.attachTo(movement.sprite);
    unitPanel.show(def.spritePath, type, def.maxHealth, def.maxHealth);
  };

  movement.close = () => {
    originalClose();
    hud.hide();
    unitPanel.hide();
  };

  app.ticker.add(() => hud.update(movement.sprite));

  return movement;
}