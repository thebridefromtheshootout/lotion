import React from "react";

interface ViewControlSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

export function ViewControlSelect({ label, value, onChange, children }: ViewControlSelectProps) {
  return (
    <>
      <label className="view-control-label">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="view-control-select">
        {children}
      </select>
    </>
  );
}
