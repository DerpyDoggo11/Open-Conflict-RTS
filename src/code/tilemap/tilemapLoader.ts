import * as PIXI from 'pixi.js';
import { type TiledMap } from '../types/tilemapTypes';
import { CompositeTilemap } from '@pixi/tilemap';

export async function loadTiledMap(mapPath: string): Promise<{tilemaps: Map<string, CompositeTilemap>, tilesetTextures: Map<number, PIXI.Texture>, mapData: TiledMap}> {
  const mapData: TiledMap = await fetch(mapPath).then(r => r.json());
  const tilesetTextures: Map<number, PIXI.Texture> = new Map();

  for (const tileset of mapData.tilesets) {
    if (tileset.image) {
      const texture = await PIXI.Assets.load(`./src/assets/tilesets/${tileset.image}`);
      const tilesPerRow = tileset.columns || Math.floor(tileset.imagewidth! / tileset.tilewidth!);
      const totalTiles = Math.floor(tileset.imagewidth! / tileset.tilewidth!) * Math.floor(tileset.imageheight! / tileset.tileheight!);

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

  // Compute the minimum chunk origin across all chunked layers to normalize coordinates
  // let originX = Infinity, originY = Infinity;
  // for (const layer of mapData.layers) {
  //   if (layer.chunks) {
  //     for (const chunk of layer.chunks) {
  //       originX = Math.min(originX, chunk.x);
  //       originY = Math.min(originY, chunk.y);
  //     }
  //   }
  // }
  // if (!isFinite(originX)) originX = 0;
  // if (!isFinite(originY)) originY = 0;

  const DIAMOND_WIDTH = mapData.tilewidth;
  const DIAMOND_HEIGHT = mapData.tilewidth / 2;

  const tilemaps: Map<string, CompositeTilemap> = new Map();

  for (const layer of mapData.layers) {
    if (!layer.visible) continue;
    const layerTilemap = new CompositeTilemap();
    tilemaps.set(layer.name, layerTilemap);

    if (layer.chunks) {
      for (const chunk of layer.chunks) {
        for (let i = 0; i < chunk.data.length; i++) {
          const gid = chunk.data[i];
          if (gid === 0) continue;
          const texture = tilesetTextures.get(gid);
          if (!texture) continue;

          const localX = i % chunk.width;
          const localY = Math.floor(i / chunk.width);
          const globalX = (chunk.x + localX) //- originX;
          const globalY = (chunk.y + localY) //- originY;

          const isoX = (globalX - globalY) * (DIAMOND_WIDTH / 2);
          const isoY = (globalX + globalY) * (DIAMOND_HEIGHT / 2);

          const tileH = texture.height;
          layerTilemap.tile(texture, isoX, isoY - (tileH - DIAMOND_HEIGHT));
        }
      }
    } else if (layer.data) {
      for (let i = 0; i < layer.data.length; i++) {
        const gid = layer.data[i];
        if (gid === 0) continue;
        const texture = tilesetTextures.get(gid);
        if (!texture) continue;

        const x = i % layer.width;
        const y = Math.floor(i / layer.width);

        const isoX = (x - y) * (DIAMOND_WIDTH / 2);
        const isoY = (x + y) * (DIAMOND_HEIGHT / 2);

        const tileH = texture.height;
        layerTilemap.tile(texture, isoX, isoY - (tileH - DIAMOND_HEIGHT));
      }
    }
  }

  return { tilemaps, tilesetTextures, mapData };
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