import React, { useState, useRef, useMemo } from 'react';
import {
  Download,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Table,
  Move,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useBIM, bimStore } from '../../cad-core/engine/bimStore';
import type {
  Sheet,
  SheetViewport,
  SheetSize,
  SheetOrientation,
  ViewportScale,
} from '../../cad-core/types';
import {
  pdfExportService,
  SHEET_DIMENSIONS,
  SCALE_RATIOS,
} from '../../services/pdfExportService';

export const SheetView: React.FC = () => {
  const state = useBIM();
  const { sheets, activeSheetId, elements, levels } = state;

  const currentSheet: Sheet =
    sheets.find((s) => s.id === activeSheetId) || sheets[0];

  // Fator de zoom da prancha na tela (pixels por milímetro de papel)
  const [zoomMm, setZoomMm] = useState<number>(0.85);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showAddViewMenu, setShowAddViewMenu] = useState<boolean>(false);
  const [selectedVpId, setSelectedVpId] = useState<string | null>(null);

  // Arraste de Viewports na prancha
  const [draggingVpId, setDraggingVpId] = useState<string | null>(null);
  const dragStartPosRef = useRef<{ mouseX: number; mouseY: number; vpX: number; vpY: number }>({
    mouseX: 0,
    mouseY: 0,
    vpX: 0,
    vpY: 0,
  });

  // Dimensões nominais em mm da folha atual
  const dim = SHEET_DIMENSIONS[currentSheet?.size || 'A1'];
  const isLandscape = currentSheet?.orientation === 'landscape';
  const sheetWidthMm = isLandscape ? Math.max(dim.width, dim.height) : Math.min(dim.width, dim.height);
  const sheetHeightMm = isLandscape ? Math.min(dim.width, dim.height) : Math.max(dim.width, dim.height);

  const leftMarginMm = dim.leftMargin;
  const otherMarginMm = dim.otherMargin;
  const rightMarginMm = sheetWidthMm - otherMarginMm;
  const bottomMarginMm = sheetHeightMm - otherMarginMm;

  // Carimbo no canto inferior direito
  const stampWidthMm = Math.min(178, rightMarginMm - leftMarginMm - 10);
  const stampHeightMm = 65;
  const stampXMm = rightMarginMm - stampWidthMm;
  const stampYMm = bottomMarginMm - stampHeightMm;

  // Agrupamento de quantitativos para a tabela de esquadrias
  const doorSchedule = useMemo(() => {
    const map = new Map<string, { code: string; width: number; height: number; count: number }>();
    let pIdx = 1;
    elements.doors.forEach((d) => {
      const key = `${Math.round(d.width * 100)}x${Math.round(d.height * 100)}`;
      if (!map.has(key)) {
        map.set(key, { code: `P${pIdx++}`, width: d.width, height: d.height, count: 0 });
      }
      map.get(key)!.count += 1;
    });
    return Array.from(map.values());
  }, [elements.doors]);

  const windowSchedule = useMemo(() => {
    const map = new Map<string, { code: string; width: number; height: number; sill: number; count: number }>();
    let jIdx = 1;
    elements.windows.forEach((w) => {
      const key = `${Math.round(w.width * 100)}x${Math.round(w.height * 100)}x${Math.round(w.sillHeight * 100)}`;
      if (!map.has(key)) {
        map.set(key, { code: `J${jIdx++}`, width: w.width, height: w.height, sill: w.sillHeight, count: 0 });
      }
      map.get(key)!.count += 1;
    });
    return Array.from(map.values());
  }, [elements.windows]);

  // Manipulação de Arraste da Viewport
  const handlePointerDownVp = (e: React.PointerEvent, vp: SheetViewport) => {
    e.stopPropagation();
    setSelectedVpId(vp.id);
    setDraggingVpId(vp.id);
    dragStartPosRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      vpX: vp.x,
      vpY: vp.y,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMoveVp = (e: React.PointerEvent) => {
    if (!draggingVpId || !currentSheet) return;
    const dxPx = e.clientX - dragStartPosRef.current.mouseX;
    const dyPx = e.clientY - dragStartPosRef.current.mouseY;

    const dxMm = dxPx / zoomMm;
    const dyMm = dyPx / zoomMm;

    const newX = Math.round(dragStartPosRef.current.vpX + dxMm);
    const newY = Math.round(dragStartPosRef.current.vpY + dyMm);

    bimStore.updateViewport(currentSheet.id, draggingVpId, {
      x: Math.max(10, Math.min(sheetWidthMm - 100, newX)),
      y: Math.max(10, Math.min(sheetHeightMm - 80, newY)),
    });
  };

  const handlePointerUpVp = (e: React.PointerEvent) => {
    if (draggingVpId) {
      setDraggingVpId(null);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Exportação em PDF Real
  const handleExportPDF = () => {
    if (!currentSheet) return;
    setIsExporting(true);
    try {
      pdfExportService.exportSheetToPDF(currentSheet, elements);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
    } finally {
      setTimeout(() => setIsExporting(false), 600);
    }
  };

  // Adicionar Viewport
  const handleAddViewport = (type: 'plan' | 'section' | '3d', targetId?: string, name?: string) => {
    if (!currentSheet) return;
    const newVp: SheetViewport = {
      id: `vp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      targetId,
      name: name || (type === 'plan' ? 'Planta Baixa' : type === 'section' ? 'Corte' : 'Vista 3D'),
      scale: '1:50',
      x: 35 + currentSheet.viewports.length * 20,
      y: 35 + currentSheet.viewports.length * 20,
      width: 360,
      height: 240,
    };
    bimStore.addViewportToSheet(currentSheet.id, newVp);
    setShowAddViewMenu(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#090d16' }}>
      {/* 1. Barra Superior de Controle da Prancha */}
      <div
        style={{
          height: '46px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          gap: 12,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Seletor de Prancha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={15} color="var(--cad-cyan)" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
              {currentSheet?.name || 'Prancha A101'}
            </span>
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-color)' }} />

          {/* Formato da Folha (A1, A2, A3, A4) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Tamanho:</span>
            <select
              value={currentSheet?.size || 'A1'}
              onChange={(e) =>
                currentSheet && bimStore.updateSheet(currentSheet.id, { size: e.target.value as SheetSize })
              }
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 600,
                outline: 'none',
              }}
            >
              <option value="A1">A1 (841 x 594 mm)</option>
              <option value="A2">A2 (594 x 420 mm)</option>
              <option value="A3">A3 (420 x 297 mm)</option>
              <option value="A4">A4 (210 x 297 mm)</option>
            </select>
          </div>

          {/* Orientação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Orientação:</span>
            <select
              value={currentSheet?.orientation || 'landscape'}
              onChange={(e) =>
                currentSheet &&
                bimStore.updateSheet(currentSheet.id, { orientation: e.target.value as SheetOrientation })
              }
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 600,
                outline: 'none',
              }}
            >
              <option value="landscape">Paisagem</option>
              <option value="portrait">Retrato</option>
            </select>
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-color)' }} />

          {/* Inserir Vista (Dropdown) */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAddViewMenu((prev) => !prev)}
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                color: 'var(--cad-cyan)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Plus size={13} />
              <span>Inserir Vista</span>
              <ChevronDown size={11} />
            </button>

            {showAddViewMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  minWidth: '200px',
                  zIndex: 100,
                  padding: '6px',
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px' }}>
                  PLANTAS BAIXAS
                </div>
                {levels.map((lvl) => (
                  <button
                    key={lvl.id}
                    onClick={() => handleAddViewport('plan', lvl.id, `PLANTA BAIXA - ${lvl.name.toUpperCase()}`)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-main)',
                      fontSize: '11px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {lvl.name} (Cota {lvl.elevation.toFixed(2)}m)
                  </button>
                ))}

                {elements.sections.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', padding: '6px 8px 4px' }}>
                      CORTES PARAMÉTRICOS
                    </div>
                    {elements.sections.map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => handleAddViewport('section', sec.id, `CORTE ${sec.name || 'A-A'}`)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '6px 8px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-main)',
                          fontSize: '11px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        Corte {sec.name || 'A-A'}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Toggle Tabelas de Quantitativos */}
          <button
            onClick={() =>
              currentSheet &&
              bimStore.updateSheet(currentSheet.id, { showSchedules: !currentSheet.showSchedules })
            }
            style={{
              background: currentSheet?.showSchedules ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
              color: currentSheet?.showSchedules ? '#4ade80' : 'var(--text-muted)',
              border: `1px solid ${currentSheet?.showSchedules ? '#22c55e' : 'var(--border-color)'}`,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Table size={13} />
            <span>Quadros de Esquadrias</span>
          </button>
        </div>

        {/* Controles de Zoom e Exportar PDF */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              onClick={() => setZoomMm((prev) => Math.max(0.3, prev - 0.1))}
              title="Diminuir Zoom"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '4px',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={() => setZoomMm(0.85)}
              title="Ajustar"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '4px 6px',
                borderRadius: '3px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              <Maximize2 size={12} />
            </button>
            <button
              onClick={() => setZoomMm((prev) => Math.min(2.0, prev + 0.1))}
              title="Aumentar Zoom"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '4px',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              <ZoomIn size={13} />
            </button>
          </div>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
            }}
          >
            <Download size={14} />
            <span>{isExporting ? 'Gerando PDF...' : 'Exportar PDF 1:1'}</span>
          </button>
        </div>
      </div>

      {/* 2. Área de Trabalho da Folha (Canvas com folha branca centralizada) */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '40px',
          background: '#0b1120',
          cursor: 'default',
        }}
      >
        {/* Folha de Papel com Margens Normativas */}
        <div
          style={{
            width: `${sheetWidthMm * zoomMm}px`,
            height: `${sheetHeightMm * zoomMm}px`,
            background: '#ffffff',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
            position: 'relative',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          {/* Margem Interna NBR (Margem esquerda 25mm para fixação, demais normatizadas) */}
          <div
            style={{
              position: 'absolute',
              left: `${leftMarginMm * zoomMm}px`,
              top: `${otherMarginMm * zoomMm}px`,
              right: `${otherMarginMm * zoomMm}px`,
              bottom: `${otherMarginMm * zoomMm}px`,
              border: `${Math.max(1, 0.6 * zoomMm)}px solid #0f172a`,
              pointerEvents: 'none',
            }}
          />

          {/* 3. Viewports Inseridas na Prancha */}
          {currentSheet?.viewports.map((vp, index) => {
            const vpXMm = leftMarginMm + vp.x;
            const vpYMm = otherMarginMm + vp.y;
            const vpWMm = vp.width;
            const vpHMm = vp.height;
            const isSelected = selectedVpId === vp.id;
            const mmPerMeter = SCALE_RATIOS[vp.scale] || 20;

            return (
              <div
                key={vp.id}
                onPointerDown={(e) => handlePointerDownVp(e, vp)}
                onPointerMove={handlePointerMoveVp}
                onPointerUp={handlePointerUpVp}
                style={{
                  position: 'absolute',
                  left: `${vpXMm * zoomMm}px`,
                  top: `${vpYMm * zoomMm}px`,
                  width: `${vpWMm * zoomMm}px`,
                  height: `${vpHMm * zoomMm}px`,
                  border: isSelected ? '1.5px dashed #0284c7' : '1px solid rgba(148, 163, 184, 0.4)',
                  background: 'rgba(255, 255, 255, 0.95)',
                  cursor: draggingVpId === vp.id ? 'grabbing' : 'grab',
                  boxShadow: isSelected ? '0 0 0 3px rgba(2, 132, 199, 0.15)' : 'none',
                }}
              >
                {/* Cabeçalho Flutuante de Configuração da Viewport */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-26px',
                    left: '0',
                    background: '#0f172a',
                    color: '#f8fafc',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    display: isSelected ? 'flex' : 'none',
                    alignItems: 'center',
                    gap: 8,
                    zIndex: 30,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Move size={10} color="#38bdf8" />
                  <span>{vp.name}</span>
                  <select
                    value={vp.scale}
                    onChange={(e) =>
                      bimStore.updateViewport(currentSheet.id, vp.id, {
                        scale: e.target.value as ViewportScale,
                      })
                    }
                    style={{
                      background: '#1e293b',
                      color: '#38bdf8',
                      border: '1px solid #334155',
                      borderRadius: '3px',
                      fontSize: '10px',
                      padding: '1px 4px',
                    }}
                  >
                    <option value="1:25">1:25</option>
                    <option value="1:50">1:50</option>
                    <option value="1:100">1:100</option>
                    <option value="1:200">1:200</option>
                  </select>
                  <button
                    onClick={() => bimStore.removeViewport(currentSheet.id, vp.id)}
                    title="Excluir Viewport"
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* Conteúdo Gráfico Técnico 2D em Escala Vetorial */}
                <svg
                  style={{ width: '100%', height: '100%', overflow: 'hidden' }}
                  viewBox={`0 0 ${vpWMm} ${vpHMm}`}
                >
                  <g transform={`translate(${vpWMm / 2}, ${vpHMm / 2})`}>
                    {/* Paredes em Planta Baixa com preenchimento forte de corte NBR */}
                    {elements.walls.map((wall) => {
                      const sx = wall.start.x * mmPerMeter;
                      const sy = -wall.start.y * mmPerMeter;
                      const ex = wall.end.x * mmPerMeter;
                      const ey = -wall.end.y * mmPerMeter;

                      return (
                        <line
                          key={wall.id}
                          x1={sx}
                          y1={sy}
                          x2={ex}
                          y2={ey}
                          stroke="#111827"
                          strokeWidth={wall.thickness * mmPerMeter}
                          strokeLinecap="square"
                        />
                      );
                    })}

                    {/* Janelas */}
                    {elements.windows.map((win) => {
                      const host = elements.walls.find((w) => w.id === win.wallId);
                      if (!host) return null;
                      const dx = host.end.x - host.start.x;
                      const dy = host.end.y - host.start.y;
                      const len = Math.hypot(dx, dy);
                      if (len < 0.1) return null;

                      const ux = dx / len;
                      const uy = dy / len;
                      const winCx = host.start.x + ux * (win.offsetRatio * len);
                      const winCy = host.start.y + uy * (win.offsetRatio * len);
                      const halfW = win.width / 2;

                      const p1X = (winCx - ux * halfW) * mmPerMeter;
                      const p1Y = -(winCy - uy * halfW) * mmPerMeter;
                      const p2X = (winCx + ux * halfW) * mmPerMeter;
                      const p2Y = -(winCy + uy * halfW) * mmPerMeter;

                      return (
                        <line
                          key={win.id}
                          x1={p1X}
                          y1={p1Y}
                          x2={p2X}
                          y2={p2Y}
                          stroke="#0284c7"
                          strokeWidth={1.5}
                        />
                      );
                    })}

                    {/* Portas com arco de giro */}
                    {elements.doors.map((door) => {
                      const host = elements.walls.find((w) => w.id === door.wallId);
                      if (!host) return null;
                      const dx = host.end.x - host.start.x;
                      const dy = host.end.y - host.start.y;
                      const len = Math.hypot(dx, dy);
                      if (len < 0.1) return null;

                      const ux = dx / len;
                      const uy = dy / len;
                      const doorCx = host.start.x + ux * (door.offsetRatio * len);
                      const doorCy = host.start.y + uy * (door.offsetRatio * len);
                      const halfW = door.width / 2;

                      const isLeft = !door.flipHand;
                      const hX = isLeft ? doorCx - ux * halfW : doorCx + ux * halfW;
                      const hY = isLeft ? doorCy - uy * halfW : doorCy + uy * halfW;

                      const screenHX = hX * mmPerMeter;
                      const screenHY = -hY * mmPerMeter;

                      const facing = door.flipFacing ? -1 : 1;
                      const endX = hX + -uy * (door.width * facing);
                      const endY = hY + ux * (door.width * facing);

                      return (
                        <g key={door.id}>
                          <line
                            x1={screenHX}
                            y1={screenHY}
                            x2={endX * mmPerMeter}
                            y2={-endY * mmPerMeter}
                            stroke="#b45309"
                            strokeWidth={1.2}
                          />
                        </g>
                      );
                    })}

                    {/* Ambientes com Nome e m² */}
                    {elements.rooms.map((room) => {
                      if (room.polygon.length < 3) return null;
                      const cx = (room.polygon.reduce((acc, p) => acc + p.x, 0) / room.polygon.length) * mmPerMeter;
                      const cy = -(room.polygon.reduce((acc, p) => acc + p.y, 0) / room.polygon.length) * mmPerMeter;

                      return (
                        <g key={room.id} transform={`translate(${cx}, ${cy})`}>
                          <text
                            textAnchor="middle"
                            y={-1}
                            fontSize={7}
                            fontWeight="bold"
                            fill="#1e293b"
                            fontFamily="Inter, sans-serif"
                          >
                            {room.name.toUpperCase()}
                          </text>
                          <text
                            textAnchor="middle"
                            y={7}
                            fontSize={6}
                            fill="#16a34a"
                            fontFamily="Inter, sans-serif"
                          >
                            {room.areaM2.toFixed(2)} m²
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* Rótulo Técnico Inferior Normativo (NBR 6492) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-24px',
                    left: '0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: '1.2px solid #0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                      {vp.name}
                    </div>
                    <div style={{ fontSize: '8px', color: '#64748b' }}>
                      ESCALA {vp.scale}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 4. Carimbo / Selo Técnico NBR (Canto Inferior Direito) */}
          <div
            style={{
              position: 'absolute',
              left: `${stampXMm * zoomMm}px`,
              top: `${stampYMm * zoomMm}px`,
              width: `${stampWidthMm * zoomMm}px`,
              height: `${stampHeightMm * zoomMm}px`,
              border: `${Math.max(1, 0.5 * zoomMm)}px solid #0f172a`,
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              fontSize: `${Math.max(8, 9 * zoomMm)}px`,
              color: '#0f172a',
            }}
          >
            {/* Bloco 1: Título do Projeto */}
            <div
              style={{
                height: `${14 * zoomMm}px`,
                borderBottom: `${Math.max(1, 0.4 * zoomMm)}px solid #0f172a`,
                padding: '2px 6px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <input
                value={currentSheet?.stamp.projectTitle || ''}
                onChange={(e) =>
                  currentSheet &&
                  bimStore.updateSheet(currentSheet.id, {
                    stamp: { ...currentSheet.stamp, projectTitle: e.target.value },
                  })
                }
                style={{
                  width: '100%',
                  fontWeight: 700,
                  fontSize: `${Math.max(9, 11 * zoomMm)}px`,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: '#0f172a',
                  textTransform: 'uppercase',
                }}
              />
            </div>

            {/* Bloco 2: Proprietário / Cliente */}
            <div
              style={{
                height: `${14 * zoomMm}px`,
                borderBottom: `${Math.max(1, 0.4 * zoomMm)}px solid #0f172a`,
                padding: '2px 6px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: `${Math.max(6, 7 * zoomMm)}px`, color: '#64748b' }}>PROPRIETÁRIO:</span>
              <input
                value={currentSheet?.stamp.clientName || ''}
                onChange={(e) =>
                  currentSheet &&
                  bimStore.updateSheet(currentSheet.id, {
                    stamp: { ...currentSheet.stamp, clientName: e.target.value },
                  })
                }
                style={{
                  width: '100%',
                  fontWeight: 600,
                  fontSize: `${Math.max(8, 9 * zoomMm)}px`,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: '#0f172a',
                }}
              />
            </div>

            {/* Bloco 3: Conteúdo e Responsável Técnico */}
            <div
              style={{
                height: `${16 * zoomMm}px`,
                borderBottom: `${Math.max(1, 0.4 * zoomMm)}px solid #0f172a`,
                display: 'flex',
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: '2px 6px',
                  borderRight: `${Math.max(1, 0.4 * zoomMm)}px solid #0f172a`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: `${Math.max(6, 7 * zoomMm)}px`, color: '#64748b' }}>CONTEÚDO:</span>
                <input
                  value={currentSheet?.stamp.sheetTitle || ''}
                  onChange={(e) =>
                    currentSheet &&
                    bimStore.updateSheet(currentSheet.id, {
                      stamp: { ...currentSheet.stamp, sheetTitle: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    fontWeight: 600,
                    fontSize: `${Math.max(8, 9 * zoomMm)}px`,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: '#0f172a',
                  }}
                />
              </div>

              <div
                style={{
                  width: `${60 * zoomMm}px`,
                  padding: '2px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: `${Math.max(6, 7 * zoomMm)}px`, color: '#64748b' }}>RESPONSÁVEL:</span>
                <input
                  value={currentSheet?.stamp.authorName || ''}
                  onChange={(e) =>
                    currentSheet &&
                    bimStore.updateSheet(currentSheet.id, {
                      stamp: { ...currentSheet.stamp, authorName: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    fontWeight: 600,
                    fontSize: `${Math.max(7, 8.5 * zoomMm)}px`,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: '#0f172a',
                  }}
                />
              </div>
            </div>

            {/* Bloco 4: Data, Escala e Prancha nº */}
            <div style={{ flex: 1, display: 'flex' }}>
              <div
                style={{
                  flex: 1,
                  padding: '2px 6px',
                  borderRight: `${Math.max(1, 0.4 * zoomMm)}px solid #0f172a`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: `${Math.max(6, 7 * zoomMm)}px`, color: '#64748b' }}>DATA:</span>
                <input
                  value={currentSheet?.stamp.date || ''}
                  onChange={(e) =>
                    currentSheet &&
                    bimStore.updateSheet(currentSheet.id, {
                      stamp: { ...currentSheet.stamp, date: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    fontWeight: 600,
                    fontSize: `${Math.max(7, 8 * zoomMm)}px`,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: '#0f172a',
                  }}
                />
              </div>

              <div
                style={{
                  flex: 1,
                  padding: '2px 6px',
                  borderRight: `${Math.max(1, 0.4 * zoomMm)}px solid #0f172a`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: `${Math.max(6, 7 * zoomMm)}px`, color: '#64748b' }}>ESCALA:</span>
                <input
                  value={currentSheet?.stamp.scale || 'INDICADA'}
                  onChange={(e) =>
                    currentSheet &&
                    bimStore.updateSheet(currentSheet.id, {
                      stamp: { ...currentSheet.stamp, scale: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    fontWeight: 600,
                    fontSize: `${Math.max(7, 8 * zoomMm)}px`,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: '#0f172a',
                  }}
                />
              </div>

              <div
                style={{
                  width: `${50 * zoomMm}px`,
                  padding: '2px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: `${Math.max(6, 7 * zoomMm)}px`, color: '#64748b' }}>FOLHA:</span>
                <input
                  value={currentSheet?.stamp.sheetNumber || '01/01'}
                  onChange={(e) =>
                    currentSheet &&
                    bimStore.updateSheet(currentSheet.id, {
                      stamp: { ...currentSheet.stamp, sheetNumber: e.target.value },
                    })
                  }
                  style={{
                    width: '100%',
                    fontWeight: 800,
                    fontSize: `${Math.max(9, 12 * zoomMm)}px`,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: '#0f172a',
                    textAlign: 'center',
                  }}
                />
              </div>
            </div>
          </div>

          {/* 5. Tabela de Quantitativos na Prancha (Esquadrias) */}
          {currentSheet?.showSchedules && (
            <div
              style={{
                position: 'absolute',
                left: `${(stampXMm - 20) * zoomMm}px`,
                top: `${(otherMarginMm + 15) * zoomMm}px`,
                width: `${stampWidthMm * zoomMm}px`,
                background: '#ffffff',
                border: `${Math.max(1, 0.4 * zoomMm)}px solid #0f172a`,
                fontSize: `${Math.max(7, 8 * zoomMm)}px`,
                color: '#0f172a',
              }}
            >
              <div
                style={{
                  background: '#f1f5f9',
                  borderBottom: `${Math.max(1, 0.4 * zoomMm)}px solid #0f172a`,
                  padding: '4px',
                  fontWeight: 700,
                  textAlign: 'center',
                  fontSize: `${Math.max(7, 9 * zoomMm)}px`,
                }}
              >
                QUADRO DE ESQUADRIAS
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '2px 4px' }}>CÓD</th>
                    <th style={{ padding: '2px 4px' }}>TIPO</th>
                    <th style={{ padding: '2px 4px' }}>L (cm)</th>
                    <th style={{ padding: '2px 4px' }}>H (cm)</th>
                    <th style={{ padding: '2px 4px' }}>PEIT</th>
                    <th style={{ padding: '2px 4px' }}>QTD</th>
                  </tr>
                </thead>
                <tbody>
                  {doorSchedule.map((d) => (
                    <tr key={d.code} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '2px 4px', fontWeight: 600 }}>{d.code}</td>
                      <td style={{ padding: '2px 4px' }}>Porta</td>
                      <td style={{ padding: '2px 4px' }}>{Math.round(d.width * 100)}</td>
                      <td style={{ padding: '2px 4px' }}>{Math.round(d.height * 100)}</td>
                      <td style={{ padding: '2px 4px' }}>0</td>
                      <td style={{ padding: '2px 4px', fontWeight: 600 }}>{d.count}</td>
                    </tr>
                  ))}
                  {windowSchedule.map((w) => (
                    <tr key={w.code} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '2px 4px', fontWeight: 600 }}>{w.code}</td>
                      <td style={{ padding: '2px 4px' }}>Janela</td>
                      <td style={{ padding: '2px 4px' }}>{Math.round(w.width * 100)}</td>
                      <td style={{ padding: '2px 4px' }}>{Math.round(w.height * 100)}</td>
                      <td style={{ padding: '2px 4px' }}>{Math.round(w.sill * 100)}</td>
                      <td style={{ padding: '2px 4px', fontWeight: 600 }}>{w.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
