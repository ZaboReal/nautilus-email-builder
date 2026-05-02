"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function GlassSurface({
  children,
  className = "",
  strong,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return (
    <div
      className={`${strong ? "glass-surface-strong" : "glass-surface"} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function GlassButton({
  children,
  className = "",
  variant = "default",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "accent" }) {
  const cls = variant === "accent" ? "glass-button-accent" : "glass-button";
  return (
    <button
      type="button"
      className={`${cls} px-3 py-2 text-sm font-medium ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function GlassIconButton({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`glass-button h-9 w-9 inline-flex items-center justify-center text-sm ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function GlassInput({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`glass-input px-3 py-2 text-sm ${className}`}
      {...rest}
    />
  );
}

export function GlassPill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-pill px-3 py-1 text-xs font-medium ${className}`}>
      {children}
    </div>
  );
}
