import * as PIXI from 'pixi.js';
import { type TiledMap } from '../types/tilemapTypes';
import { CompositeTilemap } from '@pixi/tilemap';

export async function loadTiledMap(mapPath: string): Promise<{
  tilemap: CompositeTilemap,
  tilesetTextures: Map<number, PIXI.Texture>,
  mapData: TiledMap
}> {
  const mapData: TiledMap = await fetch(mapPath).then(r => r.json());
  const tilesetTextures: Map<number, PIXI.Texture> = new Map();
  
  for (const tileset of mapData.tilesets) {
    // If tileset has image directly (your case)
    if (tileset.image) {
      const texture = await PIXI.Assets.load(`./src/assets/tilesets/${tileset.image}`);
      
      // Calculate tiles in the tileset
      const tilesPerRow = tileset.columns || Math.floor(tileset.imagewidth! / tileset.tilewidth!);
      const totalTiles = Math.floor(tileset.imagewidth! / tileset.tilewidth!) * 
                         Math.floor(tileset.imageheight! / tileset.tileheight!);
      
      // Create texture for each tile
      for (let i = 0; i < totalTiles; i++) {
        const x = (i % tilesPerRow) * tileset.tilewidth!;
        const y = Math.floor(i / tilesPerRow) * tileset.tileheight!;
        
        const tileTexture = new PIXI.Texture({
          source: texture.source,
          frame: new PIXI.Rectangle(x, y, tileset.tilewidth!, tileset.tileheight!)
        });
        
        tilesetTextures.set(tileset.firstgid + i, tileTexture);
      }
    }
  }
  
  // Create the tilemap
  const tilemap = new CompositeTilemap();
  
  // Render each layer
  for (const layer of mapData.layers) {
    if (!layer.visible) continue;
    
    // Handle chunked layers (infinite maps)
    if (layer.chunks) {
      for (const chunk of layer.chunks) {
        for (let i = 0; i < chunk.data.length; i++) {
          const gid = chunk.data[i];
          if (gid === 0) continue; // Empty tile
          
          const texture = tilesetTextures.get(gid);
          if (!texture) continue;
          
          // Local position within chunk
          const localX = i % chunk.width;
          const localY = Math.floor(i / chunk.width);
          
          // Global tile position
          const globalX = chunk.x + localX;
          const globalY = chunk.y + localY;
          
          // Convert to isometric screen position (staggered)
          let isoX: number;
          let isoY: number;
          
          if (mapData.staggeraxis === 'x') {
            // X-axis stagger (your case)
            const staggerOffset = (globalY % 2 === 0) ? 0 : mapData.tilewidth / 2;
            isoX = globalX * mapData.tilewidth + staggerOffset;
            isoY = globalY * (mapData.tileheight / 2);
          } else {
            // Fallback to regular isometric
            isoX = (globalX - globalY) * (mapData.tilewidth / 2);
            isoY = (globalX + globalY) * (mapData.tileheight / 2);
          }
          
          tilemap.tile(texture, isoX, isoY);
        }
      }
    }
    else if (layer.data) {
      for (let i = 0; i < layer.data.length; i++) {
        const gid = layer.data[i];
        if (gid === 0) continue; // Empty tile
        
        const texture = tilesetTextures.get(gid);
        if (!texture) continue;
        
        const x = i % layer.width;
        const y = Math.floor(i / layer.width);
        
        // Convert to isometric screen position (staggered)
        let isoX: number;
        let isoY: number;
        
        if (mapData.staggeraxis === 'y') {
          const staggerOffset = (y % 2 === 0) ? 0 : mapData.tilewidth / 2;
          isoX = x * mapData.tilewidth + staggerOffset;
          isoY = y * (mapData.tileheight / 2);
        } else {
          isoX = (x - y) * (mapData.tilewidth / 2);
          isoY = (x + y) * (mapData.tileheight / 2);
        }
        
        tilemap.tile(texture, isoX, isoY);
      }
    }
  }
  
  return { tilemap, tilesetTextures, mapData };
}

export async function loadOverlayTileset(
  tilesetTextures: Map<number, PIXI.Texture>,
  imagePath: string,
  firstGid: number,
  tileWidth: number,
  tileHeight: number
): Promise<void> {
  const texture = await PIXI.Assets.load(imagePath);
  
  const tilesPerRow = Math.floor(texture.width / tileWidth);
  const tilesPerColumn = Math.floor(texture.height / tileHeight);
  const totalTiles = tilesPerRow * tilesPerColumn;
  
  for (let i = 0; i < totalTiles; i++) {
    const x = (i % tilesPerRow) * tileWidth;
    const y = Math.floor(i / tilesPerRow) * tileHeight;
    
    const tileTexture = new PIXI.Texture({
      source: texture.source,
      frame: new PIXI.Rectangle(x, y, tileWidth, tileHeight)
    });
    
    tilesetTextures.set(firstGid + i, tileTexture);
  }
}