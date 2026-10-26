import React, { useState } from 'react';
import { useBIM, bimStore } from '../../cad-core/engine/bimStore';
import type {
  WallTypeItem,
  DoorTypeItem,
  WindowTypeItem,
  FloorTypeItem,
  RoofTypeItem,
  ToolType,
} from '../../cad-core/types';
import {
  Sliders,
  Copy,
  Trash2,
  Square,
  Minus,
  Check,
  X,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';

export const PropertiesPanel: React.FC = () => {
  const {
    activeTool,
    drawMode,
    defaults,
    levels,
    activeLevelId,
    selectedElementIds,
    elements,
    wallTypes,
    doorTypes,
    windowTypes,
    floorTypes,
    roofTypes,
    stairTypes,
  } = useBIM();

  // Modal / Gaveta de Criação / Edição de Tipo (Type Properties do Revit)
  const [showEditTypeModal, setShowEditTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeThickness, setNewTypeThickness] = useState('0.15');
  const [newTypeWidth, setNewTypeWidth] = useState('0.80');
  const [newTypeHeight, setNewTypeHeight] = useState('2.10');
  const [newTypeSill, setNewTypeSill] = useState('1.10');
  const [newTypePitch, setNewTypePitch] = useState('10');
  const [newTypeOverhang, setNewTypeOverhang] = useState('0.60');
  const [newTypeMaterial, setNewTypeMaterial] = useState('');

  // Identificação do Elemento Selecionado
  const selectedId = selectedElementIds[0] || null;
  const selectedElement = selectedId
    ? elements.walls.find((w) => w.id === selectedId) ||
      elements.doors.find((d) => d.id === selectedId) ||
      elements.windows.find((w) => w.id === selectedId) ||
      elements.floors.find((f) => f.id === selectedId) ||
      elements.roofs.find((r) => r.id === selectedId) ||
      elements.stairs.find((s) => s.id === selectedId) ||
      elements.rooms.find((rm) => rm.id === selectedId) ||
      elements.roomSeparators.find((rs) => rs.id === selectedId) ||
      elements.dimensions.find((dim) => dim.id === selectedId) ||
      elements.sections.find((sec) => sec.id === selectedId) ||
      null
    : null;

  // Categoria ativa (ou do elemento selecionado, ou da ferramenta de desenho ativa)
  const currentCategory: ToolType = selectedElement ? (selectedElement.type as ToolType) : activeTool;

  // Handlers para Abertura do Modal de Tipo
  const handleOpenEditType = () => {
    if (currentCategory === 'wall') {
      const current = wallTypes.find((wt) => Math.abs(wt.thickness - defaults.wall.thickness) < 0.001) || wallTypes[0];
      setNewTypeName(`${current?.name || 'Parede'} (Novo Tipo)`);
      setNewTypeThickness(defaults.wall.thickness.toString());
      setNewTypeHeight(defaults.wall.height.toString());
      setNewTypeMaterial(current?.material || 'Alvenaria');
    } else if (currentCategory === 'door') {
      const current = doorTypes.find((dt) => Math.abs(dt.width - defaults.door.width) < 0.001) || doorTypes[0];
      setNewTypeName(`${current?.name || 'Porta'} (Novo Tipo)`);
      setNewTypeWidth(defaults.door.width.toString());
      setNewTypeHeight(defaults.door.height.toString());
      setNewTypeMaterial(current?.material || 'Madeira');
    } else if (currentCategory === 'window') {
      const current = windowTypes.find((wt) => Math.abs(wt.width - defaults.window.width) < 0.001) || windowTypes[0];
      setNewTypeName(`${current?.name || 'Janela'} (Novo Tipo)`);
      setNewTypeWidth(defaults.window.width.toString());
      setNewTypeHeight(defaults.window.height.toString());
      setNewTypeSill(defaults.window.sillHeight.toString());
      setNewTypeMaterial(current?.material || 'Alumínio e Vidro');
    } else if (currentCategory === 'floor') {
      const current = floorTypes.find((ft) => Math.abs(ft.thickness - (defaults.floor?.thickness || 0.15)) < 0.001) || floorTypes[0];
      setNewTypeName(`${current?.name || 'Piso'} (Novo Tipo)`);
      setNewTypeThickness((defaults.floor?.thickness || 0.15).toString());
      setNewTypeMaterial(current?.material || 'Porcelanato');
    } else if (currentCategory === 'roof') {
      const current = roofTypes[0];
      setNewTypeName(`${current?.name || 'Telhado'} (Novo Tipo)`);
      setNewTypePitch((defaults.roof?.pitch || 10).toString());
      setNewTypeOverhang((defaults.roof?.overhang || 0.6).toString());
      setNewTypeMaterial(current?.material || 'Telha Cerâmica');
    }
    setShowEditTypeModal(true);
  };

  // Salvar Novo Tipo Criado
  const handleSaveNewType = () => {
    if (currentCategory === 'wall') {
      const th = parseFloat(newTypeThickness.replace(',', '.')) || 0.15;
      const h = parseFloat(newTypeHeight.replace(',', '.')) || 2.8;
      const newType: WallTypeItem = {
        id: `wt-${Date.now()}`,
        name: newTypeName || `Alvenaria ${Math.round(th * 100)}cm`,
        thickness: th,
        height: h,
        material: newTypeMaterial || 'Alvenaria',
      };
      bimStore.addWallType(newType);
      bimStore.setWallDefaults(th, h, newType.id);
      if (selectedElement && selectedElement.type === 'wall') {
        bimStore.updateElement(selectedElement.id, 'wall', { thickness: th, height: h, typeName: newType.name, material: newType.material });
      }
    } else if (currentCategory === 'door') {
      const w = parseFloat(newTypeWidth.replace(',', '.')) || 0.8;
      const h = parseFloat(newTypeHeight.replace(',', '.')) || 2.1;
      const newType: DoorTypeItem = {
        id: `dt-${Date.now()}`,
        name: newTypeName || `Porta ${w.toFixed(2)} x ${h.toFixed(2)}m`,
        width: w,
        height: h,
        category: 'Giro',
        material: newTypeMaterial || 'Madeira',
      };
      bimStore.addDoorType(newType);
      bimStore.setDoorDefaults(w, h, newType.id);
      if (selectedElement && selectedElement.type === 'door') {
        bimStore.updateElement(selectedElement.id, 'door', { width: w, height: h, typeName: newType.name });
      }
    } else if (currentCategory === 'window') {
      const w = parseFloat(newTypeWidth.replace(',', '.')) || 1.2;
      const h = parseFloat(newTypeHeight.replace(',', '.')) || 1.0;
      const sill = parseFloat(newTypeSill.replace(',', '.')) || 1.1;
      const newType: WindowTypeItem = {
        id: `wt-${Date.now()}`,
        name: newTypeName || `Janela ${w.toFixed(2)} x ${h.toFixed(2)}m`,
        width: w,
        height: h,
        sillHeight: sill,
        material: newTypeMaterial || 'Alumínio e Vidro',
      };
      bimStore.addWindowType(newType);
      bimStore.setWindowDefaults(w, h, sill, newType.id);
      if (selectedElement && selectedElement.type === 'window') {
        bimStore.updateElement(selectedElement.id, 'window', { width: w, height: h, sillHeight: sill, typeName: newType.name });
      }
    } else if (currentCategory === 'floor') {
      const th = parseFloat(newTypeThickness.replace(',', '.')) || 0.15;
      const newType: FloorTypeItem = {
        id: `ft-${Date.now()}`,
        name: newTypeName || `Piso ${Math.round(th * 100)}cm`,
        thickness: th,
        material: newTypeMaterial || 'Cerâmica',
      };
      bimStore.addFloorType(newType);
      bimStore.setFloorDefaults(th, newType.id);
      if (selectedElement && selectedElement.type === 'floor') {
        bimStore.updateElement(selectedElement.id, 'floor', { thickness: th, typeName: newType.name, material: newType.material });
      }
    } else if (currentCategory === 'roof') {
      const pitch = parseFloat(newTypePitch.replace(',', '.')) || 10;
      const ov = parseFloat(newTypeOverhang.replace(',', '.')) || 0.6;
      const newType: RoofTypeItem = {
        id: `rt-${Date.now()}`,
        name: newTypeName || `Telhado ${pitch}%`,
        pitch,
        overhang: ov,
        material: newTypeMaterial || 'Telha Cerâmica',
      };
      bimStore.addRoofType(newType);
      bimStore.setRoofDefaults(pitch, ov, newType.id);
      if (selectedElement && selectedElement.type === 'roof') {
        bimStore.updateElement(selectedElement.id, 'roof', { pitch, overhang: ov, typeName: newType.name });
      }
    }
    setShowEditTypeModal(false);
  };

  return (
    <aside
      style={{
        width: '290px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        userSelect: 'none',
      }}
    >
      {/* 1. CABEÇALHO DO PAINEL DE PROPRIEDADES ESTILO AUTODESK REVIT */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={15} style={{ color: 'var(--cad-cyan)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.2px' }}>
            Propriedades
          </span>
        </div>
        {selectedElement && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => bimStore.clearSelection()}
              title="Desmarcar seleção (Esc)"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '3px',
                display: 'flex',
              }}
            >
              <X size={14} />
            </button>
            <button
              onClick={() => bimStore.removeElement(selectedElement.id)}
              title="Excluir elemento selecionado (Delete)"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                cursor: 'pointer',
                padding: '2px 5px',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontSize: '11px',
              }}
            >
              <Trash2 size={12} />
              <span>Del</span>
            </button>
          </div>
        )}
      </div>

      {/* Faixa Informativa de Elemento Selecionado vs Ferramenta Ativa */}
      {selectedElement ? (
        <div
          style={{
            padding: '7px 16px',
            background: 'rgba(37, 99, 235, 0.12)',
            borderBottom: '1px solid rgba(37, 99, 235, 0.25)',
            fontSize: '11px',
            color: 'var(--cad-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Instância Selecionada</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
            ID: {selectedElement.id.slice(-6)}
          </span>
        </div>
      ) : null}

      <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 2. TYPE SELECTOR (SELETOR DE TIPO / FAMÍLIA EM DROPDOWN ESTILO REVIT) */}
        {(currentCategory === 'wall' ||
          currentCategory === 'door' ||
          currentCategory === 'window' ||
          currentCategory === 'floor' ||
          currentCategory === 'roof' ||
          currentCategory === 'stair') && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
                Seletor de Tipo (Família)
              </span>
              <button
                onClick={handleOpenEditType}
                title="Editar parâmetros de tipo ou criar novo"
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: 'var(--cad-cyan)',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '11px',
                  fontWeight: 500,
                }}
              >
                <Copy size={11} />
                <span>Editar Tipo</span>
              </button>
            </div>

            {/* Select de Parede */}
            {currentCategory === 'wall' && (
              <select
                value={
                  selectedElement && selectedElement.type === 'wall'
                    ? wallTypes.find((wt) => Math.abs(wt.thickness - selectedElement.thickness) < 0.001)?.id || wallTypes[0].id
                    : wallTypes.find((wt) => Math.abs(wt.thickness - defaults.wall.thickness) < 0.001)?.id || wallTypes[0].id
                }
                onChange={(e) => {
                  const wt = wallTypes.find((t) => t.id === e.target.value);
                  if (wt) {
                    bimStore.setWallDefaults(wt.thickness, wt.height, wt.id);
                    if (selectedElement && selectedElement.type === 'wall') {
                      bimStore.updateElement(selectedElement.id, 'wall', {
                        thickness: wt.thickness,
                        height: wt.height,
                        typeName: wt.name,
                        material: wt.material,
                      });
                    }
                  }
                }}
                style={{
                  width: '100%',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                }}
              >
                {wallTypes.map((wt) => (
                  <option key={wt.id} value={wt.id}>
                    {wt.name} ({Math.round(wt.thickness * 100)}cm)
                  </option>
                ))}
              </select>
            )}

            {/* Select de Porta */}
            {currentCategory === 'door' && (
              <select
                value={
                  selectedElement && selectedElement.type === 'door'
                    ? doorTypes.find((dt) => Math.abs(dt.width - selectedElement.width) < 0.001)?.id || doorTypes[0].id
                    : doorTypes.find((dt) => Math.abs(dt.width - defaults.door.width) < 0.001)?.id || doorTypes[0].id
                }
                onChange={(e) => {
                  const dt = doorTypes.find((t) => t.id === e.target.value);
                  if (dt) {
                    bimStore.setDoorDefaults(dt.width, dt.height, dt.id);
                    if (selectedElement && selectedElement.type === 'door') {
                      bimStore.updateElement(selectedElement.id, 'door', {
                        width: dt.width,
                        height: dt.height,
                        typeName: dt.name,
                      });
                    }
                  }
                }}
                style={{
                  width: '100%',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                }}
              >
                {doorTypes.map((dt) => (
                  <option key={dt.id} value={dt.id}>
                    {dt.name}
                  </option>
                ))}
              </select>
            )}

            {/* Select de Janela */}
            {currentCategory === 'window' && (
              <select
                value={
                  selectedElement && selectedElement.type === 'window'
                    ? windowTypes.find((wt) => Math.abs(wt.width - selectedElement.width) < 0.001)?.id || windowTypes[0].id
                    : windowTypes.find((wt) => Math.abs(wt.width - defaults.window.width) < 0.001)?.id || windowTypes[0].id
                }
                onChange={(e) => {
                  const wt = windowTypes.find((t) => t.id === e.target.value);
                  if (wt) {
                    bimStore.setWindowDefaults(wt.width, wt.height, wt.sillHeight, wt.id);
                    if (selectedElement && selectedElement.type === 'window') {
                      bimStore.updateElement(selectedElement.id, 'window', {
                        width: wt.width,
                        height: wt.height,
                        sillHeight: wt.sillHeight,
                        typeName: wt.name,
                      });
                    }
                  }
                }}
                style={{
                  width: '100%',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                }}
              >
                {windowTypes.map((wt) => (
                  <option key={wt.id} value={wt.id}>
                    {wt.name}
                  </option>
                ))}
              </select>
            )}

            {/* Select de Piso */}
            {currentCategory === 'floor' && (
              <select
                value={
                  selectedElement && selectedElement.type === 'floor'
                    ? floorTypes.find((ft) => Math.abs(ft.thickness - selectedElement.thickness) < 0.001)?.id || floorTypes[0].id
                    : floorTypes.find((ft) => Math.abs(ft.thickness - (defaults.floor?.thickness || 0.15)) < 0.001)?.id || floorTypes[0].id
                }
                onChange={(e) => {
                  const ft = floorTypes.find((t) => t.id === e.target.value);
                  if (ft) {
                    bimStore.setFloorDefaults(ft.thickness, ft.id);
                    if (selectedElement && selectedElement.type === 'floor') {
                      bimStore.updateElement(selectedElement.id, 'floor', {
                        thickness: ft.thickness,
                        typeName: ft.name,
                        material: ft.material,
                      });
                    }
                  }
                }}
                style={{
                  width: '100%',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                }}
              >
                {floorTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name}
                  </option>
                ))}
              </select>
            )}

            {/* Select de Telhado */}
            {currentCategory === 'roof' && (
              <select
                value={
                  selectedElement && selectedElement.type === 'roof'
                    ? roofTypes.find((rt) => Math.abs(rt.pitch - selectedElement.pitch) < 0.1)?.id || roofTypes[0].id
                    : roofTypes.find((rt) => Math.abs(rt.pitch - (defaults.roof?.pitch || 10)) < 0.1)?.id || roofTypes[0].id
                }
                onChange={(e) => {
                  const rt = roofTypes.find((t) => t.id === e.target.value);
                  if (rt) {
                    bimStore.setRoofDefaults(rt.pitch, rt.overhang, rt.id);
                    if (selectedElement && selectedElement.type === 'roof') {
                      bimStore.updateElement(selectedElement.id, 'roof', {
                        pitch: rt.pitch,
                        overhang: rt.overhang,
                        typeName: rt.name,
                      });
                    }
                  }
                }}
                style={{
                  width: '100%',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                }}
              >
                {roofTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </select>
            )}

            {/* Select de Escada */}
            {currentCategory === 'stair' && (
              <select
                value={stairTypes[0]?.id}
                style={{
                  width: '100%',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                }}
              >
                {stairTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* 3. MODOS DE DESENHO ESTILO REVIT (DRAW TOOLS: LINHA VS RETÂNGULO) */}
        {(currentCategory === 'wall' ||
          currentCategory === 'floor' ||
          currentCategory === 'roof' ||
          currentCategory === 'roomSeparator') && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
              Modo de Desenho (Draw Tools)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => bimStore.setDrawMode('line')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: '4px',
                  background: drawMode === 'line' ? 'rgba(37, 99, 235, 0.2)' : 'var(--bg-main)',
                  border: `1px solid ${drawMode === 'line' ? 'var(--cad-blue)' : 'var(--border-color)'}`,
                  color: drawMode === 'line' ? 'var(--cad-cyan)' : 'var(--text-dim)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: drawMode === 'line' ? 600 : 400,
                }}
              >
                <Minus size={14} />
                <span>Linha</span>
              </button>
              <button
                onClick={() => bimStore.setDrawMode('rectangle')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: '4px',
                  background: drawMode === 'rectangle' ? 'rgba(37, 99, 235, 0.2)' : 'var(--bg-main)',
                  border: `1px solid ${drawMode === 'rectangle' ? 'var(--cad-blue)' : 'var(--border-color)'}`,
                  color: drawMode === 'rectangle' ? 'var(--cad-cyan)' : 'var(--text-dim)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: drawMode === 'rectangle' ? 600 : 400,
                }}
              >
                <Square size={13} />
                <span>Retângulo</span>
              </button>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              {drawMode === 'rectangle'
                ? currentCategory === 'wall'
                  ? 'Clique em 2 cantos diagonais opostos para erguer 4 paredes conectadas instantaneamente.'
                  : currentCategory === 'roomSeparator'
                  ? 'Clique em 2 cantos para criar um recinto fechado com 4 separadores automáticos.'
                  : 'Clique em 2 cantos para delimitar o retângulo em 2 cliques.'
                : 'Clique vértice por vértice para traçar livremente segmento a segmento.'}
            </div>
          </div>
        )}

        {/* 4. SEÇÃO DE RESTRIÇÕES (CONSTRAINTS - PADRÃO REVIT) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Restrições (Constraints)
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
              Nível Base (Base Constraint)
            </label>
            <select
              value={selectedElement?.levelId || activeLevelId}
              onChange={(e) => {
                const newLvl = e.target.value;
                bimStore.setActiveLevelId(newLvl);
                if (selectedElement) {
                  bimStore.updateElement(selectedElement.id, selectedElement.type, { levelId: newLvl });
                }
              }}
              style={{ width: '100%', fontSize: '11px', padding: '5px 8px' }}
            >
              {levels.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name} (+{lvl.elevation.toFixed(2)}m)
                </option>
              ))}
            </select>
          </div>

          {(currentCategory === 'wall' || currentCategory === 'door' || currentCategory === 'window') && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                Restrição Superior (Top Constraint)
              </label>
              <select style={{ width: '100%', fontSize: '11px', padding: '5px 8px' }}>
                <option value="unconnected">Não Conectada (Altura Livre)</option>
                <option value="level_up">Conectada ao Nível Superior</option>
              </select>
            </div>
          )}
        </div>

        {/* 5. SEÇÃO DE DIMENSÕES (DIMENSIONS - PADRÃO REVIT) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Dimensões Paramétricas
          </div>

          {/* Dimensões da Parede */}
          {currentCategory === 'wall' && (
            <>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Espessura da Parede (m)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.05"
                  max="1.00"
                  value={selectedElement && selectedElement.type === 'wall' ? selectedElement.thickness : defaults.wall.thickness}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0.15;
                    bimStore.setWallDefaults(val, defaults.wall.height);
                    if (selectedElement && selectedElement.type === 'wall') {
                      bimStore.updateElement(selectedElement.id, 'wall', { thickness: val });
                    }
                  }}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Altura Desconectada (m)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="0.5"
                  max="10.0"
                  value={selectedElement && selectedElement.type === 'wall' ? selectedElement.height : defaults.wall.height}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 2.8;
                    bimStore.setWallDefaults(defaults.wall.thickness, val);
                    if (selectedElement && selectedElement.type === 'wall') {
                      bimStore.updateElement(selectedElement.id, 'wall', { height: val });
                    }
                  }}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                />
              </div>

              {selectedElement && selectedElement.type === 'wall' && (
                <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Comprimento Linear: </span>
                  <strong style={{ color: 'var(--cad-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {Math.hypot(selectedElement.end.x - selectedElement.start.x, selectedElement.end.y - selectedElement.start.y).toFixed(2)} m
                  </strong>
                </div>
              )}
            </>
          )}

          {/* Dimensões da Porta */}
          {currentCategory === 'door' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                    Largura (m)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={selectedElement && selectedElement.type === 'door' ? selectedElement.width : defaults.door.width}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0.8;
                      bimStore.setDoorDefaults(val, defaults.door.height);
                      if (selectedElement && selectedElement.type === 'door') {
                        bimStore.updateElement(selectedElement.id, 'door', { width: val });
                      }
                    }}
                    style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                    Altura (m)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={selectedElement && selectedElement.type === 'door' ? selectedElement.height : defaults.door.height}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 2.1;
                      bimStore.setDoorDefaults(defaults.door.width, val);
                      if (selectedElement && selectedElement.type === 'door') {
                        bimStore.updateElement(selectedElement.id, 'door', { height: val });
                      }
                    }}
                    style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  />
                </div>
              </div>

              {/* Botões de Inversão da Porta (Revit Flip Facing / Flip Hand) */}
              {selectedElement && selectedElement.type === 'door' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Controle de Abertura:</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() =>
                        bimStore.updateElement(selectedElement.id, 'door', {
                          flipFacing: !selectedElement.flipFacing,
                        })
                      }
                      style={{
                        flex: 1,
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        padding: '5px 8px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                      title="Inverter lado interno / externo da folha"
                    >
                      <FlipVertical size={12} />
                      <span>Inverter Lado</span>
                    </button>
                    <button
                      onClick={() =>
                        bimStore.updateElement(selectedElement.id, 'door', {
                          flipHand: !selectedElement.flipHand,
                        })
                      }
                      style={{
                        flex: 1,
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        padding: '5px 8px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                      title="Inverter mão direita / esquerda de giro"
                    >
                      <FlipHorizontal size={12} />
                      <span>Inverter Mão</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--cad-cyan)' }}>
                    Atalho: pressione <strong>[Espaço]</strong> para alternar as 4 posições.
                  </div>
                </div>
              )}
            </>
          )}

          {/* Dimensões da Janela */}
          {currentCategory === 'window' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                    Largura (m)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={selectedElement && selectedElement.type === 'window' ? selectedElement.width : defaults.window.width}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 1.2;
                      bimStore.setWindowDefaults(val, defaults.window.height, defaults.window.sillHeight);
                      if (selectedElement && selectedElement.type === 'window') {
                        bimStore.updateElement(selectedElement.id, 'window', { width: val });
                      }
                    }}
                    style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                    Altura (m)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={selectedElement && selectedElement.type === 'window' ? selectedElement.height : defaults.window.height}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 1.0;
                      bimStore.setWindowDefaults(defaults.window.width, val, defaults.window.sillHeight);
                      if (selectedElement && selectedElement.type === 'window') {
                        bimStore.updateElement(selectedElement.id, 'window', { height: val });
                      }
                    }}
                    style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Altura do Peitoril (m)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={selectedElement && selectedElement.type === 'window' ? selectedElement.sillHeight : defaults.window.sillHeight}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 1.1;
                    bimStore.setWindowDefaults(defaults.window.width, defaults.window.height, val);
                    if (selectedElement && selectedElement.type === 'window') {
                      bimStore.updateElement(selectedElement.id, 'window', { sillHeight: val });
                    }
                  }}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                />
              </div>
            </>
          )}

          {/* Dimensões do Piso */}
          {currentCategory === 'floor' && (
            <>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Espessura da Laje (m)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedElement && selectedElement.type === 'floor' ? selectedElement.thickness : defaults.floor?.thickness || 0.15}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0.15;
                    bimStore.setFloorDefaults(val);
                    if (selectedElement && selectedElement.type === 'floor') {
                      bimStore.updateElement(selectedElement.id, 'floor', { thickness: val });
                    }
                  }}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Deslocamento de Elevação (m)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedElement && selectedElement.type === 'floor' ? selectedElement.elevationOffset || 0 : 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (selectedElement && selectedElement.type === 'floor') {
                      bimStore.updateElement(selectedElement.id, 'floor', { elevationOffset: val });
                    }
                  }}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: 2, display: 'block' }}>
                  Ex: -0.05m para desnível de área molhada (banheiro / varanda).
                </span>
              </div>
            </>
          )}

          {/* Dimensões do Telhado */}
          {currentCategory === 'roof' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                    Inclinação (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={selectedElement && selectedElement.type === 'roof' ? selectedElement.pitch : defaults.roof?.pitch || 10}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 10;
                      bimStore.setRoofDefaults(val, defaults.roof?.overhang || 0.6);
                      if (selectedElement && selectedElement.type === 'roof') {
                        bimStore.updateElement(selectedElement.id, 'roof', { pitch: val });
                      }
                    }}
                    style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                    Beiral (m)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={selectedElement && selectedElement.type === 'roof' ? selectedElement.overhang : defaults.roof?.overhang || 0.6}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0.6;
                      bimStore.setRoofDefaults(defaults.roof?.pitch || 10, val);
                      if (selectedElement && selectedElement.type === 'roof') {
                        bimStore.updateElement(selectedElement.id, 'roof', { overhang: val });
                      }
                    }}
                    style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Dimensões do Ambiente (Room) */}
          {currentCategory === 'room' && (
            <>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Nome do Ambiente
                </label>
                <select
                  value={selectedElement && selectedElement.type === 'room' ? selectedElement.name : 'Sala de Estar'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (selectedElement && selectedElement.type === 'room') {
                      bimStore.updateElement(selectedElement.id, 'room', { name: val });
                    }
                  }}
                  style={{ width: '100%', fontSize: '11px', padding: '5px 8px' }}
                >
                  {[
                    'Sala de Estar',
                    'Sala de Jantar',
                    'Cozinha',
                    'Dormitório 01',
                    'Dormitório 02',
                    'Suíte Master',
                    'Banheiro Social',
                    'Lavabo',
                    'Área de Serviço',
                    'Varanda Gourmet',
                    'Escritório / Home Office',
                    'Garagem',
                    'Circulação / Hall',
                  ].map((nom) => (
                    <option key={nom} value={nom}>
                      {nom}
                    </option>
                  ))}
                </select>
              </div>

              {selectedElement && selectedElement.type === 'room' && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                    Nome Customizado
                  </label>
                  <input
                    type="text"
                    value={selectedElement.name}
                    onChange={(e) =>
                      bimStore.updateElement(selectedElement.id, 'room', { name: e.target.value })
                    }
                    style={{ width: '100%', fontSize: '11px' }}
                  />
                </div>
              )}

              {selectedElement && selectedElement.type === 'room' && (
                <div style={{ padding: '8px 10px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: '4px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                  <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: 600, textTransform: 'uppercase' }}>
                    Área Útil Computada
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#22c55e', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {selectedElement.areaM2.toFixed(2)} m²
                  </div>
                </div>
              )}
            </>
          )}

          {/* Dimensões da Cota Alinhada */}
          {currentCategory === 'dimension' && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Estilo Normativo: <strong>ABNT NBR 6492</strong><br />
              Ticks a 45° com precisão decimal (2 casas).
            </div>
          )}

          {/* Dimensões do Corte */}
          {currentCategory === 'section' && selectedElement && selectedElement.type === 'section' && (
            <>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Nome da Vista de Corte
                </label>
                <input
                  type="text"
                  value={selectedElement.name}
                  onChange={(e) =>
                    bimStore.updateElement(selectedElement.id, 'section', { name: e.target.value })
                  }
                  style={{ width: '100%', fontSize: '11px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Profundidade de Visão (Far Clip Depth - m)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedElement.farClipDepth || 5.0}
                  onChange={(e) =>
                    bimStore.updateElement(selectedElement.id, 'section', {
                      farClipDepth: parseFloat(e.target.value) || 2.0,
                    })
                  }
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                />
              </div>
            </>
          )}
        </div>

        {/* 6. DADOS DE IDENTIDADE (IDENTITY DATA - PADRÃO REVIT) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Dados de Identidade
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
              Material / Composição Estrutural
            </label>
            <input
              type="text"
              readOnly
              value={
                currentCategory === 'wall'
                  ? 'Alvenaria com Reboco 15cm'
                  : currentCategory === 'door'
                  ? 'Madeira Maciça Envernizada'
                  : currentCategory === 'window'
                  ? 'Esquadria de Alumínio e Vidro'
                  : currentCategory === 'floor'
                  ? 'Laje de Concreto Armado FCK 25MPa'
                  : currentCategory === 'roof'
                  ? 'Estrutura de Madeira e Telha Cerâmica'
                  : 'Padrão NBR'
              }
              style={{ width: '100%', fontSize: '11px', color: 'var(--text-dim)', background: 'var(--bg-main)' }}
            />
          </div>
        </div>
      </div>

      {/* 7. MODAL / DIALOG FLUTUANTE DE PROPRIEDADES DE TIPO (EDIT TYPE / DUPLICATE DO REVIT) */}
      {showEditTypeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              width: '380px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Topo do Modal */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(15, 23, 42, 0.8)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Copy size={14} style={{ color: 'var(--cad-cyan)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  Criar Novo Tipo Paramétrico
                </span>
              </div>
              <button
                onClick={() => setShowEditTypeModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Nome do Tipo:
                </label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Ex: Parede Bloco 14cm"
                  style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
                />
              </div>

              {currentCategory === 'wall' && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                    Espessura Estrutural (m):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTypeThickness}
                    onChange={(e) => setNewTypeThickness(e.target.value)}
                    style={{ width: '100%', fontSize: '12px', padding: '6px 8px', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              )}

              {currentCategory === 'door' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                      Largura (m):
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={newTypeWidth}
                      onChange={(e) => setNewTypeWidth(e.target.value)}
                      style={{ width: '100%', fontSize: '12px', padding: '6px 8px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                      Altura (m):
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={newTypeHeight}
                      onChange={(e) => setNewTypeHeight(e.target.value)}
                      style={{ width: '100%', fontSize: '12px', padding: '6px 8px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>
              )}

              {currentCategory === 'window' && (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                        Largura (m):
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={newTypeWidth}
                        onChange={(e) => setNewTypeWidth(e.target.value)}
                        style={{ width: '100%', fontSize: '12px', padding: '6px 8px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                        Altura (m):
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={newTypeHeight}
                        onChange={(e) => setNewTypeHeight(e.target.value)}
                        style={{ width: '100%', fontSize: '12px', padding: '6px 8px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                      Peitoril Padrão (m):
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={newTypeSill}
                      onChange={(e) => setNewTypeSill(e.target.value)}
                      style={{ width: '100%', fontSize: '12px', padding: '6px 8px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </>
              )}

              {currentCategory === 'floor' && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                    Espessura da Laje (m):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTypeThickness}
                    onChange={(e) => setNewTypeThickness(e.target.value)}
                    style={{ width: '100%', fontSize: '12px', padding: '6px 8px', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              )}

              {currentCategory === 'roof' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                      Inclinação (%):
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={newTypePitch}
                      onChange={(e) => setNewTypePitch(e.target.value)}
                      style={{ width: '100%', fontSize: '12px', padding: '6px 8px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                      Beiral (m):
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={newTypeOverhang}
                      onChange={(e) => setNewTypeOverhang(e.target.value)}
                      style={{ width: '100%', fontSize: '12px', padding: '6px 8px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Material / Camadas:
                </label>
                <input
                  type="text"
                  value={newTypeMaterial}
                  onChange={(e) => setNewTypeMaterial(e.target.value)}
                  placeholder="Ex: Concreto Armado / Cerâmica"
                  style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
                />
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                background: 'rgba(15, 23, 42, 0.4)',
              }}
            >
              <button
                onClick={() => setShowEditTypeModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-dim)',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNewType}
                style={{
                  background: 'var(--cad-blue)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Check size={13} />
                <span>Salvar e Aplicar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
