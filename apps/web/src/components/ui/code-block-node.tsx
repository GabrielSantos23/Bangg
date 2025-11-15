"use client";

import * as React from "react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import { cn } from "@/lib/utils";

export function CodeBlockElement(props: PlateElementProps) {
  const { children, element, className, ...rest } = props;

  return (
    <PlateElement
      element={element}
      as="pre"
      className={cn(
        "relative my-4 overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm",
        className
      )}
      {...rest}
    >
      <code>{children}</code>
    </PlateElement>
  );
}

export function CodeLineElement(props: PlateElementProps) {
  return <PlateElement as="div" {...props} />;
}

export function CodeSyntaxLeaf(props: PlateElementProps) {
  return <span {...props} />;
}
