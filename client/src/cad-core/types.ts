export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type SnapType =
  | 'endpoint'
  | 'midpoint'
  | 'intersection'
  | 'grid'
  | 'perpendicular'
  | 'wall_center'
  | 'wall_ext'
  | 'wall_int';

export interface SnapResult {
  point: Point2D;
  type: SnapType;
  sourceElementId?: string;
  polarAngle?: number;
  guideLines?: { start: Point2D; end: Point2D; isPolar?: boolean }[];
  label?: string;
}

export interface SnapConfig {
  gridSnap: boolean;
  gridSize: number; // em metros (ex: 0.10m = 10cm)
  objectSnap: boolean;
  snapThresholdPx: number; // raio de captura do mouse em pixels
  orthoMode: boolean; // trava 0°, 90°, 180°, 270°
  polarTracking: boolean; // guias em 45°
}

export type ToolType =
  | 'select'
  | 'wall'
  | 'door'
  | 'window'
  | 'floor'
  | 'roof'
  | 'stair'
  | 'room'
  | 'roomSeparator'
  | 'dimension'
  | 'section';

export interface WallElement {
  id: string;
  type: 'wall';
  start: Point2D;
  end: Point2D;
  thickness: number; // em metros (ex: 0.15)
  height: number; // em metros (ex: 2.80)
  levelId: string;
  material?: string;
}

export interface DoorElement {
  id: string;
  type: 'door';
  wallId: string;
  offsetRatio: number; // 0.0 a 1.0 ao longo da parede hospedeira
  width: number; // em metros (ex: 0.80)
  height: number; // em metros (ex: 2.10)
  flipFacing: boolean; // inverte lado de abertura
  flipHand: boolean; // inverte mão esquerda/direita
  levelId: string;
}

export interface WindowElement {
  id: string;
  type: 'window';
  wallId: string;
  offsetRatio: number;
  width: number; // ex: 1.20
  height: number; // ex: 1.00
  sillHeight: number; // peitoril ex: 1.10
  levelId: string;
}

export interface FloorElement {
  id: string;
  type: 'floor';
  polygon: Point2D[];
  thickness: number; // ex: 0.10
  elevationOffset: number; // ex: 0.00 ou -0.05
  levelId: string;
}

export interface RoofElement {
  id: string;
  type: 'roof';
  polygon: Point2D[];
  pitch: number; // inclinação em % ou graus
  overhang: number; // beiral ex: 0.60
  levelId: string;
}

export interface StairElement {
  id: string;
  type: 'stair';
  start: Point2D;
  end: Point2D;
  width: number; // ex: 0.90
  riserHeight: number; // espelho ex: 0.175
  treadDepth: number; // piso ex: 0.28
  stepsCount: number;
  levelId: string;
}

export interface RoomElement {
  id: string;
  type: 'room';
  name: string;
  polygon: Point2D[];
  areaM2: number;
  levelId: string;
}

export interface RoomSeparatorElement {
  id: string;
  type: 'roomSeparator';
  start: Point2D;
  end: Point2D;
  levelId: string;
}

export interface DimensionElement {
  id: string;
  type: 'dimension';
  start: Point2D;
  end: Point2D;
  offset: number;
  levelId: string;
  view?: 'plan' | 'section';
  sectionId?: string;
}

export interface SectionElement {
  id: string;
  type: 'section';
  start: Point2D;
  end: Point2D;
  name: string;
  farClipDepth: number; // profundidade do corte em metros
  direction?: 1 | -1; // 1 = +normal, -1 = -normal
  levelId: string;
}

export type BIMElement =
  | WallElement
  | DoorElement
  | WindowElement
  | FloorElement
  | RoofElement
  | StairElement
  | RoomElement
  | RoomSeparatorElement
  | DimensionElement
  | SectionElement;

export interface BIMLevel {
  id: string;
  name: string;
  elevation: number;
  height: number;
}

export type SheetSize = 'A1' | 'A2' | 'A3' | 'A4';
export type SheetOrientation = 'landscape' | 'portrait';
export type ViewportScale = '1:25' | '1:50' | '1:100' | '1:200';
export type ViewportType = 'plan' | 'section' | '3d';

export interface SheetViewport {
  id: string;
  type: ViewportType;
  targetId?: string; // id do level ou id da section
  name: string;
  scale: ViewportScale;
  x: number; // posição X na prancha em mm
  y: number; // posição Y na prancha em mm
  width: number; // largura da viewport em mm
  height: number; // altura da viewport em mm
}

export interface SheetStamp {
  projectTitle: string;
  clientName: string;
  authorName: string;
  sheetNumber: string; // ex: "01/01" ou "A101"
  sheetTitle: string; // ex: "PLANTAS, CORTES E QUADROS"
  date: string;
  scale: string; // ex: "INDICADA"
}

export interface Sheet {
  id: string;
  name: string;
  size: SheetSize;
  orientation: SheetOrientation;
  stamp: SheetStamp;
  viewports: SheetViewport[];
  showSchedules: boolean;
  schedulePosition?: { x: number; y: number };
}

