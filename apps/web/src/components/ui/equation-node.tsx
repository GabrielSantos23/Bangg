'use client';

import * as React from 'react';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement } from 'platejs/react';
import { cn } from '@/lib/utils';

export function EquationElement(props: PlateElementProps) {
  const { children, element, className, ...rest } = props;
  // Support both 'formula' and 'texExpression' properties
  const formula = (element?.formula as string) || (element?.texExpression as string) || '';
  const [html, setHtml] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!formula) {
      setHtml('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Dynamically import katex to avoid SSR issues
    import('katex')
      .then((katex) => {
        try {
          // Clean the formula - remove markdown delimiters if present
          const cleanFormula = formula
            .replace(/^\[/, '')
            .replace(/\]$/, '')
            .replace(/^\$\$/, '')
            .replace(/\$\$$/, '')
            .trim();

          if (!cleanFormula) {
            setHtml('');
            setIsLoading(false);
            return;
          }

          const rendered = katex.renderToString(cleanFormula, {
            throwOnError: false,
            displayMode: true,
            errorColor: '#cc0000',
          });
          setHtml(rendered);
          setError(null);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Invalid formula';
          setError(errorMsg);
          setHtml(`<span class="text-destructive">Error: ${errorMsg}</span>`);
        } finally {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        setError('Failed to load KaTeX');
        setHtml(`<span class="text-destructive">Failed to load KaTeX library</span>`);
        setIsLoading(false);
      });
  }, [formula]);

  if (!formula) {
    return (
      <PlateElement
        element={element}
        as="div"
        className={cn('my-4 flex justify-center text-muted-foreground', className)}
        {...rest}
      >
        <span className="text-sm">Empty equation</span>
        {children}
      </PlateElement>
    );
  }

  return (
    <PlateElement
      element={element}
      as="div"
      className={cn('my-4 flex justify-center', className)}
      {...rest}
    >
      {isLoading ? (
        <span className="text-muted-foreground text-sm">Loading equation...</span>
      ) : html ? (
        <div
          // biome-ignore lint/security/noDangerouslySetInnerHtml: needed for katex
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <span className="text-destructive text-sm">
          {error || 'Failed to render equation'}
        </span>
      )}
      {children}
    </PlateElement>
  );
}

