import * as PIXI from 'pixi.js';

export function setupCamera(app: PIXI.Application, viewport: PIXI.Container) {
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  
  app.canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const newScale = viewport.scale.x + (direction * zoomFactor);
    const clampedScale = Math.max(0.1, Math.min(3, newScale));
    
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    const worldPosBeforeZoom = {
      x: (mouseX - viewport.position.x) / viewport.scale.x,
      y: (mouseY - viewport.position.y) / viewport.scale.y
    };
    
    viewport.scale.set(clampedScale, clampedScale);
    
    const worldPosAfterZoom = {
      x: (mouseX - viewport.position.x) / viewport.scale.x,
      y: (mouseY - viewport.position.y) / viewport.scale.y
    };
    
    viewport.position.x += (worldPosAfterZoom.x - worldPosBeforeZoom.x) * viewport.scale.x;
    viewport.position.y += (worldPosAfterZoom.y - worldPosBeforeZoom.y) * viewport.scale.y;
  });
  
  app.canvas.addEventListener('mousedown', (e: MouseEvent) => {
    isDragging = true;
    dragStart = {
      x: e.clientX - viewport.position.x,
      y: e.clientY - viewport.position.y
    };
    app.canvas.style.cursor = 'grabbing';
  });
  
  app.canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (isDragging) {
      viewport.position.x = e.clientX - dragStart.x;
      viewport.position.y = e.clientY - dragStart.y;
    }
  });
  
  app.canvas.addEventListener('mouseup', () => {
    isDragging = false;
    app.canvas.style.cursor = 'grab';
  });
  
  app.canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    app.canvas.style.cursor = 'default';
  });
  
  app.canvas.style.cursor = 'grab';
  
  const panSpeed = 10;
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    switch(e.key) {
      case 'ArrowUp':
        viewport.position.y += panSpeed;
        break;
      case 'ArrowDown':
        viewport.position.y -= panSpeed;
        break;
      case 'ArrowLeft':
        viewport.position.x += panSpeed;
        break;
      case 'ArrowRight':
        viewport.position.x -= panSpeed;
        break;
      case '+':
      case '=':
        viewport.scale.set(
          Math.min(3, viewport.scale.x + 0.1),
          Math.min(3, viewport.scale.y + 0.1)
        );
        break;
      case '-':
      case '_':
        viewport.scale.set(
          Math.max(0.1, viewport.scale.x - 0.1),
          Math.max(0.1, viewport.scale.y - 0.1)
        );
        break;
    }
  });
}