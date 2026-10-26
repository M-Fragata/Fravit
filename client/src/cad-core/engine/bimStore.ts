import { useSyncExternalStore } from 'react';
import type {
  BIMLevel,
  ToolType,
  DrawMode,
  WallTypeItem,
  DoorTypeItem,
  WindowTypeItem,
  FloorTypeItem,
  RoofTypeItem,
  StairTypeItem,
  WallElement,
  DoorElement,
  WindowElement,
  FloorElement,
  RoofElement,
  StairElement,
  RoomElement,
  RoomSeparatorElement,
  DimensionElement,
  SectionElement,
  SnapConfig,
  Sheet,
  SheetViewport,
} from '../types';

export interface BIMState {
  levels: BIMLevel[];
  activeLevelId: string;
  activeTool: ToolType;
  drawMode: DrawMode;
  activeView: 'plan' | '3d' | 'section' | 'sheet';
  activeSectionId: string | null;
  activeSheetId: string;
  sheets: Sheet[];
  selectedElementIds: string[];
  snapConfig: SnapConfig;

  // Catálogo de Famílias / Tipos no Padrão Revit
  wallTypes: WallTypeItem[];
  doorTypes: DoorTypeItem[];
  windowTypes: WindowTypeItem[];
  floorTypes: FloorTypeItem[];
  roofTypes: RoofTypeItem[];
  stairTypes: StairTypeItem[];

  // Parâmetros padrão de criação
  defaults: {
    wall: { thickness: number; height: number; typeId?: string };
    door: { width: number; height: number; typeId?: string };
    window: { width: number; height: number; sillHeight: number; typeId?: string };
    floor: { thickness: number; typeId?: string };
    roof: { pitch: number; overhang: number; typeId?: string };
  };

  elements: {
    walls: WallElement[];
    doors: DoorElement[];
    windows: WindowElement[];
    floors: FloorElement[];
    roofs: RoofElement[];
    stairs: StairElement[];
    rooms: RoomElement[];
    roomSeparators: RoomSeparatorElement[];
    dimensions: DimensionElement[];
    sections: SectionElement[];
  };

  history: {
    past: Array<BIMState['elements']>;
    future: Array<BIMState['elements']>;
  };
}

const initialWallTypes: WallTypeItem[] = [
  { id: 'wt-15-comum', name: 'Alvenaria Cerâmica 15cm (Padrão)', thickness: 0.15, height: 2.8, material: 'Tijolo Cerâmico com Emboço' },
  { id: 'wt-20-externa', name: 'Alvenaria Externa 20cm', thickness: 0.20, height: 2.8, material: 'Alvenaria com Reboco 20cm' },
  { id: 'wt-10-drywall', name: 'Divisória Drywall 10cm', thickness: 0.10, height: 2.8, material: 'Gesso Acartonado / Lã de Vidro' },
  { id: 'wt-15-concreto', name: 'Parede Concreto Armado 15cm', thickness: 0.15, height: 2.8, material: 'Concreto Estrutural' },
  { id: 'wt-19-bloco', name: 'Alvenaria Estrutural Bloco 19cm', thickness: 0.19, height: 2.8, material: 'Bloco de Concreto Estrutural' },
];

const initialDoorTypes: DoorTypeItem[] = [
  { id: 'dt-p60', name: 'Porta de Giro - P60 (0.60 x 2.10m)', width: 0.60, height: 2.10, category: 'Giro', frameThickness: 0.05, material: 'Madeira Lisa Envernizada' },
  { id: 'dt-p70', name: 'Porta de Giro - P70 (0.70 x 2.10m)', width: 0.70, height: 2.10, category: 'Giro', frameThickness: 0.05, material: 'Madeira Lisa Esmaltada' },
  { id: 'dt-p80', name: 'Porta de Giro - P80 (0.80 x 2.10m)', width: 0.80, height: 2.10, category: 'Giro', frameThickness: 0.05, material: 'Madeira Semisólida' },
  { id: 'dt-p90', name: 'Porta de Giro - P90 (0.90 x 2.10m)', width: 0.90, height: 2.10, category: 'Giro', frameThickness: 0.05, material: 'Madeira Maciça / Entrada' },
  { id: 'dt-p100', name: 'Porta de Giro - P100 (1.00 x 2.10m)', width: 1.00, height: 2.10, category: 'Giro', frameThickness: 0.05, material: 'Madeira Maciça Acessibilidade NBR 9050' },
  { id: 'dt-correr-160', name: 'Porta de Correr 2 Folhas (1.60 x 2.10m)', width: 1.60, height: 2.10, category: 'Correr', frameThickness: 0.05, material: 'Alumínio e Vidro Temperado' },
  { id: 'dt-pivot-110', name: 'Porta Pivotante - P110 (1.10 x 2.40m)', width: 1.10, height: 2.40, category: 'Pivotante', frameThickness: 0.08, material: 'Madeira Nobre Pivotante' },
];

