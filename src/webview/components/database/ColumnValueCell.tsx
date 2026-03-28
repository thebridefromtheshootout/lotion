import React from "react";
import { DbColumn } from "../../types";
import { FormatCell } from "./tableview/FormatCell";

interface ColumnValueCellProps {
  column: DbColumn;
  value: string;
  baseUri: string;
}

export function ColumnValueCell({ column, value, baseUri }: ColumnValueCellProps) {
  return (
    <FormatCell
      value={value}
      type={column.type}
      baseUri={baseUri}
      maxWidth={column.maxWidth}
      maxHeight={column.maxHeight}
    />
  );
}
