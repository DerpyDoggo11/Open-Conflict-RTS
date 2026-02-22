import * as PIXI from 'pixi.js';
import { type TiledMap } from '../types/tilemapTypes';
import { tileToScreen } from '../tilemap/tilemapUtils';

export async function spawnCharacter(
  tileX: number,
  tileY: number,
  mapData: TiledMap,
  viewport: PIXI.Container,
  spritePath: string
): Promise<PIXI.Sprite> {
  const texture = await PIXI.Assets.load(spritePath);
  const character = new PIXI.Sprite(texture);
  const screenPos = tileToScreen(tileX, tileY, mapData);

  character.anchor.set(0.5, 1);
  character.position.set(screenPos.x, screenPos.y + mapData.tileheight / 2);

  viewport.addChild(character);
  return character;
}
