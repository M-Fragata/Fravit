import type { Point2D, SnapResult, SnapConfig, WallElement } from '../types';

export function distance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Arredondar para o grid mais próximo (em metros)
export function snapToGrid(point: Point2D, gridSize: number): Point2D {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

// Travar cursor nos eixos ortogonais (0°, 90°, 180°, 270°)
export function applyOrtho(start: Point2D, current: Point2D): Point2D {
  const dx = Math.abs(current.x - start.x);
  const dy = Math.abs(current.y - start.y);

  if (dx >= dy) {
    return { x: current.x, y: start.y };
  } else {
    return { x: start.x, y: current.y };
  }
}

// Travar cursor com rastreamento polar (ângulos de 45°)
export function applyPolar(
  start: Point2D,
  current: Point2D,
  toleranceDeg: number = 4
): { point: Point2D; isPolar: boolean; angleDeg: number } {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 0.05) return { point: current, isPolar: false, angleDeg: 0 };

  let angleRad = Math.atan2(dy, dx);
  let angleDeg = (angleRad * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  // Ângulos polares suportados: 0, 45, 90, 135, 180, 225, 270, 315
  const targets = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  for (const target of targets) {
    if (Math.abs(angleDeg - target) <= toleranceDeg) {
      const snapRad = (target * Math.PI) / 180;
      return {
        point: {
          x: start.x + len * Math.cos(snapRad),
          y: start.y + len * Math.sin(snapRad),
        },
        isPolar: true,
        angleDeg: target % 360,
      };
    }
  }

  return { point: current, isPolar: false, angleDeg };
}

// Motor de Snaps Inteligentes (Endpoint, Midpoint, Grid)
export function computeSnap(
  rawWorldPoint: Point2D,
  drawingStart: Point2D | null,
  walls: WallElement[],
  config: SnapConfig,
  pixelsPerMeter: number
): SnapResult {
  let candidatePoint = { ...rawWorldPoint };
  const worldThreshold = config.snapThresholdPx / Math.max(pixelsPerMeter, 1);

  // 1. Ortho Mode tem precedência se estiver desenhando
  if (config.orthoMode && drawingStart) {
    candidatePoint = applyOrtho(drawingStart, candidatePoint);
    return {
      point: candidatePoint,
      type: 'grid',
    };
  }

  // 2. Polar Tracking
  let polarGuide: { start: Point2D; end: Point2D; isPolar?: boolean } | null = null;
  if (config.polarTracking && drawingStart) {
    const polar = applyPolar(drawingStart, candidatePoint);
    if (polar.isPolar) {
      candidatePoint = polar.point;
      polarGuide = { start: drawingStart, end: candidatePoint, isPolar: true };
    }
  }

  // 3. Object Snaps (Extremidades e Pontos Médios de Paredes)
  if (config.objectSnap) {
    let closestSnap: SnapResult | null = null;
    let minDistance = worldThreshold;

    for (const wall of walls) {
      // Endpoint: Start
      const dStart = distance(rawWorldPoint, wall.start);
      if (dStart < minDistance) {
        minDistance = dStart;
        closestSnap = {
          point: { ...wall.start },
          type: 'endpoint',
          sourceElementId: wall.id,
        };
      }

      // Endpoint: End
      const dEnd = distance(rawWorldPoint, wall.end);
      if (dEnd < minDistance) {
        minDistance = dEnd;
        closestSnap = {
          point: { ...wall.end },
          type: 'endpoint',
          sourceElementId: wall.id,
        };
      }

      // Midpoint
      const midpoint: Point2D = {
        x: (wall.start.x + wall.end.x) / 2,
        y: (wall.start.y + wall.end.y) / 2,
      };
      const dMid = distance(rawWorldPoint, midpoint);
      if (dMid < minDistance) {
        minDistance = dMid;
        closestSnap = {
          point: midpoint,
          type: 'midpoint',
          sourceElementId: wall.id,
        };
      }
    }

    if (closestSnap) {
      return closestSnap;
    }
  }

  // 4. Grid Snap se não pegou nenhum ponto de objeto
  if (config.gridSnap) {
    const snapped = snapToGrid(candidatePoint, config.gridSize);
    return {
      point: snapped,
      type: 'grid',
      guideLines: polarGuide ? [polarGuide] : undefined,
    };
  }

  return {
    point: candidatePoint,
    type: 'grid',
    guideLines: polarGuide ? [polarGuide] : undefined,
  };
}
