import React, { useState } from 'react';
import { useBIM, bimStore } from '../../cad-core/engine/bimStore';
import { Sliders, Copy, Check, Info } from 'lucide-react';

export const PropertiesPanel: React.FC = () => {
  const { activeTool, defaults, levels, activeLevelId } = useBIM();

  // Estados locais para edição paramétrica
  const [wallThickness, setWallThickness] = useState(defaults.wall.thickness);
  const [wallHeight, setWallHeight] = useState(defaults.wall.height);

  const [doorTypes, setDoorTypes] = useState([
    { name: 'P70 (Giro)', width: 0.7, height: 2.1 },
    { name: 'P80 (Giro)', width: 0.8, height: 2.1 },
    { name: 'P90 (Giro)', width: 0.9, height: 2.1 },
  ]);
  const [selectedDoorTypeIdx, setSelectedDoorTypeIdx] = useState(1);

  const [windowTypes, setWindowTypes] = useState([
    { name: 'J100 (1.00x1.00 peit 1.10)', width: 1.0, height: 1.0, sill: 1.1 },
    { name: 'J120 (1.20x1.00 peit 1.10)', width: 1.2, height: 1.0, sill: 1.1 },
    { name: 'J150 (1.50x1.20 peit 1.00)', width: 1.5, height: 1.2, sill: 1.0 },
  ]);
  const [selectedWindowTypeIdx, setSelectedWindowTypeIdx] = useState(1);

  const handleWallThicknessChange = (val: number) => {
    setWallThickness(val);
    bimStore.setWallDefaults(val, wallHeight);
  };

  const handleWallHeightChange = (val: number) => {
    setWallHeight(val);
    bimStore.setWallDefaults(wallThickness, val);
  };

  // Duplicar Tipo de Porta
  const handleDuplicateDoor = () => {
    const current = doorTypes[selectedDoorTypeIdx];
    const newName = prompt('Nome do novo tipo de porta:', `${current.name} (Cópia)`);
    if (!newName) return;
    const newWidth = parseFloat(prompt('Largura da porta em metros (ex: 0.90):', current.width.toString()) || current.width.toString());
    const newHeight = parseFloat(prompt('Altura da porta em metros (ex: 2.10):', current.height.toString()) || current.height.toString());

    const newType = { name: newName, width: newWidth, height: newHeight };
    setDoorTypes((prev) => [...prev, newType]);
    setSelectedDoorTypeIdx(doorTypes.length);
  };

  // Duplicar Tipo de Janela
  const handleDuplicateWindow = () => {
    const current = windowTypes[selectedWindowTypeIdx];
    const newName = prompt('Nome do novo tipo de janela:', `${current.name} (Cópia)`);
    if (!newName) return;
    const newWidth = parseFloat(prompt('Largura da janela em metros:', current.width.toString()) || current.width.toString());
    const newHeight = parseFloat(prompt('Altura da janela em metros:', current.height.toString()) || current.height.toString());
    const newSill = parseFloat(prompt('Peitoril da janela em metros:', current.sill.toString()) || current.sill.toString());

    const newType = { name: newName, width: newWidth, height: newHeight, sill: newSill };
    setWindowTypes((prev) => [...prev, newType]);
    setSelectedWindowTypeIdx(windowTypes.length);
  };

  return (
    <aside
      style={{
        width: '280px',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Sliders size={15} style={{ color: 'var(--cad-cyan)' }} />
        <span>Propriedades do Elemento</span>
      </div>

      <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Propriedades da Parede */}
        {activeTool === 'wall' && (
          <>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase', marginBottom: 12 }}>
                Tipo de Parede
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { name: 'Alvenaria Comum 15cm', thickness: 0.15 },
                  { name: 'Parede Externa 20cm', thickness: 0.2 },
                  { name: 'Divisória Drywall 10cm', thickness: 0.1 },
                ].map((type) => {
                  const isSelected = Math.abs(wallThickness - type.thickness) < 0.001;
                  return (
                    <div
                      key={type.name}
                      onClick={() => handleWallThicknessChange(type.thickness)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-main)',
                        border: `1px solid ${isSelected ? 'var(--cad-blue)' : 'var(--border-color)'}`,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontWeight: isSelected ? 600 : 400 }}>{type.name}</span>
                      {isSelected && <Check size={14} style={{ color: 'var(--cad-cyan)' }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
                Dimensões Paramétricas
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Espessura da Parede (m)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.05"
                  max="1.0"
                  value={wallThickness}
                  onChange={(e) => handleWallThicknessChange(parseFloat(e.target.value) || 0.15)}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Altura da Parede (m)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="0.5"
                  max="10.0"
                  value={wallHeight}
                  onChange={(e) => handleWallHeightChange(parseFloat(e.target.value) || 2.8)}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Nível de Base
                </label>
                <select
                  value={activeLevelId}
                  onChange={(e) => bimStore.setActiveLevelId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {levels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.name} (+{lvl.elevation.toFixed(2)}m)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {/* Propriedades da Porta */}
        {activeTool === 'door' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
                Tipos de Porta
              </div>
              <button
                className="btn-secondary"
                onClick={handleDuplicateDoor}
                style={{ padding: '4px 8px', fontSize: '11px', gap: 4 }}
                title="Duplicar tipo e editar medidas"
              >
                <Copy size={12} />
                <span>Duplicar</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {doorTypes.map((dt, idx) => {
                const isSelected = selectedDoorTypeIdx === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDoorTypeIdx(idx)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-main)',
                      border: `1px solid ${isSelected ? 'var(--cad-blue)' : 'var(--border-color)'}`,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: isSelected ? 600 : 400 }}>{dt.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {dt.width.toFixed(2)}m x {dt.height.toFixed(2)}m
                      </div>
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--cad-cyan)' }} />}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, padding: 12, background: 'rgba(56, 189, 248, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--cad-cyan)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Info size={14} />
                <span>Instrução de Inserção:</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Passe o cursor sobre qualquer parede para ancorar a porta. Pressione a tecla <strong>[Espaço]</strong> para inverter o sentido de abertura.
              </p>
            </div>
          </div>
        )}

        {/* Propriedades da Janela */}
        {activeTool === 'window' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
                Tipos de Janela
              </div>
              <button
                className="btn-secondary"
                onClick={handleDuplicateWindow}
                style={{ padding: '4px 8px', fontSize: '11px', gap: 4 }}
                title="Duplicar tipo e editar medidas"
              >
                <Copy size={12} />
                <span>Duplicar</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {windowTypes.map((wt, idx) => {
                const isSelected = selectedWindowTypeIdx === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedWindowTypeIdx(idx)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-main)',
                      border: `1px solid ${isSelected ? 'var(--cad-blue)' : 'var(--border-color)'}`,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: isSelected ? 600 : 400 }}>{wt.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {wt.width.toFixed(2)}m x {wt.height.toFixed(2)}m • Peit: {wt.sill.toFixed(2)}m
                      </div>
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--cad-cyan)' }} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Outras ferramentas */}
        {activeTool !== 'wall' && activeTool !== 'door' && activeTool !== 'window' && (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-dim)', fontSize: '13px' }}>
            Selecione uma ferramenta ou clique em um elemento da cena para inspecionar e editar suas propriedades paramétricas.
          </div>
        )}
      </div>
    </aside>
  );
};
