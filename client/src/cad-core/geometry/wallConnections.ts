import type { Point2D, WallElement, DoorElement, WindowElement } from '../types';
import { distance } from '../snaps/snapEngine';

/**
 * Distância mínima de um ponto a um segmento de reta 2D
 */
export function distToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return distance(p, { x: projX, y: projY });
}

/**
 * Calcula a interseção entre duas retas infinitas:
 * Reta 1: P1 + s * d1
 * Reta 2: P2 + t * d2
 */
export function lineLineIntersection(
  p1: Point2D,
  d1: Point2D,
  p2: Point2D,
  d2: Point2D
): Point2D | null {
  const det = -d1.x * d2.y + d1.y * d2.x;
  if (Math.abs(det) < 1e-5) return null; // Linhas paralelas

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const s = (dx * -d2.y - dy * -d2.x) / det;

  return {
    x: p1.x + s * d1.x,
    y: p1.y + s * d1.y,
  };
}

/**
 * Estica a extremidade de uma parede (start ou end) bloqueando o encurtamento
 * caso atinja a posição de uma porta ou janela existente, e recalcula os offsetRatios
 * para que as esquadrias permaneçam estritamente fixas no espaço do mundo.
 */
export function calculateStretchedWall(
  wall: WallElement,
  endpoint: 'start' | 'end',
  targetPos: Point2D,
  doors: DoorElement[],
  windows: WindowElement[]
): {
  newWall: WallElement;
  updatedDoors: DoorElement[];
  updatedWindows: WindowElement[];
} {
  const fixedPt = endpoint === 'start' ? wall.end : wall.start;
  const oldMovedPt = endpoint === 'start' ? wall.start : wall.end;

  // Vetor antigo da ponta fixa para a ponta móvel
  const oldDx = oldMovedPt.x - fixedPt.x;
  const oldDy = oldMovedPt.y - fixedPt.y;
  const oldLen = Math.hypot(oldDx, oldDy) || 1;
  const oldDir = { x: oldDx / oldLen, y: oldDy / oldLen };

  // Vetor desejado da ponta fixa para o alvo
  let targetDx = targetPos.x - fixedPt.x;
  let targetDy = targetPos.y - fixedPt.y;
  let targetLen = Math.hypot(targetDx, targetDy);

  if (targetLen < 0.15) {
    targetLen = 0.15;
    targetDx = oldDir.x * 0.15;
    targetDy = oldDir.y * 0.15;
  }
  const targetDir = { x: targetDx / targetLen, y: targetDy / targetLen };

  // Esquadrias hospedadas nesta parede
  const hostedDoors = doors.filter((d) => d.wallId === wall.id);
  const hostedWins = windows.filter((w) => w.wallId === wall.id);

  // Calcular a posição física no mundo de cada esquadria antes do estiramento
  const doorWorldPositions = hostedDoors.map((d) => ({
    door: d,
    worldPos: {
      x: wall.start.x + (wall.end.x - wall.start.x) * d.offsetRatio,
      y: wall.start.y + (wall.end.y - wall.start.y) * d.offsetRatio,
    },
  }));

  const winWorldPositions = hostedWins.map((w) => ({
    win: w,
    worldPos: {
      x: wall.start.x + (wall.end.x - wall.start.x) * w.offsetRatio,
      y: wall.start.y + (wall.end.y - wall.start.y) * w.offsetRatio,
    },
  }));

  // Bloquear encurtamento da parede se atingir qualquer esquadria existente
  let minAllowedLength = 0.20;

  for (const item of doorWorldPositions) {
    const distFromFixed =
      (item.worldPos.x - fixedPt.x) * oldDir.x + (item.worldPos.y - fixedPt.y) * oldDir.y;
    const reqLength = distFromFixed + item.door.width / 2 + 0.05;
    if (reqLength > minAllowedLength) {
      minAllowedLength = reqLength;
    }
  }

  for (const item of winWorldPositions) {
    const distFromFixed =
      (item.worldPos.x - fixedPt.x) * oldDir.x + (item.worldPos.y - fixedPt.y) * oldDir.y;
    const reqLength = distFromFixed + item.win.width / 2 + 0.05;
    if (reqLength > minAllowedLength) {
      minAllowedLength = reqLength;
    }
  }

  // Se o usuário tentou encurtar além da esquadria, travar no comprimento mínimo permitido
  if (targetLen < minAllowedLength) {
    targetLen = minAllowedLength;
  }

  const finalMovedPt: Point2D = {
    x: fixedPt.x + targetDir.x * targetLen,
    y: fixedPt.y + targetDir.y * targetLen,
  };

  const newStart = endpoint === 'start' ? finalMovedPt : wall.start;
  const newEnd = endpoint === 'end' ? finalMovedPt : wall.end;
  const newDx = newEnd.x - newStart.x;
  const newDy = newEnd.y - newStart.y;
  const newWallLen = Math.hypot(newDx, newDy) || 1;

  const newWall: WallElement = {
    ...wall,
    start: newStart,
    end: newEnd,
  };

  // Recalcular offsetRatio para manter portas e janelas exatamente nas mesmas posições de mundo
  const updatedDoors = hostedDoors.map((d) => {
    const originalPos = doorWorldPositions.find((item) => item.door.id === d.id)?.worldPos;
    if (!originalPos) return d;

    const t =
      ((originalPos.x - newStart.x) * newDx + (originalPos.y - newStart.y) * newDy) /
      (newWallLen * newWallLen);
    const halfW = d.width / 2 / newWallLen;
    const clampedRatio = Math.max(halfW, Math.min(1 - halfW, t));

    return { ...d, offsetRatio: clampedRatio };
  });

  const updatedWindows = hostedWins.map((w) => {
    const originalPos = winWorldPositions.find((item) => item.win.id === w.id)?.worldPos;
    if (!originalPos) return w;

    const t =
      ((originalPos.x - newStart.x) * newDx + (originalPos.y - newStart.y) * newDy) /
      (newWallLen * newWallLen);
    const halfW = w.width / 2 / newWallLen;
    const clampedRatio = Math.max(halfW, Math.min(1 - halfW, t));

    return { ...w, offsetRatio: clampedRatio };
  });

  return { newWall, updatedDoors, updatedWindows };
}

