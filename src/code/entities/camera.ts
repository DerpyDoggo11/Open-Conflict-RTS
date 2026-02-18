import * as PIXI from 'pixi.js';

export function setupCamera(app: PIXI.Application, viewport: PIXI.Container) {
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  
  // Mouse wheel zoom
  app.canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const newScale = viewport.scale.x + (direction * zoomFactor);
    
    // Clamp zoom between 0.1 and 3
    const clampedScale = Math.max(0.1, Math.min(3, newScale));
    
    // Get mouse position relative to viewport
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Calculate the point in world space before zoom
    const worldPosBeforeZoom = {
      x: (mouseX - viewport.position.x) / viewport.scale.x,
      y: (mouseY - viewport.position.y) / viewport.scale.y
    };
    
    // Apply new scale
    viewport.scale.set(clampedScale, clampedScale);
    
    // Calculate the point in world space after zoom
    const worldPosAfterZoom = {
      x: (mouseX - viewport.position.x) / viewport.scale.x,
      y: (mouseY - viewport.position.y) / viewport.scale.y
    };
    
    // Adjust position to keep the mouse point stable
    viewport.position.x += (worldPosAfterZoom.x - worldPosBeforeZoom.x) * viewport.scale.x;
    viewport.position.y += (worldPosAfterZoom.y - worldPosBeforeZoom.y) * viewport.scale.y;
  });
  
  // Mouse drag to pan
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
  
  // Set initial cursor
  app.canvas.style.cursor = 'grab';
  
  // Keyboard controls (WASD or Arrow keys)
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