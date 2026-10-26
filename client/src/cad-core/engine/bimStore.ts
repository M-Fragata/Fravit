import { useSyncExternalStore } from 'react';
import type {
  BIMLevel,
  ToolType,
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
} from '../types';

export interface BIMState {
  levels: BIMLevel[];
  activeLevelId: string;
  activeTool: ToolType;
  activeView: 'plan' | '3d' | 'section' | 'sheet';
  activeSectionId: string | null;
  selectedElementIds: string[];
  snapConfig: SnapConfig;

  // Parâmetros padrão de criação
  defaults: {
    wall: { thickness: number; height: number };
    door: { width: number; height: number };
    window: { width: number; height: number; sillHeight: number };
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

const initialBimState: BIMState = {
  levels: [
    { id: 'lvl-ground', name: 'Nível 1 - Térreo', elevation: 0.0, height: 2.8 },
    { id: 'lvl-upper', name: 'Nível 2 - Superior', elevation: 2.8, height: 2.8 },
    { id: 'lvl-roof', name: 'Cobertura', elevation: 5.6, height: 0.0 },
  ],
  activeLevelId: 'lvl-ground',
  activeTool: 'select',
  activeView: 'plan',
  activeSectionId: null,
  selectedElementIds: [],
  snapConfig: {
    gridSnap: true,
    gridSize: 0.1, // 10 cm
    objectSnap: true,
    snapThresholdPx: 14,
    orthoMode: false,
    polarTracking: true,
  },
  defaults: {
    wall: { thickness: 0.15, height: 2.8 },
    door: { width: 0.8, height: 2.1 },
    window: { width: 1.2, height: 1.0, sillHeight: 1.1 },
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

  setActiveView: (view: 'plan' | '3d' | 'section' | 'sheet') => {
    currentState = { ...currentState, activeView: view };
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

  setWallDefaults: (thickness: number, height: number) => {
    currentState = {
      ...currentState,
      defaults: {
        ...currentState.defaults,
        wall: { thickness, height },
      },
    };
    emitChange();
  },

  setDoorDefaults: (width: number, height: number) => {
    currentState = {
      ...currentState,
      defaults: {
        ...currentState.defaults,
        door: { width, height },
      },
    };
    emitChange();
  },

  setWindowDefaults: (width: number, height: number, sillHeight: number) => {
    currentState = {
      ...currentState,
      defaults: {
        ...currentState.defaults,
        window: { width, height, sillHeight },
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

  // Inverter sentido de abertura da porta (tecla Espaço)
  flipDoor: (doorId: string) => {
    const currentClone = structuredClone(currentState.elements);
    const updatedDoors = currentState.elements.doors.map((d) => {
      if (d.id === doorId) {
        return { ...d, flipFacing: !d.flipFacing };
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
