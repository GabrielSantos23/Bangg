'use client';

import * as React from 'react';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement } from 'platejs/react';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';

export function DateElement(props: PlateElementProps) {
  const { children, element, className, ...rest } = props;
  const date = (element?.date as string) || '';

  return (
    <PlateElement
      element={element}
      as="div"
      className={cn(
        'inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5',
        className
      )}
      {...rest}
    >
      <Calendar className="h-4 w-4" />
      <time dateTime={date}>
        {date ? new Date(date).toLocaleDateString() : 'Select date'}
      </time>
      {children}
    </PlateElement>
  );
}