const initialWindowTypes: WindowTypeItem[] = [
  { id: 'wt-j100', name: 'Janela de Correr - J100 (1.00 x 1.00m • Peit 1.10m)', width: 1.00, height: 1.00, sillHeight: 1.10, material: 'Alumínio Preto / Vidro 6mm' },
  { id: 'wt-j120', name: 'Janela de Correr - J120 (1.20 x 1.00m • Peit 1.10m)', width: 1.20, height: 1.00, sillHeight: 1.10, material: 'Alumínio Branco / Vidro 6mm' },
  { id: 'wt-j150', name: 'Janela de Correr - J150 (1.50 x 1.20m • Peit 1.00m)', width: 1.50, height: 1.20, sillHeight: 1.00, material: 'Alumínio Anodizado / Vidro 8mm' },
  { id: 'wt-j060-max', name: 'Janela Maxim-ar - J060 (0.60 x 0.60m • Peit 1.60m - Banheiro)', width: 0.60, height: 0.60, sillHeight: 1.60, material: 'Alumínio com Vidro Mini-boreal' },
  { id: 'wt-j200-pan', name: 'Janela Panorâmica - J200 (2.00 x 1.50m • Peit 0.80m)', width: 2.00, height: 1.50, sillHeight: 0.80, material: 'Pele de Vidro / Alumínio' },
];

const initialFloorTypes: FloorTypeItem[] = [
  { id: 'ft-cer-10', name: 'Piso Cerâmico Interno - 10cm', thickness: 0.10, material: 'Porcelanato Polido + Argamassa' },
  { id: 'ft-laje-15', name: 'Laje Concreto Armado - 15cm (Padrão)', thickness: 0.15, material: 'Concreto FCK 25MPa' },
  { id: 'ft-vinil-8', name: 'Piso Vinílico / Laminado - 8cm', thickness: 0.08, material: 'Vinílico Amadeirado' },
  { id: 'ft-deck-12', name: 'Deck de Madeira Externo - 12cm', thickness: 0.12, material: 'Cumaru / Ipê Tratado' },
  { id: 'ft-ind-20', name: 'Radier / Piso Industrial - 20cm', thickness: 0.20, material: 'Concreto Polido Alta Resistência' },
];

const initialRoofTypes: RoofTypeItem[] = [
  { id: 'rt-cer-30', name: 'Telhado Cerâmico Colonial (Inclinação 30% • Beiral 0.60m)', pitch: 30, overhang: 0.60, material: 'Telha Cerâmica Vermelha' },
  { id: 'rt-met-10', name: 'Telhado Fibrocimento / Metálico (Inclinação 10% • Beiral 0.50m)', pitch: 10, overhang: 0.50, material: 'Telha Aluzinco Trapezoidal' },
  { id: 'rt-sand-5', name: 'Telha Termoacústica Sandwich (Inclinação 5% • Beiral 0.30m)', pitch: 5, overhang: 0.30, material: 'Telha Sandwich EPS' },
  { id: 'rt-laje-2', name: 'Laje Plana Impermeabilizada (Inclinação 2% • Beiral 0.00m)', pitch: 2, overhang: 0.00, material: 'Manta Asfáltica + Argamassa de Proteção' },
];

const initialStairTypes: StairTypeItem[] = [
  { id: 'st-conc', name: 'Escada Moldada em Concreto (Piso 28cm • Espelho 17.5cm)', width: 0.90, riserHeight: 0.175, treadDepth: 0.28, material: 'Concreto com Revestimento Granito' },
  { id: 'st-met', name: 'Escada Metálica Industrial (Piso 26cm • Espelho 18cm)', width: 0.80, riserHeight: 0.18, treadDepth: 0.26, material: 'Aço Estrutural com Chapa Xadrez' },
  { id: 'st-mad', name: 'Escada de Madeira Nobre (Piso 30cm • Espelho 17cm)', width: 1.00, riserHeight: 0.17, treadDepth: 0.30, material: 'Madeira Maciça Ipê' },
];

