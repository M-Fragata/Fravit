import type { Point2D } from '../types';

export interface RevitDimensionStyle {
  color?: string; // Cor das linhas (default: '#38bdf8')
  textColor?: string; // Cor do texto (default: '#f8fafc')
  dimOvershoot?: number; // Prolongamento da linha de dimensão em pixels (default: 8)
  extOvershoot?: number; // Prolongamento da linha de extensão em pixels (default: 8)
  tickSize?: number; // Meio tamanho do tick a 45° em pixels (default: 6)
  tickWidth?: number; // Espessura do tick (default: 2.2)
  lineWidth?: number; // Espessura das linhas (default: 1.0)
  textOffset?: number; // Distância do texto acima da linha em pixels (default: 8)
  fontSize?: number; // Tamanho da fonte em pixels (default: 12)
  extraNote?: string; // Nota extra opcional abaixo do número (ex: dica durante comando)
}

/**
 * Desenha cotas técnicas estritamente alinhadas ao padrão Autodesk Revit / NBR:
 * - Linha de dimensão contínua com overshoot passando dos ticks
 * - Linhas de extensão contínuas com overshoot passando além da linha de dimensão
 * - Ticks arquitetônicos a 45° nítidos e mais grossos nas interseções
 * - Valor numérico limpo flutuando acima da linha (sem sufixo 'm', sem caixa/pill de fundo)
 */
export function drawRevitDimension(
  ctx: CanvasRenderingContext2D,
  s1: Point2D,
  s2: Point2D,
  sc1: Point2D,
  sc2: Point2D,
  distVal: number,
  style?: RevitDimensionStyle
): void {
  const color = style?.color ?? '#38bdf8';
  const textColor = style?.textColor ?? '#f8fafc';
  const dimOvershoot = style?.dimOvershoot ?? 8;
  const extOvershoot = style?.extOvershoot ?? 8;
  const tickSize = style?.tickSize ?? 6;
  const tickWidth = style?.tickWidth ?? 2.2;
  const lineWidth = style?.lineWidth ?? 1.0;
  const textOffset = style?.textOffset ?? 8;
  const fontSize = style?.fontSize ?? 12;

  const dx = sc2.x - sc1.x;
  const dy = sc2.y - sc1.y;
  const lenDim = Math.hypot(dx, dy);
  if (lenDim < 1) return;

  const ux = dx / lenDim;
  const uy = dy / lenDim;

  // Direção de extensão (de s1 para sc1)
  const extDx = sc1.x - s1.x;
  const extDy = sc1.y - s1.y;
  const extLen = Math.hypot(extDx, extDy);
  // Se sc1 e s1 forem praticamente coincidentes, usa a normal (-uy, ux)
  const extUx = extLen > 0.5 ? extDx / extLen : -uy;
  const extUy = extLen > 0.5 ? extDy / extLen : ux;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  // 1. Linhas de extensão contínuas com overshoot além da linha de dimensão
  ctx.beginPath();
  ctx.moveTo(s1.x, s1.y);
  ctx.lineTo(sc1.x + extUx * extOvershoot, sc1.y + extUy * extOvershoot);
  ctx.moveTo(s2.x, s2.y);
  ctx.lineTo(sc2.x + extUx * extOvershoot, sc2.y + extUy * extOvershoot);
  ctx.stroke();

  // 2. Linha de dimensão contínua com overshoot além dos ticks
  ctx.beginPath();
  ctx.moveTo(sc1.x - ux * dimOvershoot, sc1.y - uy * dimOvershoot);
  ctx.lineTo(sc2.x + ux * dimOvershoot, sc2.y + uy * dimOvershoot);
  ctx.stroke();

  // 3. Ticks arquitetônicos a 45° nítidos e mais grossos nas interseções
  ctx.lineWidth = tickWidth;
  ctx.beginPath();
  ctx.moveTo(sc1.x - tickSize, sc1.y + tickSize);
  ctx.lineTo(sc1.x + tickSize, sc1.y - tickSize);
  ctx.moveTo(sc2.x - tickSize, sc2.y + tickSize);
  ctx.lineTo(sc2.x + tickSize, sc2.y - tickSize);
  ctx.stroke();

  // 4. Valor numérico puro no estilo Revit (ex: 2.90, sem 'm', sem fundo, posicionado acima)
  const midX = (sc1.x + sc2.x) / 2;
  const midY = (sc1.y + sc2.y) / 2;
  const label = distVal.toFixed(2);

  const textX = midX + extUx * textOffset;
  const textY = midY + extUy * textOffset;

  let angle = Math.atan2(dy, dx);
  // Mantém o texto sempre legível para leitura natural (sem ponta-cabeça)
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
    angle += Math.PI;
  }

  ctx.translate(textX, textY);
  ctx.rotate(angle);
  ctx.font = `500 ${fontSize}px "Inter", -apple-system, sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);

  if (style?.extraNote) {
    ctx.font = `500 10px "Inter", sans-serif`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(style.extraNote, 0, 14);
  }

  ctx.restore();
}
