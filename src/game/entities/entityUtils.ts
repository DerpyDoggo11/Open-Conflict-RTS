import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { type TiledMap } from '../types/tilemapTypes';
import { tileToScreen } from '../tilemap/tilemapUtils';
import { CharacterMovement, type CharacterMovementOptions } from './entityMovement';
import { CharacterHUD } from '../ui/characterHUD';
import { clearArrow, clearSelection } from './selectionUtils';

export interface SpawnCharacterOptions extends CharacterMovementOptions {
  scale?: number;
}

export async function spawnCharacter(
  tileX: number,
  tileY: number,
  mapData: TiledMap,
  container: PIXI.Container,
  hudContainer: PIXI.Container,
  app: PIXI.Application,
  viewport: PIXI.Container,
  objectsTilemap: CompositeTilemap,
  tilesetTextures: Map<number, PIXI.Texture>,
  options: SpawnCharacterOptions = {},
): Promise<CharacterMovement> {
  const { scale = 1, ...movementOptions } = options;

  const texture = await PIXI.Assets.load(movementOptions.spritePath + '0004.png');
  const sprite = new PIXI.Sprite(texture);
  const screenPos = tileToScreen(tileX, tileY, mapData);
  sprite.anchor.set(0.5, 1);
  sprite.position.set(screenPos.x, screenPos.y + mapData.tileheight / 2);
  sprite.scale.set(scale);
  container.addChild(sprite);

  const movement = new CharacterMovement(
    sprite, tileX, tileY,
    app, viewport,
    objectsTilemap, tilesetTextures, mapData,
    movementOptions,
  );

  const hud = new CharacterHUD(hudContainer, (action) => {
    clearSelection();
    clearArrow();
    if (action === 'move')   movement.openMove();
    if (action === 'attack') movement.openAttack();
  });


  const originalOpen = movement.open.bind(movement);
  const originalClose = movement.close.bind(movement);

  movement.open = () => {
    originalOpen();
    hud.attachTo(movement.sprite);
  };

  movement.close = () => {
    originalClose();
    hud.hide();
  };

  app.ticker.add(() => hud.update(movement.sprite));

  return movement;
}