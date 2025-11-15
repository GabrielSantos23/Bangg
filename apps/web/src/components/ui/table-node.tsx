"use client";

import * as React from "react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import { cn } from "@/lib/utils";

export function TableElement(props: PlateElementProps) {
  const { element, children, ...rest } = props;
  return (
    <PlateElement
      element={element}
      as="div"
      className="my-4 w-full overflow-x-auto"
      {...rest}
    >
      <table className="w-full border-collapse border border-border">
        {children}
      </table>
    </PlateElement>
  );
}

export function TableRowElement(props: PlateElementProps) {
  const { element, ...rest } = props;
  return (
    <PlateElement
      element={element}
      as="tr"
      className="border-b border-border"
      {...rest}
    />
  );
}

export function TableCellElement(props: PlateElementProps) {
  const { children, element, className, ...rest } = props;
  // Check if this is a header cell based on element type
  const isHeader = element?.type === "th" || (element as any)?.header === true;

  return (
    <PlateElement
      element={element}
      as={isHeader ? "th" : "td"}
      className={cn(
        "border border-border px-4 py-2",
        isHeader && "bg-muted font-semibold",
        className
      )}
      {...rest}
    >
      {children}
    </PlateElement>
  );
}
