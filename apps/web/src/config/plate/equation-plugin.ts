'use client';

import { createPlatePlugin } from 'platejs/react';
import { EquationElement } from '@/components/ui/equation-node';

export const EquationPlugin = createPlatePlugin({
  key: 'equation',
  node: {
    isElement: true,
    isVoid: true,
    component: EquationElement,
    defaultProps: {
      formula: '',
    },
  },
  shortcuts: {
    toggle: { keys: 'mod+shift+e' },
  },
  // Add deserialization support for markdown/HTML equations
  parsers: {
    html: {
      deserializer: {
        parse: ({ element }) => {
          // Support LaTeX in brackets: [E = mc^2]
          if (element.textContent) {
            const text = element.textContent.trim();
            // Check if it looks like a LaTeX equation (contains math symbols or is in brackets)
            if (
              (text.startsWith('[') && text.endsWith(']')) ||
              text.includes('\\') ||
              text.includes('^') ||
              text.includes('_') ||
              text.includes('frac')
            ) {
              const formula = text.replace(/^\[/, '').replace(/\]$/, '').trim();
              return {
                type: 'equation',
                formula,
                children: [{ text: '' }],
              };
            }
          }
          // Support math elements
          if (element.tagName === 'MATH' || element.getAttribute('data-math')) {
            const formula = element.getAttribute('data-math') || element.textContent || '';
            return {
              type: 'equation',
              formula: formula.trim(),
              children: [{ text: '' }],
            };
          }
        },
        query: ({ element }) => {
          // Check if element contains LaTeX-like content
          const text = element.textContent?.trim() || '';
          return (
            (text.startsWith('[') && text.endsWith(']') && text.length > 2) ||
            element.tagName === 'MATH' ||
            element.getAttribute('data-math') !== null
          );
        },
      },
    },
  },
  // Add transform to insert equation
}).extendTransforms(({ editor }) => ({
  insertEquation: (formula: string) => {
    editor.tf.insertNodes({
      type: 'equation',
      formula,
      children: [{ text: '' }],
    });
  },
}));