const initialBimState: BIMState = {
  levels: [
    { id: 'lvl-ground', name: 'Nível 1 - Térreo', elevation: 0.0, height: 2.8 },
    { id: 'lvl-upper', name: 'Nível 2 - Superior', elevation: 2.8, height: 2.8 },
    { id: 'lvl-roof', name: 'Cobertura', elevation: 5.6, height: 0.0 },
  ],
  activeLevelId: 'lvl-ground',
  activeTool: 'select',
  drawMode: 'line',
  activeView: 'plan',
  activeSectionId: null,
  activeSheetId: 'sheet-1',
  sheets: [
    {
      id: 'sheet-1',
      name: 'A101 - Folha Principal',
      size: 'A1',
      orientation: 'landscape',
      stamp: {
        projectTitle: 'PROJETO ARQUITETÔNICO RESIDENCIAL',
        clientName: 'CLIENTE',
        authorName: 'FRAVIT CAD/BIM',
        sheetNumber: '01/01',
        sheetTitle: 'PLANTAS, CORTES E QUADROS',
        date: '26/10/2026',
        scale: 'INDICADA',
      },
      viewports: [
        {
          id: 'vp-plan-1',
          type: 'plan',
          targetId: 'lvl-ground',
          name: '01 - PLANTA BAIXA TÉRREO',
          scale: '1:50',
          x: 45,
          y: 45,
          width: 380,
          height: 260,
        },
      ],
      showSchedules: true,
      schedulePosition: { x: 460, y: 45 },
    },
  ],
  selectedElementIds: [],
  snapConfig: {
    gridSnap: true,
    gridSize: 0.1, // 10 cm
    objectSnap: true,
    snapThresholdPx: 14,
    orthoMode: false,
    polarTracking: true,
  },
  wallTypes: initialWallTypes,
  doorTypes: initialDoorTypes,
  windowTypes: initialWindowTypes,
  floorTypes: initialFloorTypes,
  roofTypes: initialRoofTypes,
  stairTypes: initialStairTypes,
  defaults: {
    wall: { thickness: 0.15, height: 2.8, typeId: 'wt-15-comum' },
    door: { width: 0.8, height: 2.1, typeId: 'dt-p80' },
    window: { width: 1.2, height: 1.0, sillHeight: 1.1, typeId: 'wt-j120' },
    floor: { thickness: 0.15, typeId: 'ft-laje-15' },
    roof: { pitch: 10, overhang: 0.6, typeId: 'rt-met-10' },
  },
  elements: {
    walls: [
      // Parede exemplo inicial para testar renderização 2D/3D e snaps
      { id: 'wall-init-1', type: 'wall', start: { x: -4, y: -2.5 }, end: { x: 4, y: -2.5 }, thickness: 0.15, height: 2.8, levelId: 'lvl-ground' },
      { id: 'wall-init-2', type: 'wall', start: { x: 4, y: -2.5 }, end: { x: 4, y: 2.5 }, thickness: 0.15, height: 2.8, levelId: 'lvl-ground' },
      { id: 'wall-init-3', type: 'wall', start: { x: 4, y: 2.5 }, end: { x: -4, y: 2.5 }, thickness: 0.15, height: 2.8, levelId: 'lvl-ground' },
      { id: 'wall-init-4', type: 'wall', start: { x: -4, y: 2.5 }, end: { x: -4, y: -2.5 }, thickness: 0.15, height: 2.8, levelId: 'lvl-ground' },
    ],
    doors: [],
    windows: [],
    floors: [],
    roofs: [],
    stairs: [],
    rooms: [],
    roomSeparators: [],
    dimensions: [],
    sections: [],
  },
  history: {
    past: [],
    future: [],
  },
};

