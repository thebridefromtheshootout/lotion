import React from "react";

// Thin wrapper around VS Code Codicons. The font + .codicon-* class rules
// are bundled into every app's CSS via bootstrapRoot.tsx. Use `name` without
// the `codicon-` prefix, e.g. <Icon name="add" />.

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: number | string;
  spin?: boolean;
}

export function Icon({ name, size, spin, className, style, ...rest }: IconProps): React.JSX.Element {
  const classes = ["codicon", `codicon-${name}`];
  if (spin) classes.push("codicon-modifier-spin");
  if (className) classes.push(className);
  const styleWithSize =
    size === undefined ? style : { ...style, fontSize: typeof size === "number" ? `${size}px` : size };
  return <span className={classes.join(" ")} style={styleWithSize} aria-hidden="true" {...rest} />;
}
