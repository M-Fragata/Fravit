import { jsPDF } from 'jspdf';
import type { Sheet, WallElement, DoorElement, WindowElement, DimensionElement, RoomElement } from '../cad-core/types';

export const SHEET_DIMENSIONS = {
  A1: { width: 841, height: 594, leftMargin: 25, otherMargin: 10 },
  A2: { width: 594, height: 420, leftMargin: 25, otherMargin: 7 },
  A3: { width: 420, height: 297, leftMargin: 25, otherMargin: 7 },
  A4: { width: 210, height: 297, leftMargin: 25, otherMargin: 7 },
};

export const SCALE_RATIOS: Record<string, number> = {
  '1:25': 40, // 1m = 40mm no papel
  '1:50': 20, // 1m = 20mm no papel
  '1:100': 10, // 1m = 10mm no papel
  '1:200': 5, // 1m = 5mm no papel
};

export const pdfExportService = {
  exportSheetToPDF: (
    sheet: Sheet,
    elements: {
      walls: WallElement[];
      doors: DoorElement[];
      windows: WindowElement[];
      dimensions: DimensionElement[];
      rooms: RoomElement[];
    }
  ) => {
    const dim = SHEET_DIMENSIONS[sheet.size] || SHEET_DIMENSIONS.A1;
    const isLandscape = sheet.orientation === 'landscape';
    const pageWidth = isLandscape ? Math.max(dim.width, dim.height) : Math.min(dim.width, dim.height);
    const pageHeight = isLandscape ? Math.min(dim.width, dim.height) : Math.max(dim.width, dim.height);

    const doc = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pageWidth, pageHeight],
    });

    const leftM = dim.leftMargin;
    const topM = dim.otherMargin;
    const rightM = pageWidth - dim.otherMargin;
    const bottomM = pageHeight - dim.otherMargin;

    // 1. Margem Externa / Folha (borda de corte)
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(0, 0, pageWidth, pageHeight);

    // 2. Margem Interna Normativa NBR 6492 (Margem esquerda 25mm para fixação)
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.5);
    doc.rect(leftM, topM, rightM - leftM, bottomM - topM);

    // 3. Carimbo / Selo Técnico NBR no canto inferior direito
    const stampWidth = Math.min(178, rightM - leftM - 10);
    const stampHeight = 65;
    const stampX = rightM - stampWidth;
    const stampY = bottomM - stampHeight;

    doc.setLineWidth(0.4);
    doc.rect(stampX, stampY, stampWidth, stampHeight);

    // Divisões do Carimbo
    doc.line(stampX, stampY + 14, stampX + stampWidth, stampY + 14);
    doc.line(stampX, stampY + 28, stampX + stampWidth, stampY + 28);
    doc.line(stampX, stampY + 44, stampX + stampWidth, stampY + 44);

    doc.line(stampX + stampWidth * 0.65, stampY + 28, stampX + stampWidth * 0.65, stampY + stampHeight);
    doc.line(stampX + stampWidth * 0.35, stampY + 44, stampX + stampWidth * 0.35, stampY + stampHeight);

    // Textos do Carimbo
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(sheet.stamp.projectTitle || 'PROJETO ARQUITETÔNICO', stampX + 4, stampY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('PROPRIETÁRIO / CLIENTE:', stampX + 4, stampY + 19);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(sheet.stamp.clientName || 'CLIENTE', stampX + 4, stampY + 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('CONTEÚDO:', stampX + 4, stampY + 33);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(sheet.stamp.sheetTitle || 'PLANTAS, CORTES E QUADROS', stampX + 4, stampY + 39);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('RESPONSÁVEL TÉCNICO / AUTOR:', stampX + stampWidth * 0.65 + 3, stampY + 33);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(sheet.stamp.authorName || 'FRAVIT BIM', stampX + stampWidth * 0.65 + 3, stampY + 39);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('DATA:', stampX + 4, stampY + 49);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(sheet.stamp.date || new Date().toLocaleDateString('pt-BR'), stampX + 4, stampY + 56);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('ESCALA:', stampX + stampWidth * 0.35 + 3, stampY + 49);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(sheet.stamp.scale || 'INDICADA', stampX + stampWidth * 0.35 + 3, stampY + 56);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('PRANCHA:', stampX + stampWidth * 0.65 + 3, stampY + 49);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(sheet.stamp.sheetNumber || '01/01', stampX + stampWidth * 0.65 + 3, stampY + 58);

    // 4. Renderização das Viewports na Folha
    sheet.viewports.forEach((vp, vpIndex) => {
      const vpX = leftM + (vp.x || 30);
      const vpY = topM + (vp.y || 30);
      const vpW = vp.width || 300;
      const vpH = vp.height || 220;
      const mmPerMeter = SCALE_RATIOS[vp.scale] || 20;

      // Moldura da Viewport (tracejado fino de referência)
      doc.setDrawColor(210, 215, 220);
      doc.setLineWidth(0.15);
      doc.setLineDashPattern([2, 2], 0);
      doc.rect(vpX, vpY, vpW, vpH);
      doc.setLineDashPattern([], 0);

      // Centro geométrico da viewport para projeção do modelo
      const centerX = vpX + vpW / 2;
      const centerY = vpY + vpH / 2;

      // Desenho dos Elementos da Planta Baixa na Escala
      if (vp.type === 'plan') {
        // Paredes com Linhas Fortes de Corte NBR
        doc.setDrawColor(0, 0, 0);
        doc.setFillColor(30, 40, 50);

        elements.walls.forEach((wall) => {
          const wStartX = centerX + wall.start.x * mmPerMeter;
          const wStartY = centerY - wall.start.y * mmPerMeter;
          const wEndX = centerX + wall.end.x * mmPerMeter;
          const wEndY = centerY - wall.end.y * mmPerMeter;

          doc.setLineWidth(0.5);
          doc.line(wStartX, wStartY, wEndX, wEndY);
        });

        // Portas (Folha + Arco de Giro)
        elements.doors.forEach((door) => {
          const host = elements.walls.find((w) => w.id === door.wallId);
          if (!host) return;
          const dx = host.end.x - host.start.x;
          const dy = host.end.y - host.start.y;
          const len = Math.hypot(dx, dy);
          if (len < 0.1) return;

          const ux = dx / len;
          const uy = dy / len;
          const doorCx = host.start.x + ux * (door.offsetRatio * len);
          const doorCy = host.start.y + uy * (door.offsetRatio * len);
          const halfW = door.width / 2;

          const isLeft = !door.flipHand;
          const hX = isLeft ? doorCx - ux * halfW : doorCx + ux * halfW;
          const hY = isLeft ? doorCy - uy * halfW : doorCy + uy * halfW;

          const screenHX = centerX + hX * mmPerMeter;
          const screenHY = centerY - hY * mmPerMeter;

          const facing = door.flipFacing ? -1 : 1;
          const endX = hX + -uy * (door.width * facing);
          const endY = hY + ux * (door.width * facing);

          doc.setLineWidth(0.25);
          doc.setDrawColor(0, 0, 0);
          doc.line(screenHX, screenHY, centerX + endX * mmPerMeter, centerY - endY * mmPerMeter);
        });

        // Janelas (Linhas de Batente e Vidro)
        elements.windows.forEach((win) => {
          const host = elements.walls.find((w) => w.id === win.wallId);
          if (!host) return;
          const dx = host.end.x - host.start.x;
          const dy = host.end.y - host.start.y;
          const len = Math.hypot(dx, dy);
          if (len < 0.1) return;

          const ux = dx / len;
          const uy = dy / len;
          const winCx = host.start.x + ux * (win.offsetRatio * len);
          const winCy = host.start.y + uy * (win.offsetRatio * len);
          const halfW = win.width / 2;

          const p1X = centerX + (winCx - ux * halfW) * mmPerMeter;
          const p1Y = centerY - (winCy - uy * halfW) * mmPerMeter;
          const p2X = centerX + (winCx + ux * halfW) * mmPerMeter;
          const p2Y = centerY - (winCy + uy * halfW) * mmPerMeter;

          doc.setLineWidth(0.3);
          doc.setDrawColor(0, 100, 180);
          doc.line(p1X, p1Y, p2X, p2Y);
        });

        // Cotas no Padrão Revit
        elements.dimensions
          .filter((d) => !d.view || d.view === 'plan')
          .forEach((dim) => {
            const dx = dim.end.x - dim.start.x;
            const dy = dim.end.y - dim.start.y;
            const len = Math.hypot(dx, dy);
            if (len < 0.05) return;

            const ux = dx / len;
            const uy = dy / len;
            const nx = -uy;
            const ny = ux;
            const offset = dim.offset || 0.4;

            const c1X = centerX + (dim.start.x + nx * offset) * mmPerMeter;
            const c1Y = centerY - (dim.start.y + ny * offset) * mmPerMeter;
            const c2X = centerX + (dim.end.x + nx * offset) * mmPerMeter;
            const c2Y = centerY - (dim.end.y + ny * offset) * mmPerMeter;

            doc.setLineWidth(0.2);
            doc.setDrawColor(0, 100, 160);
            doc.line(c1X, c1Y, c2X, c2Y);

            // Ticks a 45°
            doc.setLineWidth(0.4);
            doc.line(c1X - 1.2, c1Y + 1.2, c1X + 1.2, c1Y - 1.2);
            doc.line(c2X - 1.2, c2Y + 1.2, c2X + 1.2, c2Y - 1.2);

            // Texto sem 'm'
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(0, 80, 140);
            doc.text(len.toFixed(2), (c1X + c2X) / 2, (c1Y + c2Y) / 2 - 1.2, { align: 'center' });
          });

        // Tags de Cômodos com Área m²
        elements.rooms.forEach((room) => {
          if (room.polygon.length < 3) return;
          const cx = room.polygon.reduce((acc, p) => acc + p.x, 0) / room.polygon.length;
          const cy = room.polygon.reduce((acc, p) => acc + p.y, 0) / room.polygon.length;

          const tX = centerX + cx * mmPerMeter;
          const tY = centerY - cy * mmPerMeter;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 30, 30);
          doc.text(room.name.toUpperCase(), tX, tY, { align: 'center' });

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(50, 120, 50);
          doc.text(`${room.areaM2.toFixed(2)} m²`, tX, tY + 3.5, { align: 'center' });
        });
      }

      // Rótulo Técnico Inferior da Viewport (NBR 6492)
      const labelY = vpY + vpH + 7;
      const numStr = String(vpIndex + 1).padStart(2, '0');

      doc.setLineWidth(0.35);
      doc.setDrawColor(30, 30, 30);
      doc.circle(vpX + 4, labelY, 3.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text(numStr, vpX + 4, labelY + 1, { align: 'center' });

      doc.setFontSize(9);
      doc.text(vp.name.toUpperCase(), vpX + 11, labelY - 0.5);

      // Linha horizontal de extensão do título
      const titleWidth = doc.getTextWidth(vp.name.toUpperCase());
      const lineEndX = Math.min(vpX + vpW, vpX + 11 + titleWidth + 40);
      doc.setLineWidth(0.3);
      doc.line(vpX + 11, labelY + 1.2, lineEndX, labelY + 1.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`ESCALA ${vp.scale}`, vpX + 11, labelY + 5);
    });

    // 5. Quadro de Quantitativos Opcional (Tabela de Esquadrias e Ambientes)
    if (sheet.showSchedules) {
      const schX = sheet.schedulePosition?.x ? leftM + sheet.schedulePosition.x : rightM - stampWidth;
      const schY = sheet.schedulePosition?.y ? topM + sheet.schedulePosition.y : topM + 15;
      const schW = stampWidth;

      doc.setLineWidth(0.35);
      doc.setDrawColor(30, 30, 30);
      doc.setFillColor(245, 247, 250);
      doc.rect(schX, schY, schW, 7, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text('QUADRO DE ESQUADRIAS', schX + schW / 2, schY + 5, { align: 'center' });

      // Cabeçalho da Tabela
      doc.setFillColor(235, 240, 245);
      doc.rect(schX, schY + 7, schW, 5.5, 'FD');
      doc.setFontSize(6.5);
      doc.text('CÓD', schX + 4, schY + 11);
      doc.text('TIPO', schX + 22, schY + 11);
      doc.text('LARG (cm)', schX + 55, schY + 11);
      doc.text('ALT (cm)', schX + 90, schY + 11);
      doc.text('PEIT (cm)', schX + 125, schY + 11);
      doc.text('QTD', schX + 158, schY + 11);

      // Dados de Portas Agrupadas
      let rowY = schY + 12.5;
      const doorGroups = new Map<string, { count: number; width: number; height: number }>();
      elements.doors.forEach((d) => {
        const key = `${Math.round(d.width * 100)}x${Math.round(d.height * 100)}`;
        const existing = doorGroups.get(key) || { count: 0, width: d.width, height: d.height };
        existing.count += 1;
        doorGroups.set(key, existing);
      });

      let pIndex = 1;
      doorGroups.forEach((val) => {
        doc.line(schX, rowY, schX + schW, rowY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text(`P${pIndex++}`, schX + 4, rowY + 3.8);
        doc.text('Porta de Abrir', schX + 22, rowY + 3.8);
        doc.text(`${Math.round(val.width * 100)}`, schX + 55, rowY + 3.8);
        doc.text(`${Math.round(val.height * 100)}`, schX + 90, rowY + 3.8);
        doc.text('0', schX + 125, rowY + 3.8);
        doc.text(`${val.count}`, schX + 158, rowY + 3.8);
        rowY += 5;
      });

      // Dados de Janelas Agrupadas
      const winGroups = new Map<string, { count: number; width: number; height: number; sill: number }>();
      elements.windows.forEach((w) => {
        const key = `${Math.round(w.width * 100)}x${Math.round(w.height * 100)}x${Math.round(w.sillHeight * 100)}`;
        const existing = winGroups.get(key) || { count: 0, width: w.width, height: w.height, sill: w.sillHeight };
        existing.count += 1;
        winGroups.set(key, existing);
      });

      let jIndex = 1;
      winGroups.forEach((val) => {
        doc.line(schX, rowY, schX + schW, rowY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text(`J${jIndex++}`, schX + 4, rowY + 3.8);
        doc.text('Janela de Correr', schX + 22, rowY + 3.8);
        doc.text(`${Math.round(val.width * 100)}`, schX + 55, rowY + 3.8);
        doc.text(`${Math.round(val.height * 100)}`, schX + 90, rowY + 3.8);
        doc.text(`${Math.round(val.sill * 100)}`, schX + 125, rowY + 3.8);
        doc.text(`${val.count}`, schX + 158, rowY + 3.8);
        rowY += 5;
      });

      // Borda total da tabela
      doc.setLineWidth(0.35);
      doc.rect(schX, schY, schW, rowY - schY);
    }

    // Salva o PDF
    const safeTitle = (sheet.stamp.projectTitle || 'Projeto_Fravit').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeTitle}_Prancha_${sheet.stamp.sheetNumber || '01'}.pdf`;
    doc.save(filename);
  },
};
