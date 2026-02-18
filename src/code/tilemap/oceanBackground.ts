import * as PIXI from 'pixi.js';

export async function createOceanBackground(
  app: PIXI.Application,
  viewport: PIXI.Container
): Promise<void> {
  // Load all 20 ocean frames
  const frames: PIXI.Texture[] = [];
  for (let i = 1; i < 20; i++) {
    const paddedIndex = String(i).padStart(4, '0'); // e.g. 0000, 0001...
    const texture = await PIXI.Assets.load(
      `./src/assets/tilemaps/grasslands/water/${paddedIndex}.png`
    );
    frames.push(texture);
  }

  // Create an AnimatedSprite from the frames
  const ocean = new PIXI.AnimatedSprite(frames);

  // Cover the full screen — adjust width/height to taste
  ocean.width = app.screen.width * 20;
  ocean.height = app.screen.height * 20;

  // Center it under the map (offset to match your viewport centering)
  ocean.anchor.set(0.5, 0.5);
  ocean.position.set(0, 0);

  // Animation speed: 20 frames, aim for ~10fps → 10/60 ≈ 0.16
  ocean.animationSpeed = 0.16;
  ocean.loop = true;
  ocean.play();

  // Insert BEHIND the tilemap (index 0 = bottom of the display list)
  viewport.addChildAt(ocean, 0);
}