// Store observável simples e veloz
let currentState: BIMState = initialBimState;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const bimStore = {
  getState: () => currentState,

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setActiveTool: (tool: ToolType) => {
    currentState = { ...currentState, activeTool: tool };
    emitChange();
  },

  setDrawMode: (mode: DrawMode) => {
    currentState = { ...currentState, drawMode: mode };
    emitChange();
  },

  setSelectedElementIds: (ids: string[]) => {
    currentState = { ...currentState, selectedElementIds: ids };
    emitChange();
  },

  clearSelection: () => {
    currentState = { ...currentState, selectedElementIds: [] };
    emitChange();
  },

  setActiveView: (view: 'plan' | '3d' | 'section' | 'sheet') => {
    currentState = { ...currentState, activeView: view };
    emitChange();
  },

  setActiveSheetId: (sheetId: string) => {
    currentState = { ...currentState, activeSheetId: sheetId };
    emitChange();
  },

  addSheet: (sheet: Sheet) => {
    currentState = {
      ...currentState,
      sheets: [...currentState.sheets, sheet],
      activeSheetId: sheet.id,
    };
    emitChange();
  },

  updateSheet: (sheetId: string, patch: Partial<Sheet>) => {
    currentState = {
      ...currentState,
      sheets: currentState.sheets.map((s) => (s.id === sheetId ? { ...s, ...patch } : s)),
    };
    emitChange();
  },

  removeSheet: (sheetId: string) => {
    if (currentState.sheets.length <= 1) return;
    const newSheets = currentState.sheets.filter((s) => s.id !== sheetId);
    currentState = {
      ...currentState,
      sheets: newSheets,
      activeSheetId: newSheets[0].id,
    };
    emitChange();
  },

  addViewportToSheet: (sheetId: string, viewport: SheetViewport) => {
    currentState = {
      ...currentState,
      sheets: currentState.sheets.map((s) =>
        s.id === sheetId ? { ...s, viewports: [...s.viewports, viewport] } : s
      ),
    };
    emitChange();
  },

  updateViewport: (sheetId: string, viewportId: string, patch: Partial<SheetViewport>) => {
    currentState = {
      ...currentState,
      sheets: currentState.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              viewports: s.viewports.map((v) => (v.id === viewportId ? { ...v, ...patch } : v)),
            }
          : s
      ),
    };
    emitChange();
  },

  removeViewport: (sheetId: string, viewportId: string) => {
    currentState = {
      ...currentState,
      sheets: currentState.sheets.map((s) =>
        s.id === sheetId
          ? { ...s, viewports: s.viewports.filter((v) => v.id !== viewportId) }
          : s
      ),
    };
    emitChange();
  },

  setActiveLevelId: (levelId: string) => {
    currentState = { ...currentState, activeLevelId: levelId };
    emitChange();
  },

  toggleOrtho: () => {
    currentState = {
      ...currentState,
      snapConfig: {
        ...currentState.snapConfig,
        orthoMode: !currentState.snapConfig.orthoMode,
      },
    };
    emitChange();
  },

  toggleGridSnap: () => {
    currentState = {
      ...currentState,
      snapConfig: {
        ...currentState.snapConfig,
        gridSnap: !currentState.snapConfig.gridSnap,
      },
    };
    emitChange();
  },

  toggleObjectSnap: () => {
    currentState = {
      ...currentState,
      snapConfig: {
        ...currentState.snapConfig,
        objectSnap: !currentState.snapConfig.objectSnap,
      },
    };
    emitChange();
  },

  togglePolar: () => {
    currentState = {
      ...currentState,
      snapConfig: {
        ...currentState.snapConfig,
        polarTracking: !currentState.snapConfig.polarTracking,
      },
    };
    emitChange();
  },

  setWallDefaults: (thickness: number, height: number, typeId?: string) => {
    currentState = {
      ...currentState,
      defaults: {
        ...currentState.defaults,
        wall: { thickness, height, typeId: typeId || currentState.defaults.wall.typeId },
      },
    };
    emitChange();
  },

  setDoorDefaults: (width: number, height: number, typeId?: string) => {
    currentState = {
      ...currentState,
      defaults: {
        ...currentState.defaults,
        door: { width, height, typeId: typeId || currentState.defaults.door.typeId },
      },
    };
    emitChange();
  },

  setWindowDefaults: (width: number, height: number, sillHeight: number, typeId?: string) => {
    currentState = {
      ...currentState,
      defaults: {
        ...currentState.defaults,
        window: { width, height, sillHeight, typeId: typeId || currentState.defaults.window.typeId },
      },
    };
    emitChange();
  },

  setFloorDefaults: (thickness: number, typeId?: string) => {
    currentState = {
      ...currentState,
      defaults: {
        ...currentState.defaults,
        floor: { thickness, typeId: typeId || currentState.defaults.floor.typeId },
      },
    };
    emitChange();
  },

  setRoofDefaults: (pitch: number, overhang: number, typeId?: string) => {
    currentState = {
      ...currentState,
      defaults: {
        ...currentState.defaults,
        roof: { pitch, overhang, typeId: typeId || currentState.defaults.roof.typeId },
      },
    };
    emitChange();
  },

  addWallType: (type: WallTypeItem) => {
    currentState = {
      ...currentState,
      wallTypes: [...currentState.wallTypes, type],
    };
    emitChange();
  },

  addDoorType: (type: DoorTypeItem) => {
    currentState = {
      ...currentState,
      doorTypes: [...currentState.doorTypes, type],
    };
    emitChange();
  },

  addWindowType: (type: WindowTypeItem) => {
    currentState = {
      ...currentState,
      windowTypes: [...currentState.windowTypes, type],
    };
    emitChange();
  },

  addFloorType: (type: FloorTypeItem) => {
    currentState = {
      ...currentState,
      floorTypes: [...currentState.floorTypes, type],
    };
    emitChange();
  },

  addRoofType: (type: RoofTypeItem) => {
    currentState = {
      ...currentState,
      roofTypes: [...currentState.roofTypes, type],
    };
    emitChange();
  },

  addStairType: (type: StairTypeItem) => {
    currentState = {
      ...currentState,
      stairTypes: [...currentState.stairTypes, type],
    };
    emitChange();
  },

  // Atualizar propriedades de qualquer elemento existente
  updateElement: (id: string, elementType: string, patch: any) => {
    const currentClone = structuredClone(currentState.elements);
    let updated = false;

    const mapList = <T extends { id: string }>(list: T[]): T[] =>
      list.map((item) => {
        if (item.id === id) {
          updated = true;
          return { ...item, ...patch };
        }
        return item;
      });

    const newElements = {
      walls: elementType === 'wall' ? mapList(currentState.elements.walls) : currentState.elements.walls,
      doors: elementType === 'door' ? mapList(currentState.elements.doors) : currentState.elements.doors,
      windows: elementType === 'window' ? mapList(currentState.elements.windows) : currentState.elements.windows,
      floors: elementType === 'floor' ? mapList(currentState.elements.floors) : currentState.elements.floors,
      roofs: elementType === 'roof' ? mapList(currentState.elements.roofs) : currentState.elements.roofs,
      stairs: elementType === 'stair' ? mapList(currentState.elements.stairs) : currentState.elements.stairs,
      rooms: elementType === 'room' ? mapList(currentState.elements.rooms) : currentState.elements.rooms,
      roomSeparators: elementType === 'roomSeparator' ? mapList(currentState.elements.roomSeparators) : currentState.elements.roomSeparators,
      dimensions: elementType === 'dimension' ? mapList(currentState.elements.dimensions) : currentState.elements.dimensions,
      sections: elementType === 'section' ? mapList(currentState.elements.sections) : currentState.elements.sections,
    };

    if (updated) {
      currentState = {
        ...currentState,
        elements: newElements,
        history: {
          past: [...currentState.history.past, currentClone],
          future: [],
        },
      };
      emitChange();
    }
  },

  // Remover elemento pelo ID com histórico de desfazer
  removeElement: (id: string) => {
    const currentClone = structuredClone(currentState.elements);
    const filterList = <T extends { id: string }>(list: T[]): T[] => list.filter((item) => item.id !== id);

    currentState = {
      ...currentState,
      selectedElementIds: currentState.selectedElementIds.filter((selId) => selId !== id),
      elements: {
        walls: filterList(currentState.elements.walls),
        doors: filterList(currentState.elements.doors),
        windows: filterList(currentState.elements.windows),
        floors: filterList(currentState.elements.floors),
        roofs: filterList(currentState.elements.roofs),
        stairs: filterList(currentState.elements.stairs),
        rooms: filterList(currentState.elements.rooms),
        roomSeparators: filterList(currentState.elements.roomSeparators),
        dimensions: filterList(currentState.elements.dimensions),
        sections: filterList(currentState.elements.sections),
      },
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  // Adição de Parede com Histórico (Undo)
  addWall: (wall: WallElement) => {
    const currentClone = structuredClone(currentState.elements);
    const newElements = {
      ...currentState.elements,
      walls: [...currentState.elements.walls, wall],
    };
    currentState = {
      ...currentState,
      elements: newElements,
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  // Adição de Porta (ancorada em parede hospedeira)
  addDoor: (door: DoorElement) => {
    const currentClone = structuredClone(currentState.elements);
    const newElements = {
      ...currentState.elements,
      doors: [...currentState.elements.doors, door],
    };
    currentState = {
      ...currentState,
      elements: newElements,
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  // Inverter sentido de abertura da porta (tecla Espaço - Ciclo de 4 opções: lado e abertura)
  flipDoor: (doorId: string) => {
    const currentClone = structuredClone(currentState.elements);
    const updatedDoors = currentState.elements.doors.map((d) => {
      if (d.id === doorId) {
        let nextFacing = d.flipFacing;
        let nextHand = d.flipHand ?? false;
        if (!nextFacing && !nextHand) {
          nextHand = true;
        } else if (!nextFacing && nextHand) {
          nextFacing = true;
          nextHand = false;
        } else if (nextFacing && !nextHand) {
          nextHand = true;
        } else {
          nextFacing = false;
          nextHand = false;
        }
        return { ...d, flipFacing: nextFacing, flipHand: nextHand };
      }
      return d;
    });
    currentState = {
      ...currentState,
      elements: { ...currentState.elements, doors: updatedDoors },
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  // Adição de Janela
  addWindow: (win: WindowElement) => {
    const currentClone = structuredClone(currentState.elements);
    const newElements = {
      ...currentState.elements,
      windows: [...currentState.elements.windows, win],
    };
    currentState = {
      ...currentState,
      elements: newElements,
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  // Adição de Piso / Laje
  addFloor: (floor: FloorElement) => {
    const currentClone = structuredClone(currentState.elements);
    const newElements = {
      ...currentState.elements,
      floors: [...currentState.elements.floors, floor],
    };
    currentState = {
      ...currentState,
      elements: newElements,
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  // Adição de Telhado
  addRoof: (roof: RoofElement) => {
    const currentClone = structuredClone(currentState.elements);
    const newElements = {
      ...currentState.elements,
      roofs: [...currentState.elements.roofs, roof],
    };
    currentState = {
      ...currentState,
      elements: newElements,
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  // Adição de Escada
  addStair: (stair: StairElement) => {
    const currentClone = structuredClone(currentState.elements);
    const newElements = {
      ...currentState.elements,
      stairs: [...currentState.elements.stairs, stair],
    };
    currentState = {
      ...currentState,
      elements: newElements,
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  // Adição de Ambiente com m²
  addRoom: (room: RoomElement) => {
    const currentClone = structuredClone(currentState.elements);
    const newElements = {
      ...currentState.elements,
      rooms: [...currentState.elements.rooms, room],
    };
    currentState = {
      ...currentState,
      elements: newElements,
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  // Adição de Linha Separadora de Ambiente
  addRoomSeparator: (separator: RoomSeparatorElement) => {
    const currentClone = structuredClone(currentState.elements);
    const newElements = {
      ...currentState.elements,
      roomSeparators: [...currentState.elements.roomSeparators, separator],
    };
    currentState = {
      ...currentState,
      elements: newElements,
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  // Adição de Cota Alinhada (Dimension)
  addDimension: (dim: DimensionElement) => {
    const currentClone = structuredClone(currentState.elements);
    const newElements = {
      ...currentState.elements,
      dimensions: [...currentState.elements.dimensions, dim],
    };
    currentState = {
      ...currentState,
      elements: newElements,
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  // Adição de Linha de Corte (Section)
  addSection: (sec: SectionElement) => {
    const currentClone = structuredClone(currentState.elements);
    const newElements = {
      ...currentState.elements,
      sections: [...currentState.elements.sections, sec],
    };
    currentState = {
      ...currentState,
      elements: newElements,
      activeSectionId: sec.id,
      history: {
        past: [...currentState.history.past, currentClone],
        future: [],
      },
    };
    emitChange();
  },

  setActiveSectionId: (id: string | null) => {
    currentState = {
      ...currentState,
      activeSectionId: id,
    };
    emitChange();
  },

  // Gerenciamento de Níveis / Andares
  addLevel: (name: string, elevation: number, height: number = 2.8) => {
    const newLevel: BIMLevel = {
      id: `lvl-${Date.now()}`,
      name,
      elevation,
      height,
    };
    // Ordena os níveis por elevação crescente
    const nextLevels = [...currentState.levels, newLevel].sort((a, b) => a.elevation - b.elevation);
    currentState = {
      ...currentState,
      levels: nextLevels,
      activeLevelId: newLevel.id,
    };
    emitChange();
  },

  updateLevel: (levelId: string, updates: Partial<BIMLevel>) => {
    const nextLevels = currentState.levels
      .map((lvl) => (lvl.id === levelId ? { ...lvl, ...updates } : lvl))
      .sort((a, b) => a.elevation - b.elevation);

    // Se o pé-direito (height) foi alterado, atualiza também as paredes desse nível
    let updatedWalls = currentState.elements.walls;
    if (updates.height !== undefined) {
      const h = updates.height;
      updatedWalls = updatedWalls.map((w) =>
        w.levelId === levelId ? { ...w, height: h } : w
      );
    }

    currentState = {
      ...currentState,
      levels: nextLevels,
      elements: {
        ...currentState.elements,
        walls: updatedWalls,
      },
    };
    emitChange();
  },

  removeLevel: (levelId: string) => {
    if (currentState.levels.length <= 1) {
      return;
    }
    const nextLevels = currentState.levels.filter((lvl) => lvl.id !== levelId);
    const fallbackLevelId = nextLevels[0].id;
    const reassign = <T extends { levelId: string }>(items: T[]): T[] =>
      items.map((item) => (item.levelId === levelId ? { ...item, levelId: fallbackLevelId } : item));

    currentState = {
      ...currentState,
      levels: nextLevels,
      activeLevelId: currentState.activeLevelId === levelId ? fallbackLevelId : currentState.activeLevelId,
      elements: {
        ...currentState.elements,
        walls: reassign(currentState.elements.walls),
        doors: reassign(currentState.elements.doors),
        windows: reassign(currentState.elements.windows),
        floors: reassign(currentState.elements.floors),
        roofs: reassign(currentState.elements.roofs),
        stairs: reassign(currentState.elements.stairs),
        rooms: reassign(currentState.elements.rooms),
        roomSeparators: reassign(currentState.elements.roomSeparators),
        dimensions: reassign(currentState.elements.dimensions),
        sections: reassign(currentState.elements.sections),
      },
    };
    emitChange();
  },

  // Desfazer (Ctrl+Z)
  undo: () => {
    const { past, future } = currentState.history;
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    const currentClone = structuredClone(currentState.elements);

    currentState = {
      ...currentState,
      elements: previous,
      history: {
        past: newPast,
        future: [currentClone, ...future],
      },
    };
    emitChange();
  },

  // Refazer (Ctrl+Y / Ctrl+Shift+Z)
  redo: () => {
    const { past, future } = currentState.history;
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);
    const currentClone = structuredClone(currentState.elements);

    currentState = {
      ...currentState,
      elements: next,
      history: {
        past: [...past, currentClone],
        future: newFuture,
      },
    };
    emitChange();
  },

  // Carregar dados de um projeto aberto
  loadProjectData: (bimData: any) => {
    if (!bimData) return;
    currentState = {
      ...currentState,
      levels: bimData.levels || currentState.levels,
      activeLevelId: bimData.activeLevelId || currentState.activeLevelId,
      activeSheetId: bimData.activeSheetId || (bimData.sheets?.[0]?.id ?? currentState.activeSheetId),
      sheets: bimData.sheets || currentState.sheets,
      elements: {
        walls: bimData.elements?.walls || [],
        doors: bimData.elements?.doors || [],
        windows: bimData.elements?.windows || [],
        floors: bimData.elements?.floors || [],
        roofs: bimData.elements?.roofs || [],
        stairs: bimData.elements?.stairs || [],
        rooms: bimData.elements?.rooms || [],
        roomSeparators: bimData.elements?.roomSeparators || [],
        dimensions: bimData.elements?.dimensions || [],
        sections: bimData.elements?.sections || [],
      },
      history: { past: [], future: [] },
    };
    emitChange();
  },
};

// Hook React para sincronização instantânea
export function useBIM() {
  return useSyncExternalStore(bimStore.subscribe, bimStore.getState);
}
