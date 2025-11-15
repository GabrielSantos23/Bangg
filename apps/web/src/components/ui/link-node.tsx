'use client';

import * as React from 'react';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement, useEditorRef } from 'platejs/react';
import { cn } from '@/lib/utils';

export function LinkElement(props: PlateElementProps) {
  const { children, element, className, ...rest } = props;
  const url = (element?.url as string) || '';

  return (
    <PlateElement
      element={element}
      as="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'text-primary underline decoration-primary underline-offset-4',
        className
      )}
      {...rest}
    >
      {children}
    </PlateElement>
  );
}

