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

  // Adição de Parede com Histórico (Undo)
  addWall: (wall: WallElement) => {
    const nextWalls = [...currentState.elements.walls, wall];
    const newElements = {
      ...currentState.elements,
      walls: nextWalls,
    };

    currentState = {
      ...currentState,
      elements: newElements,
      history: {
        past: [...currentState.history.past, currentState.elements],
        future: [],
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

    currentState = {
      ...currentState,
      elements: previous,
      history: {
        past: newPast,
        future: [currentState.elements, ...future],
      },
    };
    emitChange();
  },

  // Refazer (Ctrl+Y / Ctrl+Shift+Z)
  redo: () => {
    const { future } = currentState.history;
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);

    currentState = {
      ...currentState,
      elements: next,
      history: {
        past: [...currentState.history.past, currentState.elements],
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
