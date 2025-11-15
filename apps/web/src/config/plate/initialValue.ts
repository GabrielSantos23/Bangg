import type { Value } from "platejs";

/**
 * Valor inicial padrão do editor Plate
 * Define o conteúdo inicial quando o editor é criado
 */
export const initialPlateValue: Value = [
  {
    type: "p",
    children: [{ text: "" }],
  },
];

/**
 * Cria um valor inicial com conteúdo customizado
 */
export function createInitialValue(content?: string): Value {
  if (!content) {
    return initialPlateValue;
  }

  // Para conteúdo simples, criar um parágrafo único
  return [
    {
      type: "p",
      children: [{ text: content }],
    },
  ];
}

/**
 * Cria um valor inicial com múltiplos parágrafos a partir de texto
 */
export function createValueFromText(text: string): Value {
  if (!text) {
    return initialPlateValue;
  }

  // Dividir por linhas e criar parágrafos
  const lines = text.split("\n").filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return initialPlateValue;
  }

  return lines.map((line) => ({
    type: "p",
    children: [{ text: line.trim() }],
  }));
}
