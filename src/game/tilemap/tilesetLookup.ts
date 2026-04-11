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
  selectionTileTransparent: number;
  attackTile: number;
  attackTileTransparent: number;
  spawnTile: number;
  spawnTileTransparent: number;
}

export function resolveMapGids(mapData: TiledMap): MapGids {
  const tree = getTilesetGid(mapData, 'spruceTree')
    || getTilesetGid(mapData, 'tree');
  const transparentTree = getTilesetGid(mapData, 'transparentSpruceTree')
    || getTilesetGid(mapData, 'transparentTree');

  const selectionTile = getTilesetGid(mapData, 'greenSelectionTile')
    || getTilesetGid(mapData, 'selectionBox');
  const selectionTileTransparent = getTilesetGid(mapData, 'transparentGreenSelectionTile');

  const attackTile = getTilesetGid(mapData, 'redSelectionTile')
    || getTilesetGid(mapData, 'attackBox');
  const attackTileTransparent = getTilesetGid(mapData, 'transparentRedSelectionTile');

  const spawnTile = getTilesetGid(mapData, 'blueSelectionTile')
    || getTilesetGid(mapData, 'placementBox');
  const spawnTileTransparent = getTilesetGid(mapData, 'transparentBlueSelectionTile');

  return {
    tree,
    transparentTree,
    selectionTile,
    selectionTileTransparent,
    attackTile,
    attackTileTransparent,
    spawnTile,
    spawnTileTransparent,
  };
}