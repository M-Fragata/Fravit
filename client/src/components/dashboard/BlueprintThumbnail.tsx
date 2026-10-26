import React from 'react';

interface BlueprintThumbnailProps {
  title: string;
}

export const BlueprintThumbnail: React.FC<BlueprintThumbnailProps> = ({ title }) => {
  // Gera um padrão procedural determinístico simples baseado no título
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const offset = (hash % 20);

  return (
    <svg width="100%" height="100%" viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <defs>
        {/* Grid Técnico CAD */}
        <pattern id={`cadGrid-${hash}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="0.8" />
        </pattern>
        <pattern id={`cadGridMajor-${hash}`} width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(56, 189, 248, 0.16)" strokeWidth="1.2" />
        </pattern>
      </defs>

      {/* Fundo Azul Escuro Técnico CAD */}
      <rect width="100%" height="100%" fill="#0d1421" />
      <rect width="100%" height="100%" fill={`url(#cadGrid-${hash})`} />
      <rect width="100%" height="100%" fill={`url(#cadGridMajor-${hash})`} />

      {/* Paredes Técnicas em Projeção */}
      <g stroke="#38bdf8" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Perímetro Externo */}
        <rect x={40 + offset} y="25" width="220" height="110" rx="2" stroke="rgba(56, 189, 248, 0.85)" strokeWidth="3" fill="rgba(37, 99, 235, 0.08)" />
        {/* Divisão Interna */}
        <line x1={130 + offset} y1="25" x2={130 + offset} y2="135" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2.5" />
        <line x1={40 + offset} y1="75" x2={130 + offset} y2="75" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2.5" />
      </g>

      {/* Abertura de Porta com Arco de 90 graus */}
      <g stroke="#10b981" strokeWidth="1.5" fill="none">
        <path d={`M ${130 + offset} 95 A 25 25 0 0 1 ${155 + offset} 120`} strokeDasharray="3 2" />
        <line x1={130 + offset} y1="95" x2={130 + offset} y2="120" stroke="#10b981" strokeWidth="2" />
      </g>

      {/* Janela Técnica */}
      <g stroke="#f59e0b" strokeWidth="1.5">
        <line x1={70 + offset} y1="25" x2={100 + offset} y2="25" strokeWidth="4" />
        <line x1={200 + offset} y1="135" x2={230 + offset} y2="135" strokeWidth="4" />
      </g>

      {/* Linha de Cota CAD */}
      <g stroke="rgba(148, 163, 184, 0.5)" strokeWidth="1" fill="#94a3b8">
        <line x1={35 + offset} y1="145" x2={265 + offset} y2="145" />
        <line x1={35 + offset} y1="140" x2={35 + offset} y2="150" />
        <line x1={265 + offset} y1="140" x2={265 + offset} y2="150" />
        <text x={145 + offset} y="153" fontSize="8" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">12.50m</text>
      </g>
    </svg>
  );
};
