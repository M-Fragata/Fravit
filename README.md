# Fravit — Software CAD/BIM de Desenho Técnico e Modelagem 3D

O **Fravit** é uma aplicação moderna de desenho técnico arquitetônico e modelagem 3D paramétrica inspirada no Revit, com execução ágil via navegador e suporte a empacotamento desktop (Tauri/Electron).

## 📐 Documentação e Planejamento Completo

O planejamento arquitetural e o passo a passo de desenvolvimento estão documentados em:
👉 **[PLANEJAMENTO.md](./PLANEJAMENTO.md)**

### Principais Destaques do Fravit:
- **Modelo BIM Paramétrico Unificado**: Desenho em 2D com geração simultânea e em tempo real da visualização 3D e dos cortes.
- **Elementos Arquitetônicos**: Paredes (miter join), Portas e Janelas (vão booleano automático), Pisos, Telhados, Escadas (fórmula de Blondel) e Ambientes com cálculo de m².
- **Precisão Técnica**: Snaps magnéticos (Endpoint, Midpoint, Ortho, Polar, entrada dinâmica de comprimento).
- **Cortes Paramétricos (Sections)**: Criação interativa de cortes com profundidade de visualização (*Far Clip Plane*) e geração de novas vistas.
- **Pranchas de Impressão**: Formatos A1–A4 com carimbo/selo técnico, viewports arrastáveis (drag-and-drop) em escalas 1:50 / 1:100 e exportação em **PDF Vetorial 1:1**.
- **Backend & Dashboard**: Backend em Node.js / Express / Prisma com autenticação JWT e tela inicial em grid com botão `+` para novo projeto e cards com miniaturas dos projetos salvos.
- **Portabilidade**: Salvamento e carregamento local de arquivos `.fravit` (JSON) e persistência no banco de dados.
