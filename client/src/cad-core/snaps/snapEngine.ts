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

// Travar cursor com rastreamento polar (ângulos de 45°: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
export function applyPolar(
  start: Point2D,
  current: Point2D,
  toleranceDeg: number = 6
): { point: Point2D; isPolar: boolean; angleDeg: number; snapRad: number } {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 0.05) return { point: current, isPolar: false, angleDeg: 0, snapRad: 0 };

  let angleRad = Math.atan2(dy, dx);
  let angleDeg = (angleRad * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  // Ângulos polares a cada 45°
  const targets = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  for (const target of targets) {
    if (Math.abs(angleDeg - target) <= toleranceDeg) {
      const snapRad = ((target % 360) * Math.PI) / 180;
      return {
        point: {
          x: start.x + len * Math.cos(snapRad),
          y: start.y + len * Math.sin(snapRad),
        },
        isPolar: true,
        angleDeg: target % 360,
        snapRad,
      };
    }
  }

  return { point: current, isPolar: false, angleDeg, snapRad: angleRad };
}

// Motor de Snaps Inteligentes (Endpoint, Midpoint, Polar, Grid)
export function computeSnap(
  rawWorldPoint: Point2D,
  drawingStart: Point2D | null,
  walls: WallElement[],
  config: SnapConfig,
  pixelsPerMeter: number
): SnapResult {
  let candidatePoint = { ...rawWorldPoint };
  const worldThreshold = config.snapThresholdPx / Math.max(pixelsPerMeter, 1);

  // 1. Ortho Mode tem precedência absoluta se estiver ativo e desenhando
  if (config.orthoMode && drawingStart) {
    candidatePoint = applyOrtho(drawingStart, candidatePoint);
    if (config.gridSnap) {
      candidatePoint = snapToGrid(candidatePoint, config.gridSize);
    }
    return {
      point: candidatePoint,
      type: 'grid',
    };
  }

  // 2. Object Snaps (Extremidades e Pontos Médios de Paredes)
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

  // 3. Rastreamento Polar e Alinhamento com Outras Paredes (Alignment Tracking)
  if (drawingStart) {
    let guideLines: { start: Point2D; end: Point2D; isPolar?: boolean }[] = [];
    let alignedPoint = { ...candidatePoint };
    let polarAngleResult: number | undefined;

    // A. Polar Tracking
    if (config.polarTracking || config.orthoMode) {
      const polar = config.orthoMode
        ? { isPolar: true, angleDeg: 0, snapRad: 0, point: applyOrtho(drawingStart, candidatePoint) }
        : applyPolar(drawingStart, candidatePoint);

      if (polar.isPolar) {
        const dx = candidatePoint.x - drawingStart.x;
        const dy = candidatePoint.y - drawingStart.y;
        let len = Math.sqrt(dx * dx + dy * dy);

        if (config.gridSnap) {
          len = Math.max(config.gridSize, Math.round(len / config.gridSize) * config.gridSize);
        }

        const snapAngle = config.orthoMode
          ? Math.abs(dx) >= Math.abs(dy)
            ? (dx >= 0 ? 0 : Math.PI)
            : (dy >= 0 ? Math.PI / 2 : (3 * Math.PI) / 2)
          : polar.snapRad;

        alignedPoint = {
          x: drawingStart.x + len * Math.cos(snapAngle),
          y: drawingStart.y + len * Math.sin(snapAngle),
        };
        polarAngleResult = config.orthoMode ? Math.round((snapAngle * 180) / Math.PI) : polar.angleDeg;

        // Raio polar estendido
        const rayEnd: Point2D = {
          x: drawingStart.x + (len + 15) * Math.cos(snapAngle),
          y: drawingStart.y + (len + 15) * Math.sin(snapAngle),
        };
        guideLines.push({ start: drawingStart, end: rayEnd, isPolar: true });
      }
    }

    // B. Extension / Alignment Tracking com Endpoints de outras Paredes (Estilo Revit / AutoCAD)
    // Permite que uma parede inferior encontre o alinhamento exato de uma parede superior
    const alignThreshold = Math.max(0.25, worldThreshold * 1.5);
    const otherPoints: Point2D[] = [];
    walls.forEach((w) => {
      if (distance(w.start, drawingStart) > 0.05) otherPoints.push(w.start);
      if (distance(w.end, drawingStart) > 0.05) otherPoints.push(w.end);
    });

    for (const pt of otherPoints) {
      // Alinhamento Vertical (mesmo X): desenha linha guia vertical do ponto de referência até o cursor
      if (Math.abs(alignedPoint.x - pt.x) <= alignThreshold) {
        alignedPoint.x = pt.x;
        guideLines.push({
          start: { x: pt.x, y: pt.y },
          end: { x: pt.x, y: alignedPoint.y },
          isPolar: false,
        });
        break;
      }

      // Alinhamento Horizontal (mesmo Y): desenha linha guia horizontal do ponto de referência até o cursor
      if (Math.abs(alignedPoint.y - pt.y) <= alignThreshold) {
        alignedPoint.y = pt.y;
        guideLines.push({
          start: { x: pt.x, y: pt.y },
          end: { x: alignedPoint.x, y: pt.y },
          isPolar: false,
        });
        break;
      }
    }

    if (guideLines.length > 0) {
      return {
        point: alignedPoint,
        type: 'grid',
        polarAngle: polarAngleResult,
        guideLines,
      };
    }
  }

  // 4. Grid Snap padrão quando não há snap de objeto nem polar
  if (config.gridSnap) {
    const snapped = snapToGrid(candidatePoint, config.gridSize);
    return {
      point: snapped,
      type: 'grid',
    };
  }

  return {
    point: candidatePoint,
    type: 'grid',
  };
}
