# Configuração do Plate Editor

## Instalação de Pacotes Necessários

Para usar todas as funcionalidades de formatação automática, você precisa instalar os seguintes pacotes:

```bash
npm install @platejs/autoformat @platejs/list @platejs/indent
```

## Funcionalidades de Autoformat

Após instalar os pacotes, as seguintes formatações automáticas estarão disponíveis:

### Headings
- `# ` → H1
- `## ` → H2
- `### ` → H3
- `#### ` → H4
- `##### ` → H5
- `###### ` → H6

### Blockquote
- `> ` → Blockquote

### Listas
- `- ` ou `* ` → Lista com marcadores (bulleted list)
- `1. `, `2. `, etc. → Lista numerada (numbered list)

### Formatação de Texto (Marks)
- `**texto**` → **negrito**
- `*texto*` → *itálico*
- `__texto__` → <u>sublinhado</u>

## Como Usar

1. Digite `- ` ou `* ` no início de uma linha e pressione espaço → cria uma lista com marcadores
2. Digite `1. ` no início de uma linha e pressione espaço → cria uma lista numerada
3. Digite `**texto**` → aplica negrito automaticamente
4. Digite `*texto*` → aplica itálico automaticamente
5. Digite `# ` no início de uma linha → cria um H1

