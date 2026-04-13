import * as PIXI from 'pixi.js';

export interface CameraController {
  lerpTo(worldX: number, worldY: number, durationMs?: number): Promise<void>;
  centerOn(worldX: number, worldY: number): void;
}

export function setupCamera(app: PIXI.Application, viewport: PIXI.Container): CameraController {
  let panVelocityX = 0;
  let panVelocityY = 0;
  const panFriction = 0.85;
  const panAccel = 1.5;

  let targetScale = viewport.scale.x;
  const zoomSmoothing = 0.12;
  const minScale = 0.1;
  const maxScale = 3;

  let zoomAnchorScreen: { x: number; y: number } | null = null;
  let zoomAnchorWorld: { x: number; y: number } | null = null;

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let lastDragPos = { x: 0, y: 0 };
  let dragVelocityX = 0;
  let dragVelocityY = 0;
  const dragInertiaFriction = 0.92;

  const keysDown = new Set<string>();

  let lerpAnim: {
    startX: number; startY: number;
    endX: number; endY: number;
    startTime: number; duration: number;
    resolve: () => void;
  } | null = null;

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  app.ticker.add(() => {
    if (lerpAnim) {
      const elapsed = performance.now() - lerpAnim.startTime;
      const t = Math.min(1, elapsed / lerpAnim.duration);
      const eased = easeOutCubic(t);

      viewport.position.x = lerpAnim.startX + (lerpAnim.endX - lerpAnim.startX) * eased;
      viewport.position.y = lerpAnim.startY + (lerpAnim.endY - lerpAnim.startY) * eased;

      if (t >= 1) {
        const { resolve } = lerpAnim;
        lerpAnim = null;
        resolve();
      }
      return;
    }

    if (keysDown.has('ArrowUp') || keysDown.has('w'))    panVelocityY += panAccel;
    if (keysDown.has('ArrowDown') || keysDown.has('s'))  panVelocityY -= panAccel;
    if (keysDown.has('ArrowLeft') || keysDown.has('a'))  panVelocityX += panAccel;
    if (keysDown.has('ArrowRight') || keysDown.has('d')) panVelocityX -= panAccel;

    if (Math.abs(panVelocityX) > 0.01 || Math.abs(panVelocityY) > 0.01) {
      viewport.position.x += panVelocityX;
      viewport.position.y += panVelocityY;
      panVelocityX *= panFriction;
      panVelocityY *= panFriction;
    } else {
      panVelocityX = 0;
      panVelocityY = 0;
    }

    if (!isDragging && (Math.abs(dragVelocityX) > 0.1 || Math.abs(dragVelocityY) > 0.1)) {
      viewport.position.x += dragVelocityX;
      viewport.position.y += dragVelocityY;
      dragVelocityX *= dragInertiaFriction;
      dragVelocityY *= dragInertiaFriction;
    } else if (!isDragging) {
      dragVelocityX = 0;
      dragVelocityY = 0;
    }

    const scaleDiff = targetScale - viewport.scale.x;
    if (Math.abs(scaleDiff) > 0.0005) {
      const newScale = viewport.scale.x + scaleDiff * zoomSmoothing;
      viewport.scale.set(newScale, newScale);

      if (zoomAnchorScreen && zoomAnchorWorld) {
        viewport.position.x = zoomAnchorScreen.x - zoomAnchorWorld.x * newScale;
        viewport.position.y = zoomAnchorScreen.y - zoomAnchorWorld.y * newScale;
      }
    } else if (viewport.scale.x !== targetScale) {
      viewport.scale.set(targetScale, targetScale);
      if (zoomAnchorScreen && zoomAnchorWorld) {
        viewport.position.x = zoomAnchorScreen.x - zoomAnchorWorld.x * targetScale;
        viewport.position.y = zoomAnchorScreen.y - zoomAnchorWorld.y * targetScale;
      }
      zoomAnchorScreen = null;
      zoomAnchorWorld = null;
    }
  });

  // --- Mouse wheel zoom ---
  app.canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();

    if (lerpAnim) {
      lerpAnim.resolve();
      lerpAnim = null;
    }

    const zoomFactor = 0.15;
    const direction = e.deltaY > 0 ? -1 : 1;
    targetScale = Math.max(minScale, Math.min(maxScale, targetScale + direction * zoomFactor));

    const currentScale = viewport.scale.x;
    zoomAnchorScreen = { x: e.clientX, y: e.clientY };
    zoomAnchorWorld = {
      x: (e.clientX - viewport.position.x) / currentScale,
      y: (e.clientY - viewport.position.y) / currentScale,
    };
  });

  app.canvas.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 1 && e.button !== 2) return;

    if (lerpAnim) {
      lerpAnim.resolve();
      lerpAnim = null;
    }

    isDragging = true;
    dragVelocityX = 0;
    dragVelocityY = 0;
    zoomAnchorScreen = null;
    zoomAnchorWorld = null;
    dragStart = {
      x: e.clientX - viewport.position.x,
      y: e.clientY - viewport.position.y,
    };
    lastDragPos = { x: e.clientX, y: e.clientY };
    app.canvas.style.cursor = 'grabbing';
  });

  app.canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    dragVelocityX = e.clientX - lastDragPos.x;
    dragVelocityY = e.clientY - lastDragPos.y;
    lastDragPos = { x: e.clientX, y: e.clientY };

    viewport.position.x = newX;
    viewport.position.y = newY;
  });

  app.canvas.addEventListener('mouseup', (e: MouseEvent) => {
    if (e.button !== 1 && e.button !== 2) return;
    isDragging = false;
    app.canvas.style.cursor = 'grab';
  });

  app.canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    app.canvas.style.cursor = 'default';
  });

  app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  app.canvas.style.cursor = 'grab';

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (lerpAnim && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
      lerpAnim.resolve();
      lerpAnim = null;
    }

    keysDown.add(e.key);

    if (e.key === '+' || e.key === '=') {
      targetScale = Math.min(maxScale, targetScale + 0.15);
    } else if (e.key === '-' || e.key === '_') {
      targetScale = Math.max(minScale, targetScale - 0.15);
    }
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    keysDown.delete(e.key);
  });

  const controller: CameraController = {
    lerpTo(worldX: number, worldY: number, durationMs = 1200): Promise<void> {
      if (lerpAnim) {
        lerpAnim.resolve();
        lerpAnim = null;
      }

      panVelocityX = 0;
      panVelocityY = 0;
      dragVelocityX = 0;
      dragVelocityY = 0;
      zoomAnchorScreen = null;
      zoomAnchorWorld = null;

      const endX = app.screen.width / 2 - worldX * viewport.scale.x;
      const endY = app.screen.height / 2 - worldY * viewport.scale.y;

      return new Promise<void>((resolve) => {
        lerpAnim = {
          startX: viewport.position.x,
          startY: viewport.position.y,
          endX,
          endY,
          startTime: performance.now(),
          duration: durationMs,
          resolve,
        };
      });
    },

    centerOn(worldX: number, worldY: number): void {
      viewport.position.x = app.screen.width / 2 - worldX * viewport.scale.x;
      viewport.position.y = app.screen.height / 2 - worldY * viewport.scale.y;
    },
  };

  return controller;
}