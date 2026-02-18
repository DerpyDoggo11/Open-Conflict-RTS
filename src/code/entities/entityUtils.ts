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
  // Load the character texture
  const texture = await PIXI.Assets.load(spritePath);
  const character = new PIXI.Sprite(texture);
  
  // Convert tile position to screen position
  const screenPos = tileToScreen(tileX, tileY, mapData);
  // Position the character
  character.position.set(screenPos.x, screenPos.y);
  
  // Set anchor to bottom center (typical for isometric characters)
  character.anchor.set(0.5, 1);
  
  // Add to viewport so it moves with the camera
  viewport.addChild(character);
  
  return character;
}
