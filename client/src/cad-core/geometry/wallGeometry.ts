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

export interface LineSegment2D {
  start: Point2D;
  end: Point2D;
}

// Checa se um ponto está dentro ou encostado na espessura de qualquer outra parede
export function isPointInsideAnyOtherWall(
  point: Point2D,
  currentWallId: string,
  walls: WallElement[],
  margin: number = 0.03
): boolean {
  for (const wall of walls) {
    if (wall.id === currentWallId) continue;
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) continue;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const midX = (wall.start.x + wall.end.x) / 2;
    const midY = (wall.start.y + wall.end.y) / 2;

    const rx = point.x - midX;
    const ry = point.y - midY;

    const distLong = Math.abs(rx * ux + ry * uy);
    const distTrans = Math.abs(rx * nx + ry * ny);

    if (distLong <= len / 2 + 0.05 && distTrans <= wall.thickness / 2 + margin) {
      return true;
    }
  }
  return false;
}

// Recorta um segmento de linha [p0, p1], removendo qualquer parte que passe por dentro de outras paredes
export function clipSegmentByWalls(
  p0: Point2D,
  p1: Point2D,
  currentWallId: string,
  walls: WallElement[]
): LineSegment2D[] {
  const lineDx = p1.x - p0.x;
  const lineDy = p1.y - p0.y;
  const lineLen = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
  if (lineLen < 0.01) return [];

  // Intervalos visíveis parametrizados em s in [0, 1]
  let visibleIntervals: { s0: number; s1: number }[] = [{ s0: 0, s1: 1 }];

  for (const other of walls) {
    if (other.id === currentWallId) continue;

    const oDx = other.end.x - other.start.x;
    const oDy = other.end.y - other.start.y;
    const oLen = Math.sqrt(oDx * oDx + oDy * oDy);
    if (oLen < 0.01) continue;

    const ux = oDx / oLen;
    const uy = oDy / oLen;
    const nx = -uy;
    const ny = ux;

    const midX = (other.start.x + other.end.x) / 2;
    const midY = (other.start.y + other.end.y) / 2;

    // Meia espessura da outra parede (subtrai 2mm para que linhas coincidentes nas faces externas não sejam clipadas)
    const halfL = oLen / 2 + 0.01;
    const halfW = other.thickness / 2 - 0.002;
    if (halfW <= 0) continue;

    const r0x = p0.x - midX;
    const r0y = p0.y - midY;

    const A_long = r0x * ux + r0y * uy;
    const B_long = lineDx * ux + lineDy * uy;

    const A_trans = r0x * nx + r0y * ny;
    const B_trans = lineDx * nx + lineDy * ny;

    let sMinLong = 0;
    let sMaxLong = 1;
    if (Math.abs(B_long) < 1e-6) {
      if (Math.abs(A_long) > halfL) continue;
      sMinLong = -Infinity;
      sMaxLong = Infinity;
    } else if (B_long > 0) {
      sMinLong = (-halfL - A_long) / B_long;
      sMaxLong = (halfL - A_long) / B_long;
    } else {
      sMinLong = (halfL - A_long) / B_long;
      sMaxLong = (-halfL - A_long) / B_long;
    }

    let sMinTrans = 0;
    let sMaxTrans = 1;
    if (Math.abs(B_trans) < 1e-6) {
      if (Math.abs(A_trans) >= halfW) continue;
      sMinTrans = -Infinity;
      sMaxTrans = Infinity;
    } else if (B_trans > 0) {
      sMinTrans = (-halfW - A_trans) / B_trans;
      sMaxTrans = (halfW - A_trans) / B_trans;
    } else {
      sMinTrans = (halfW - A_trans) / B_trans;
      sMaxTrans = (-halfW - A_trans) / B_trans;
    }

    const enterS = Math.max(sMinLong, sMinTrans, 0);
    const exitS = Math.min(sMaxLong, sMaxTrans, 1);

    if (exitS - enterS > 0.005) {
      const nextIntervals: { s0: number; s1: number }[] = [];
      for (const inv of visibleIntervals) {
        if (exitS <= inv.s0 || enterS >= inv.s1) {
          nextIntervals.push(inv);
        } else {
          if (inv.s0 < enterS - 0.001) {
            nextIntervals.push({ s0: inv.s0, s1: enterS });
          }
          if (exitS + 0.001 < inv.s1) {
            nextIntervals.push({ s0: exitS, s1: inv.s1 });
          }
        }
      }
      visibleIntervals = nextIntervals;
    }
  }

  const result: LineSegment2D[] = [];
  for (const inv of visibleIntervals) {
    const segLen = (inv.s1 - inv.s0) * lineLen;
    if (segLen > 0.015) {
      result.push({
        start: {
          x: p0.x + inv.s0 * lineDx,
          y: p0.y + inv.s0 * lineDy,
        },
        end: {
          x: p0.x + inv.s1 * lineDx,
          y: p0.y + inv.s1 * lineDy,
        },
      });
    }
  }

  return result;
}

