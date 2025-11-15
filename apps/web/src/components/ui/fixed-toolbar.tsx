'use client';

import * as React from 'react';

import { Toolbar } from '@/components/ui/toolbar';
import { cn } from '@/lib/utils';

/**
 * FixedToolbar - Toolbar fixa para o editor Plate
 * Fica fixa no topo do editor e contém botões de formatação
 * Usa o componente Toolbar do Radix UI para suportar RovingFocusGroup
 */
export function FixedToolbar({
  className,
  ...props
}: React.ComponentProps<typeof Toolbar>) {
  return (
    <Toolbar
      className={cn(
        'sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
      {...props}
    />
  );
}

