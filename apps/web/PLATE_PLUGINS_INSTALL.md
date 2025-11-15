# Instalação de Plugins do Plate

Este arquivo contém instruções para instalar os pacotes necessários para os novos plugins do Plate adicionados ao editor.

## Pacotes Necessários

Execute o seguinte comando para instalar todos os pacotes necessários:

```bash
npm install @platejs/code-block@^51.0.0 @platejs/link@^51.0.0 @platejs/date@^51.0.0 @platejs/equation@^51.0.0 @platejs/media@^51.0.0 @platejs/table@^51.0.0 lowlight highlight.js
```

Ou usando pnpm:

```bash
pnpm add @platejs/code-block@^51.0.0 @platejs/link@^51.0.0 @platejs/date@^51.0.0 @platejs/equation@^51.0.0 @platejs/media@^51.0.0 @platejs/table@^51.0.0 lowlight highlight.js
```

## Plugins Adicionados

Os seguintes plugins foram adicionados ao editor:

1. **Code Block** - Blocos de código com syntax highlighting
2. **Link** - Links clicáveis
3. **Date** - Elementos de data
4. **Equation** - Equações matemáticas usando KaTeX
5. **Media** - Imagens, vídeos, áudio e arquivos (com suporte a base64)
6. **Table** - Tabelas

## Funcionalidades

### Code Block
- Syntax highlighting usando lowlight
- Atalho: `Cmd/Ctrl + Alt + 8`

### Media (Base64)
- Imagens, vídeos e áudio são automaticamente convertidos para base64 antes de salvar no banco de dados
- Suporta upload de arquivos locais
- Suporta URLs externas (convertidas para base64)

### Table
- Criação de tabelas com células de cabeçalho e dados
- Suporte a múltiplas linhas e colunas

## Componentes Criados

Os seguintes componentes foram criados em `src/components/ui/`:

- `code-block-node.tsx` - Componentes para code blocks
- `link-node.tsx` - Componente para links
- `date-node.tsx` - Componente para datas
- `equation-node.tsx` - Componente para equações
- `media-node.tsx` - Componentes para mídia (imagem, vídeo, áudio, arquivo)
- `table-node.tsx` - Componentes para tabelas

## Utilitários

O arquivo `src/utils/media-utils.ts` contém funções utilitárias para:
- Converter arquivos para base64
- Processar valores do editor para converter media em base64 antes de salvar
- Verificar se uma URL já está em base64

## Notas

- O KaTeX já está instalado no projeto (usado para equações)
- O lowlight é usado para syntax highlighting em code blocks
- Media é automaticamente processado para base64 no hook `useSummaryEditor`

