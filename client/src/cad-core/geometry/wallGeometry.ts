import type { Point2D, WallElement, DoorElement, WindowElement } from '../types';
import { distance } from '../snaps/snapEngine';

export interface WallSubSegment {
  start: Point2D;
  end: Point2D;
  length: number;
}

export interface WallOpening {
  id: string;
  type: 'door' | 'window';
  centerRatio: number; // 0.0 a 1.0 ao longo do comprimento da parede
  width: number;
  height: number;
  sillHeight: number;
  startRatio: number;
  endRatio: number;
  element: DoorElement | WindowElement;
}

// 1. Calcular Vãos de Portas e Janelas ao longo de uma Parede
export function getWallOpenings(
  wall: WallElement,
  doors: DoorElement[],
  windows: WindowElement[]
): WallOpening[] {
  const wallLen = distance(wall.start, wall.end);
  if (wallLen < 0.1) return [];

  const openings: WallOpening[] = [];

  // Portas hospedadas nesta parede
  doors
    .filter((d) => d.wallId === wall.id)
    .forEach((door) => {
      const halfWidthRatio = (door.width / 2) / wallLen;
      const startRatio = Math.max(0, door.offsetRatio - halfWidthRatio);
      const endRatio = Math.min(1, door.offsetRatio + halfWidthRatio);

      openings.push({
        id: door.id,
        type: 'door',
        centerRatio: door.offsetRatio,
        width: door.width,
        height: door.height,
        sillHeight: 0,
        startRatio,
        endRatio,
        element: door,
      });
    });

  // Janelas hospedadas nesta parede
  windows
    .filter((w) => w.wallId === wall.id)
    .forEach((win) => {
      const halfWidthRatio = (win.width / 2) / wallLen;
      const startRatio = Math.max(0, win.offsetRatio - halfWidthRatio);
      const endRatio = Math.min(1, win.offsetRatio + halfWidthRatio);

      openings.push({
        id: win.id,
        type: 'window',
        centerRatio: win.offsetRatio,
        width: win.width,
        height: win.height,
        sillHeight: win.sillHeight,
        startRatio,
        endRatio,
        element: win,
      });
    });

  // Ordenar vãos pelo início ao longo da parede
  openings.sort((a, b) => a.startRatio - b.startRatio);
  return openings;
}

// 2. Fatiar a Parede em Sub-segmentos Sólidos (deixando os vãos abertos)
export function getSolidWallSegments(wall: WallElement, openings: WallOpening[]): WallSubSegment[] {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const wallLen = Math.sqrt(dx * dx + dy * dy);

  if (openings.length === 0) {
    return [{ start: wall.start, end: wall.end, length: wallLen }];
  }

  const segments: WallSubSegment[] = [];
  let currentRatio = 0.0;

  for (const op of openings) {
    if (op.startRatio > currentRatio) {
      const segStart: Point2D = {
        x: wall.start.x + dx * currentRatio,
        y: wall.start.y + dy * currentRatio,
      };
      const segEnd: Point2D = {
        x: wall.start.x + dx * op.startRatio,
        y: wall.start.y + dy * op.startRatio,
      };
      const segLen = distance(segStart, segEnd);
      if (segLen > 0.02) {
        segments.push({ start: segStart, end: segEnd, length: segLen });
      }
    }
    currentRatio = Math.max(currentRatio, op.endRatio);
  }

  // Segmento final após o último vão
  if (currentRatio < 1.0) {
    const segStart: Point2D = {
      x: wall.start.x + dx * currentRatio,
      y: wall.start.y + dy * currentRatio,
    };
    const segEnd: Point2D = {
      x: wall.start.x + dx * 1.0,
      y: wall.start.y + dy * 1.0,
    };
    const segLen = distance(segStart, segEnd);
    if (segLen > 0.02) {
      segments.push({ start: segStart, end: segEnd, length: segLen });
    }
  }

  return segments;
}

// 3. Projeção de Ponto na Parede (para posicionar portas e janelas com o mouse)
export function projectPointOntoWall(
  point: Point2D,
  wall: WallElement
): { projectedPoint: Point2D; ratio: number; distToWall: number } {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 0.0001) {
    return { projectedPoint: wall.start, ratio: 0.5, distToWall: distance(point, wall.start) };
  }

  let t = ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lenSq;
  t = Math.max(0.05, Math.min(0.95, t)); // Mantém margem mínima das pontas da parede

  const projectedPoint: Point2D = {
    x: wall.start.x + t * dx,
    y: wall.start.y + t * dy,
  };

  const distToWall = distance(point, projectedPoint);
  return { projectedPoint, ratio: t, distToWall };
}

// 4. Encontrar Parede Hospedeira mais próxima do cursor
export function findNearestHostWall(
  point: Point2D,
  walls: WallElement[],
  thresholdMeters: number = 0.5
): { wall: WallElement; ratio: number; projectedPoint: Point2D } | null {
  let closestWall: WallElement | null = null;
  let minDistance = thresholdMeters;
  let bestRatio = 0.5;
  let bestPoint: Point2D = { x: 0, y: 0 };

  for (const wall of walls) {
    const proj = projectPointOntoWall(point, wall);
    if (proj.distToWall < minDistance) {
      minDistance = proj.distToWall;
      closestWall = wall;
      bestRatio = proj.ratio;
      bestPoint = proj.projectedPoint;
    }
  }

  if (closestWall) {
    return { wall: closestWall, ratio: bestRatio, projectedPoint: bestPoint };
  }
  return null;
}

