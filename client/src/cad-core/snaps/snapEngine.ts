import type { Point2D, SnapResult, SnapConfig, WallElement, SnapType } from '../types';

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

  // 2. Object Snaps (Extremidades e Faces de Paredes: Externa, Interna e Central)
  if (config.objectSnap) {
    let closestSnap: SnapResult | null = null;
    let minDistance = worldThreshold;

    // 2.1. Prioridade A: Vértices discretos (Quinas externas, internas, eixos e pontos médios)
    for (const wall of walls) {
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      if (wallLen < 0.01) continue;

      const halfW = (wall.thickness || 0.15) / 2;
      const normX = -dy / wallLen;
      const normY = dx / wallLen;

      // Lista de pontos-chave discretos
      const keyPoints: { pt: Point2D; type: SnapType; label: string }[] = [
        // Extremidade Inicial
        { pt: { x: wall.start.x, y: wall.start.y }, type: 'wall_center', label: 'Eixo / Centro' },
        { pt: { x: wall.start.x + normX * halfW, y: wall.start.y + normY * halfW }, type: 'wall_ext', label: 'Extremidade Externa' },
        { pt: { x: wall.start.x - normX * halfW, y: wall.start.y - normY * halfW }, type: 'wall_int', label: 'Extremidade Interna' },

        // Extremidade Final
        { pt: { x: wall.end.x, y: wall.end.y }, type: 'wall_center', label: 'Eixo / Centro' },
        { pt: { x: wall.end.x + normX * halfW, y: wall.end.y + normY * halfW }, type: 'wall_ext', label: 'Extremidade Externa' },
        { pt: { x: wall.end.x - normX * halfW, y: wall.end.y - normY * halfW }, type: 'wall_int', label: 'Extremidade Interna' },

        // Pontos Médios
        {
          pt: { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 },
          type: 'midpoint',
          label: 'Ponto Médio (Eixo)',
        },
        {
          pt: { x: (wall.start.x + wall.end.x) / 2 + normX * halfW, y: (wall.start.y + wall.end.y) / 2 + normY * halfW },
          type: 'wall_ext',
          label: 'Ponto Médio (Face Ext)',
        },
        {
          pt: { x: (wall.start.x + wall.end.x) / 2 - normX * halfW, y: (wall.start.y + wall.end.y) / 2 - normY * halfW },
          type: 'wall_int',
          label: 'Ponto Médio (Face Int)',
        },
      ];

      for (const kp of keyPoints) {
        const d = distance(rawWorldPoint, kp.pt);
        if (d < minDistance) {
          minDistance = d;
          closestSnap = {
            point: kp.pt,
            type: kp.type,
            label: kp.label,
            sourceElementId: wall.id,
          };
        }
      }
    }

    if (closestSnap) {
      return closestSnap;
    }

    // 2.2. Prioridade B: Projeção contínua ao longo das faces (Face Externa, Face Interna, Eixo)
    let closestFaceSnap: SnapResult | null = null;
    let minFaceDist = worldThreshold;

    for (const wall of walls) {
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      if (wallLen < 0.01) continue;

      const halfW = (wall.thickness || 0.15) / 2;
      const ux = dx / wallLen;
      const uy = dy / wallLen;
      const normX = -uy;
      const normY = ux;

      // Projeção paramétrica 't' ao longo da parede
      const vx = rawWorldPoint.x - wall.start.x;
      const vy = rawWorldPoint.y - wall.start.y;
      const t = vx * ux + vy * uy;

      // Somente se o ponto estiver contido na extensão longitudinal da parede
      if (t >= 0 && t <= wallLen) {
        const centerPt = { x: wall.start.x + ux * t, y: wall.start.y + uy * t };
        const extPt = { x: centerPt.x + normX * halfW, y: centerPt.y + normY * halfW };
        const intPt = { x: centerPt.x - normX * halfW, y: centerPt.y - normY * halfW };

        const dExt = distance(rawWorldPoint, extPt);
        const dInt = distance(rawWorldPoint, intPt);
        const dCenter = distance(rawWorldPoint, centerPt);

        if (dExt < minFaceDist) {
          minFaceDist = dExt;
          closestFaceSnap = {
            point: extPt,
            type: 'wall_ext',
            label: 'Face Externa',
            sourceElementId: wall.id,
          };
        }

        if (dInt < minFaceDist) {
          minFaceDist = dInt;
          closestFaceSnap = {
            point: intPt,
            type: 'wall_int',
            label: 'Face Interna',
            sourceElementId: wall.id,
          };
        }

        if (dCenter < minFaceDist) {
          minFaceDist = dCenter;
          closestFaceSnap = {
            point: centerPt,
            type: 'wall_center',
            label: 'Eixo Central',
            sourceElementId: wall.id,
          };
        }
      }
    }

    if (closestFaceSnap) {
      return closestFaceSnap;
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