/**
 * Encontra e calcula os ajustes das paredes conectadas (L-joins e T-joins)
 * quando uma ou mais paredes são arrastadas no modo padrão (Disjoin = false).
 */
export function getConnectedWallAdjustments(
  allWalls: WallElement[],
  movedWallIds: string[],
  delta: Point2D,
  disjoin: boolean = false,
  doors: DoorElement[] = [],
  windows: WindowElement[] = []
): {
  adjustedWalls: Map<string, { start?: Point2D; end?: Point2D }>;
  updatedDoors: DoorElement[];
  updatedWindows: WindowElement[];
} {
  const adjustedWalls = new Map<string, { start?: Point2D; end?: Point2D }>();
  if (disjoin || (delta.x === 0 && delta.y === 0) || movedWallIds.length === 0) {
    return { adjustedWalls, updatedDoors: [], updatedWindows: [] };
  }

  const movedIdSet = new Set(movedWallIds);
  const movedWalls = allWalls.filter((w) => movedIdSet.has(w.id));
  const staticWalls = allWalls.filter((w) => !movedIdSet.has(w.id));

  const CORNER_THRESHOLD = 0.12; // 12cm para cantos em L

  for (const staticW of staticWalls) {
    let newStart: Point2D | undefined;
    let newEnd: Point2D | undefined;

    for (const movedW of movedWalls) {
      const movedStartNext: Point2D = { x: movedW.start.x + delta.x, y: movedW.start.y + delta.y };
      const movedEndNext: Point2D = { x: movedW.end.x + delta.x, y: movedW.end.y + delta.y };

      // 1. CHECA START DA PAREDE ESTÁTICA
      if (!newStart) {
        // A. Canto em L no Start
        if (distance(staticW.start, movedW.start) <= CORNER_THRESHOLD) {
          newStart = { ...movedStartNext };
        } else if (distance(staticW.start, movedW.end) <= CORNER_THRESHOLD) {
          newStart = { ...movedEndNext };
        } else {
          // B. Encontro em T no Start: ponta de staticW toca o corpo de movedW
          const tDist = distToSegment(staticW.start, movedW.start, movedW.end);
          if (tDist <= movedW.thickness / 2 + 0.10) {
            // Estica ao longo do alinhamento reto de staticW para encontrar a nova linha de movedW
            const fixedEnd = newEnd || staticW.end;
            const stemDir = {
              x: staticW.start.x - fixedEnd.x,
              y: staticW.start.y - fixedEnd.y,
            };
            const stemLen = Math.hypot(stemDir.x, stemDir.y) || 1;
            const stemUnit = { x: stemDir.x / stemLen, y: stemDir.y / stemLen };

            const movedLineDir = {
              x: movedEndNext.x - movedStartNext.x,
              y: movedEndNext.y - movedStartNext.y,
            };

            const inter = lineLineIntersection(fixedEnd, stemUnit, movedStartNext, movedLineDir);
            if (inter) {
              newStart = inter;
            } else {
              newStart = { x: staticW.start.x + delta.x, y: staticW.start.y + delta.y };
            }
          }
        }
      }

      // 2. CHECA END DA PAREDE ESTÁTICA
      if (!newEnd) {
        // A. Canto em L no End
        if (distance(staticW.end, movedW.start) <= CORNER_THRESHOLD) {
          newEnd = { ...movedStartNext };
        } else if (distance(staticW.end, movedW.end) <= CORNER_THRESHOLD) {
          newEnd = { ...movedEndNext };
        } else {
          // B. Encontro em T no End: ponta de staticW toca o corpo de movedW
          const tDist = distToSegment(staticW.end, movedW.start, movedW.end);
          if (tDist <= movedW.thickness / 2 + 0.10) {
            const fixedStart = newStart || staticW.start;
            const stemDir = {
              x: staticW.end.x - fixedStart.x,
              y: staticW.end.y - fixedStart.y,
            };
            const stemLen = Math.hypot(stemDir.x, stemDir.y) || 1;
            const stemUnit = { x: stemDir.x / stemLen, y: stemDir.y / stemLen };

            const movedLineDir = {
              x: movedEndNext.x - movedStartNext.x,
              y: movedEndNext.y - movedStartNext.y,
            };

            const inter = lineLineIntersection(fixedStart, stemUnit, movedStartNext, movedLineDir);
            if (inter) {
              newEnd = inter;
            } else {
              newEnd = { x: staticW.end.x + delta.x, y: staticW.end.y + delta.y };
            }
          }
        }
      }
    }

    if (newStart || newEnd) {
      adjustedWalls.set(staticW.id, { start: newStart, end: newEnd });
    }
  }

  // Recalcular offsetRatio de esquadrias nas paredes estáticas que foram esticadas
  const updatedDoors: DoorElement[] = [];
  const updatedWindows: WindowElement[] = [];

  for (const [wallId, adjustment] of adjustedWalls.entries()) {
    const origWall = allWalls.find((w) => w.id === wallId);
    if (!origWall) continue;

    const finalStart = adjustment.start || origWall.start;
    const finalEnd = adjustment.end || origWall.end;
    const newDx = finalEnd.x - finalStart.x;
    const newDy = finalEnd.y - finalStart.y;
    const newLen = Math.hypot(newDx, newDy) || 1;

    // Portas
    doors
      .filter((d) => d.wallId === wallId)
      .forEach((d) => {
        const origWorld = {
          x: origWall.start.x + (origWall.end.x - origWall.start.x) * d.offsetRatio,
          y: origWall.start.y + (origWall.end.y - origWall.start.y) * d.offsetRatio,
        };
        const t =
          ((origWorld.x - finalStart.x) * newDx + (origWorld.y - finalStart.y) * newDy) /
          (newLen * newLen);
        const halfW = d.width / 2 / newLen;
        const clamped = Math.max(halfW, Math.min(1 - halfW, t));
        updatedDoors.push({ ...d, offsetRatio: clamped });
      });

    // Janelas
    windows
      .filter((w) => w.wallId === wallId)
      .forEach((w) => {
        const origWorld = {
          x: origWall.start.x + (origWall.end.x - origWall.start.x) * w.offsetRatio,
          y: origWall.start.y + (origWall.end.y - origWall.start.y) * w.offsetRatio,
        };
        const t =
          ((origWorld.x - finalStart.x) * newDx + (origWorld.y - finalStart.y) * newDy) /
          (newLen * newLen);
        const halfW = w.width / 2 / newLen;
        const clamped = Math.max(halfW, Math.min(1 - halfW, t));
        updatedWindows.push({ ...w, offsetRatio: clamped });
      });
  }

  return { adjustedWalls, updatedDoors, updatedWindows };
}