// 5. Cálculo de Área em m² de Polígonos (Shoelace Formula / Fórmula de Gauss)
export function computePolygonArea(vertices: Point2D[]): number {
  if (vertices.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

// 6. Cálculo de Escada pela Fórmula de Blondel (2E + P = 63 a 64 cm)
export function computeStairParameters(totalRise: number = 2.80, desiredTreadDepth: number = 0.28) {
  // Altura ideal do espelho em torno de 17.5 cm (0.175m)
  const stepsCount = Math.max(1, Math.round(totalRise / 0.175));
  const riserHeight = totalRise / stepsCount;
  const treadDepth = desiredTreadDepth;
  const blondelValue = 2 * riserHeight + treadDepth;

  return {
    stepsCount,
    riserHeight,
    treadDepth,
    blondelValue,
    isComfortable: blondelValue >= 0.62 && blondelValue <= 0.65,
  };
}

// 7. Detecção de Junções de Paredes para Conexão Miter Perfeita
export interface WallJoint {
  point: Point2D;
  wallIds: string[];
  thickness: number;
}

export function findWallJoints(walls: WallElement[]): WallJoint[] {
  const joints: WallJoint[] = [];
  const threshold = 0.08; // 8cm para tolerância de junção

  const endpoints: { point: Point2D; wallId: string; thickness: number }[] = [];
  for (const wall of walls) {
    endpoints.push({ point: wall.start, wallId: wall.id, thickness: wall.thickness });
    endpoints.push({ point: wall.end, wallId: wall.id, thickness: wall.thickness });
  }

  const processed = new Set<number>();

  for (let i = 0; i < endpoints.length; i++) {
    if (processed.has(i)) continue;
    const group = [endpoints[i]];
    processed.add(i);

    for (let j = i + 1; j < endpoints.length; j++) {
      if (processed.has(j)) continue;
      if (distance(endpoints[i].point, endpoints[j].point) <= threshold) {
        group.push(endpoints[j]);
        processed.add(j);
      }
    }

    if (group.length >= 2) {
      // Ponto médio da junção
      const avgX = group.reduce((sum, g) => sum + g.point.x, 0) / group.length;
      const avgY = group.reduce((sum, g) => sum + g.point.y, 0) / group.length;
      const maxThick = Math.max(...group.map((g) => g.thickness));

      joints.push({
        point: { x: avgX, y: avgY },
        wallIds: group.map((g) => g.wallId),
        thickness: maxThick,
      });
    }
  }

  return joints;
}

// 8. Tentar encontrar contorno fechado ao redor de um ponto de clique (Detecção de Ambiente)
export function detectClosedRoomPolygon(
  clickPoint: Point2D,
  walls: WallElement[]
): Point2D[] | null {
  if (walls.length < 3) return null;

  // Raio de busca de paredes nas 4 direções principais (+X, -X, +Y, -Y)
  // Cria um polígono retangular aproximado se as paredes formam um cômodo ortogonal
  let minX = -Infinity;
  let maxX = Infinity;
  let minY = -Infinity;
  let maxY = Infinity;

  for (const wall of walls) {
    const isHorizontal = Math.abs(wall.start.y - wall.end.y) < 0.1;
    const isVertical = Math.abs(wall.start.x - wall.end.x) < 0.1;

    const wMinX = Math.min(wall.start.x, wall.end.x);
    const wMaxX = Math.max(wall.start.x, wall.end.x);
    const wMinY = Math.min(wall.start.y, wall.end.y);
    const wMaxY = Math.max(wall.start.y, wall.end.y);

    if (isHorizontal) {
      const y = (wall.start.y + wall.end.y) / 2;
      if (clickPoint.x >= wMinX - 0.2 && clickPoint.x <= wMaxX + 0.2) {
        if (y < clickPoint.y && y > minY) minY = y;
        if (y > clickPoint.y && y < maxY) maxY = y;
      }
    } else if (isVertical) {
      const x = (wall.start.x + wall.end.x) / 2;
      if (clickPoint.y >= wMinY - 0.2 && clickPoint.y <= wMaxY + 0.2) {
        if (x < clickPoint.x && x > minX) minX = x;
        if (x > clickPoint.x && x < maxX) maxX = x;
      }
    }
  }

  if (isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY)) {
    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
  }

  // Se não for um retângulo perfeito, cria um polígono de 4x4m centrado para o usuário ajustar
  return [
    { x: clickPoint.x - 2, y: clickPoint.y - 2 },
    { x: clickPoint.x + 2, y: clickPoint.y - 2 },
    { x: clickPoint.x + 2, y: clickPoint.y + 2 },
    { x: clickPoint.x - 2, y: clickPoint.y + 2 },
  ];
}
