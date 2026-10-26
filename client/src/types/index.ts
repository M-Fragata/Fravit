export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  createdAt: string;
  updatedAt: string;
}

export interface BIMLevel {
  id: string;
  name: string;
  elevation: number;
  height: number;
}

export interface BIMElements {
  walls: any[];
  doors: any[];
  windows: any[];
  floors: any[];
  roofs: any[];
  stairs: any[];
  rooms: any[];
  roomSeparators: any[];
  dimensions: any[];
  sections: any[];
}

export interface BIMData {
  version: string;
  meta: {
    projectName: string;
    author: string;
    unit: string;
    createdAt: string;
  };
  activeLevelId: string;
  levels: BIMLevel[];
  elements: BIMElements;
  sheets: any[];
  activeSheetId?: string;
}

export interface ProjectDetail extends ProjectSummary {
  bimData: BIMData;
}
