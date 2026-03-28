import React from "react";

interface NamedColumn {
  name: string;
}

interface ColumnNameOptionsProps {
  columns: NamedColumn[];
}

export function ColumnNameOptions({ columns }: ColumnNameOptionsProps) {
  return (
    <>
      {columns.map((column) => (
        <option key={column.name} value={column.name}>
          {column.name}
        </option>
      ))}
    </>
  );
}