// Checa se uma extremidade de parede está conectada a outra parede
export function isWallEndpointConnected(
  point: Point2D,
  currentWallId: string,
  walls: WallElement[],
  threshold: number = 0.12
): boolean {
  for (const wall of walls) {
    if (wall.id === currentWallId) continue;
    if (distance(point, wall.start) <= threshold || distance(point, wall.end) <= threshold) {
      return true;
    }
  }
  return false;
}

export interface WallEndpointAnalysis {
  connected: boolean;
  otherWall?: WallElement;
  isDominant: boolean; // se for dominante (ex: horizontal), estende para fora e desenha tampa de quina
  drawCap: boolean;    // true se deve desenhar tampa na ponta
  extendAmount: number; // positivo estende para fora, negativo recua para dentro
  connectedSide: 1 | -1 | 0; // lado local da parede (+halfW ou -halfW) virado para a outra parede
}

export function analyzeWallEndpoint(
  point: Point2D,
  currentWall: WallElement,
  walls: WallElement[],
  threshold: number = 0.15
): WallEndpointAnalysis {
  for (const other of walls) {
    if (other.id === currentWall.id) continue;
    const dStart = distance(point, other.start);
    const dEnd = distance(point, other.end);
    if (dStart <= threshold || dEnd <= threshold) {
      const curDx = currentWall.end.x - currentWall.start.x;
      const curDy = currentWall.end.y - currentWall.start.y;
      const curLen = Math.sqrt(curDx * curDx + curDy * curDy) || 1;

      const otherDx = other.end.x - other.start.x;
      const otherDy = other.end.y - other.start.y;
      const otherLen = Math.sqrt(otherDx * otherDx + otherDy * otherDy) || 1;

      // Direção para o corpo da outra parede a partir da quina
      const otherConnectedAtStart = dStart <= threshold;
      const vOtherX = otherConnectedAtStart ? otherDx / otherLen : -otherDx / otherLen;
      const vOtherY = otherConnectedAtStart ? otherDy / otherLen : -otherDy / otherLen;

      // Checa colinearidade (paredes contínuas retas)
      const dot = Math.abs((curDx * otherDx + curDy * otherDy) / (curLen * otherLen));
      if (dot > 0.95) {
        return {
          connected: true,
          otherWall: other,
          isDominant: false,
          drawCap: false,
          extendAmount: 0,
          connectedSide: 0,
        };
      }

      // Lado local no Three.js BoxGeometry (+halfW ou -halfW)
      // O normal da parede é (-curDy / curLen, curDx / curLen)
      const normalX = -curDy / curLen;
      const normalY = curDx / curLen;
      const sideDot = vOtherX * normalX + vOtherY * normalY;
      const connectedSide: 1 | -1 | 0 = sideDot > 0.05 ? 1 : sideDot < -0.05 ? -1 : 0;

      // Em quinas (canto entre 2 paredes), AMBAS as paredes se estendem por +other.thickness / 2
      // para preencher 100% do volume do canto até a quina externa, enquanto clipSegmentByWalls
      // garante que as linhas internas fiquem abertas e as externas se encontrem perfeitamente em 90°.
      return {
        connected: true,
        otherWall: other,
        isDominant: true,
        drawCap: false,
        extendAmount: other.thickness / 2,
        connectedSide,
      };
    }
  }

  return {
    connected: false,
    isDominant: false,
    drawCap: true,
    extendAmount: 0,
    connectedSide: 0,
  };
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
