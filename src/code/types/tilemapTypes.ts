export interface TiledObject {
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  type?: string;
  polygon?: { x: number; y: number }[];
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  orientation: string;
  staggeraxis?: string;
  staggerindex?: string;
}

export interface TiledChunk {
  data: number[];
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface TiledLayer {
  name: string;
  data?: number[];
  chunks?: TiledChunk[];
  objects?: TiledObject[];
  width: number;
  height: number;
  visible: boolean;
  startx?: number;
  starty?: number;
}

export interface TiledTileset {
  firstgid: number;
  source?: string;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  tilewidth?: number;
  tileheight?: number;
  columns?: number;
}