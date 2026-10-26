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

  const handleSelectDoorType = (idx: number) => {
    setSelectedDoorTypeIdx(idx);
    const dt = doorTypes[idx];
    bimStore.setDoorDefaults(dt.width, dt.height);
  };

  const handleSelectWindowType = (idx: number) => {
    setSelectedWindowTypeIdx(idx);
    const wt = windowTypes[idx];
    bimStore.setWindowDefaults(wt.width, wt.height, wt.sill);
  };

  // Duplicar Tipo de Porta
  const handleDuplicateDoor = () => {
    const current = doorTypes[selectedDoorTypeIdx];
    const newName = prompt('Nome do novo tipo de porta:', `${current.name} (Cópia)`);
    if (!newName) return;
    const newWidth = parseFloat(prompt('Largura da porta em metros (ex: 0.90):', current.width.toString()) || current.width.toString());
    const newHeight = parseFloat(prompt('Altura da porta em metros (ex: 2.10):', current.height.toString()) || current.height.toString());

    const newType = { name: newName, width: newWidth, height: newHeight };
    const nextList = [...doorTypes, newType];
    setDoorTypes(nextList);
    setSelectedDoorTypeIdx(nextList.length - 1);
    bimStore.setDoorDefaults(newWidth, newHeight);
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
    const nextList = [...windowTypes, newType];
    setWindowTypes(nextList);
    setSelectedWindowTypeIdx(nextList.length - 1);
    bimStore.setWindowDefaults(newWidth, newHeight, newSill);
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
                    onClick={() => handleSelectDoorType(idx)}
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
                    onClick={() => handleSelectWindowType(idx)}
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

        {/* Propriedades do Piso */}
        {activeTool === 'floor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
              Piso / Laje Estrutural
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Espessura padrão: <strong>15 cm</strong>
            </div>
            <div style={{ padding: 12, background: 'rgba(56, 189, 248, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--cad-cyan)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Info size={14} />
                <span>Como Desenhar:</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Clique nos cantos para delimitar o perímetro do piso. Para finalizar, clique de volta no primeiro ponto inicial.
              </p>
            </div>
          </div>
        )}

        {/* Propriedades do Telhado */}
        {activeTool === 'roof' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
              Telhado / Cobertura
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Inclinação: <strong>10% (Caimento)</strong> • Beiral: <strong>0.60 m</strong>
            </div>
            <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Desenhe o contorno da cobertura clicando nos vértices. Feche no ponto inicial para gerar a laje de topo impermeabilizada.
              </p>
            </div>
          </div>
        )}

        {/* Propriedades da Escada */}
        {activeTool === 'stair' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
              Escada Paramétrica
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Fórmula de Blondel: <strong>2E + P = 63 cm</strong><br />
              Espelho: <strong>17.5 cm</strong> • Piso: <strong>28 cm</strong><br />
              Largura do lance: <strong>0.90 m</strong>
            </div>
            <div style={{ padding: 12, background: 'rgba(56, 189, 248, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                1º Clique: Ponto de partida (piso inferior).<br />
                2º Clique: Topo do lance. A escada calcula automaticamente o número exato de degraus.
              </p>
            </div>
          </div>
        )}

        {/* Propriedades do Ambiente */}
        {activeTool === 'room' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
              Ambiente com Área (m²)
            </div>
            <div style={{ padding: 12, background: 'rgba(34, 197, 94, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Info size={14} />
                <span>Detecção Automática:</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Passe o mouse dentro de qualquer espaço fechado por paredes ou separadores. O Fravit calcula a área líquida e aplica a etiqueta técnica com nome e m².
              </p>
            </div>
          </div>
        )}

        {/* Propriedades do Separador de Ambiente */}
        {activeTool === 'roomSeparator' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
              Separador de Ambiente
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Linha virtual traço-ponto para delimitar recintos integrados (ex: dividir Sala de Estar e Sala de Jantar sem parede física).
            </p>
          </div>
        )}

        {/* Propriedades da Cota Alinhada */}
        {activeTool === 'dimension' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
              Cota Alinhada (ABNT NBR 6492)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Estilo: <strong>Arquitetônico (Ticks 45°)</strong><br />
              Unidade: <strong>Metros (2 casas decimais)</strong>
            </div>
            <div style={{ padding: 12, background: 'rgba(56, 189, 248, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--cad-cyan)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Info size={14} />
                <span>Fluxo em 3 Cliques:</span>
              </div>
              <ol style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
                <li><strong>1º Clique:</strong> Ponto inicial (com snap magnético em quinas e eixos)</li>
                <li><strong>2º Clique:</strong> Ponto final da medição</li>
                <li><strong>3º Clique:</strong> Posição e afastamento da linha de cota</li>
              </ol>
            </div>
          </div>
        )}

        {/* Propriedades do Corte Paramétrico */}
        {activeTool === 'section' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cad-cyan)', textTransform: 'uppercase' }}>
              Corte Paramétrico (NBR 6492)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Simbologia: <strong>Traço-ponto com círculos A-A</strong><br />
              Profundidade de corte: <strong>5.00 m (Ajustável)</strong>
            </div>
            <div style={{ padding: 12, background: 'rgba(56, 189, 248, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--cad-cyan)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Info size={14} />
                <span>Como Utilizar:</span>
              </div>
              <ol style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
                <li><strong>1º Clique:</strong> Ponto inicial do plano de corte</li>
                <li><strong>2º Clique:</strong> Ponto final da linha de corte</li>
              </ol>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.4 }}>
                Ao criar o corte, ele é listado no <em>Navegador de Projeto</em>. Clique nele para abrir a visualização fatiada com linhas de nível!
              </p>
            </div>
          </div>
        )}

        {/* Outras ferramentas */}
        {activeTool === 'select' && (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-dim)', fontSize: '13px' }}>
            Selecione uma ferramenta na barra esquerda ou clique em um elemento na tela para inspecionar e editar suas propriedades paramétricas.
          </div>
        )}
      </div>
    </aside>
  );
};