export interface MovementSnapResult {
  delta: Point2D;
  isSnapped: boolean;
  guideAxis?: {
    start: Point2D;
    end: Point2D;
    label: string;
  };
}

/**
 * Trava e atrai magneticamente o vetor de movimento para manter paredes 100% retas (sem entortar cantos).
 * Prioriza perpendicular à parede selecionada, alinhamento axial com paredes conectadas e eixos ortogonais.
 */
export function snapMovementVector(
  rawDelta: Point2D,
  startWorld: Point2D,
  selectedWallIds: string[],
  allWalls: WallElement[],
  pixelsPerMeter: number,
  isShiftPressed: boolean = false,
  isOrthoMode: boolean = false
): MovementSnapResult {
  const moveLen = Math.hypot(rawDelta.x, rawDelta.y);
  if (moveLen < 0.02) {
    return { delta: rawDelta, isSnapped: false };
  }

  // Candidatos a direções unitárias de alinhamento
  const candidates: { unit: Point2D; label: string; priority: number }[] = [
    { unit: { x: 1, y: 0 }, label: 'Ortogonal (X)', priority: 1 },
    { unit: { x: 0, y: 1 }, label: 'Ortogonal (Y)', priority: 1 },
  ];

  const selWalls = allWalls.filter((w) => selectedWallIds.includes(w.id));

  // 1. Direções das paredes selecionadas (perpendicular e paralela)
  for (const w of selWalls) {
    const dx = w.end.x - w.start.x;
    const dy = w.end.y - w.start.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.05) {
      const u = { x: dx / len, y: dy / len };
      const n = { x: -dy / len, y: dx / len };
      candidates.push({ unit: n, label: 'Perpendicular (90°)', priority: 2 });
      candidates.push({ unit: u, label: 'Paralelo à Parede', priority: 2 });
    }
  }

  // 2. Direções das paredes conectadas (para manter alinhamento reto sem inclinação)
  const selIdSet = new Set(selectedWallIds);
  const staticWalls = allWalls.filter((w) => !selIdSet.has(w.id));
  for (const staticW of staticWalls) {
    for (const movedW of selWalls) {
      const touches =
        distance(staticW.start, movedW.start) <= 0.15 ||
        distance(staticW.start, movedW.end) <= 0.15 ||
        distance(staticW.end, movedW.start) <= 0.15 ||
        distance(staticW.end, movedW.end) <= 0.15 ||
        distToSegment(staticW.start, movedW.start, movedW.end) <= movedW.thickness / 2 + 0.12 ||
        distToSegment(staticW.end, movedW.start, movedW.end) <= movedW.thickness / 2 + 0.12;

      if (touches) {
        const dx = staticW.end.x - staticW.start.x;
        const dy = staticW.end.y - staticW.start.y;
        const len = Math.hypot(dx, dy);
        if (len > 0.05) {
          const u = { x: dx / len, y: dy / len };
          candidates.push({ unit: u, label: 'Alinhamento Reto (Parede Conectada)', priority: 3 });
        }
      }
    }
  }

  // Filtrar direções quase colineares
  const uniqueCandidates: { unit: Point2D; label: string; priority: number }[] = [];
  for (const cand of candidates) {
    const isDup = uniqueCandidates.some(
      (existing) =>
        Math.abs(existing.unit.x * cand.unit.y - existing.unit.y * cand.unit.x) < 1e-4
    );
    if (!isDup) {
      uniqueCandidates.push(cand);
    }
  }

  // Encontrar o melhor alinhamento com menor desvio
  let bestCandidate: { unit: Point2D; label: string; snappedDelta: Point2D; devPx: number } | null = null;

  for (const cand of uniqueCandidates) {
    const proj = rawDelta.x * cand.unit.x + rawDelta.y * cand.unit.y;
    const snappedDelta: Point2D = {
      x: proj * cand.unit.x,
      y: proj * cand.unit.y,
    };
    const dev = Math.hypot(rawDelta.x - snappedDelta.x, rawDelta.y - snappedDelta.y);
    const devPx = dev * pixelsPerMeter;

    if (!bestCandidate || devPx < bestCandidate.devPx) {
      bestCandidate = { unit: cand.unit, label: cand.label, snappedDelta, devPx };
    }
  }

  if (!bestCandidate) {
    return { delta: rawDelta, isSnapped: false };
  }

  // Tolerância generosa de 26 pixels na tela para atração magnética (ou total se Shift/Ortho estiver ativo)
  const SNAP_THRESHOLD_PX = isShiftPressed || isOrthoMode ? Infinity : 26;

  if (bestCandidate.devPx <= SNAP_THRESHOLD_PX) {
    const guideLen = 25;
    return {
      delta: bestCandidate.snappedDelta,
      isSnapped: true,
      guideAxis: {
        start: {
          x: startWorld.x - bestCandidate.unit.x * guideLen,
          y: startWorld.y - bestCandidate.unit.y * guideLen,
        },
        end: {
          x: startWorld.x + bestCandidate.unit.x * guideLen,
          y: startWorld.y + bestCandidate.unit.y * guideLen,
        },
        label: bestCandidate.label,
      },
    };
  }

  return { delta: rawDelta, isSnapped: false };
}

