import { type TiledMap } from '../types/tilemapTypes';

export function getTilesetGid(mapData: TiledMap, name: string): number {
  for (const tileset of mapData.tilesets) {
    if (tileset.name === name) return tileset.firstgid;
  }
  return 0;
}

export interface MapGids {
  tree: number;
  transparentTree: number;
  selectionTile: number;
  attackTile: number;
  spawnTile: number;
}

export function resolveMapGids(mapData: TiledMap): MapGids {
  const tree = getTilesetGid(mapData, 'spruceTree')
    || getTilesetGid(mapData, 'tree');
  const transparentTree = getTilesetGid(mapData, 'transparentSpruceTree')
    || getTilesetGid(mapData, 'transparentTree');

  const selectionTile = getTilesetGid(mapData, 'greenSelectionTile')
    || getTilesetGid(mapData, 'selectionBox');

  const attackTile = getTilesetGid(mapData, 'redSelectionTile')
    || getTilesetGid(mapData, 'attackBox');

  const spawnTile = getTilesetGid(mapData, 'blueSelectionTile')
    || getTilesetGid(mapData, 'placementBox');

  return {
    tree,
    transparentTree,
    selectionTile,
    attackTile,
    spawnTile,
  };
}