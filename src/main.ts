import { Application, Sprite, Assets } from 'pixi.js';

async function main() {
  const app = new Application();

  // Attach canvas to the page
  await app.init({ background: '#222', resizeTo: window });
  document.body.appendChild(app.canvas);

  // Load a sprite (optional)
  const texture = await Assets.load('https://pixijs.com/assets/bunny.png');
  const bunny = new Sprite(texture);

  bunny.anchor.set(0.5);
  bunny.x = app.screen.width / 2;
  bunny.y = app.screen.height / 2;

  app.stage.addChild(bunny);

  app.ticker.add(() => {
    bunny.rotation += 0.01;
  });
}

main();
