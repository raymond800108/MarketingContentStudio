"use client";

import Link from "next/link";

interface ConvraLogoProps {
  /** Font size in rem or px — default "1.25rem" */
  size?: string;
  /** Whether the background is dark — adjusts text color */
  dark?: boolean;
  /** Wrap in an anchor to convra.net — default true */
  linked?: boolean;
  className?: string;
}

/**
 * convra. wordmark component.
 * Uses Plus Jakarta Sans font-light (300) — same weight as the brand logo.
 * "." is always in brand tan #d4a574.
 * Text color adapts to dark/light theme via the `dark` prop.
 */
export default function ConvraLogo({
  size = "1.25rem",
  dark = true,
  linked = true,
  className = "",
}: ConvraLogoProps) {
  const textColor = dark ? "rgba(210,230,255,0.78)" : "#787878";

  const wordmark = (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 0,
        textDecoration: "none",
        userSelect: "none",
      }}
    >
      <span
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontWeight: 300,
          fontSize: size,
          lineHeight: 1,
          letterSpacing: "0.04em",
          color: textColor,
          transition: "color 0.2s ease",
        }}
      >
        convra
      </span>
      <span
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontWeight: 300,
          fontSize: size,
          lineHeight: 1,
          color: "#d4a574",
        }}
      >
        .
      </span>
    </span>
  );

  if (!linked) return wordmark;

  return (
    <Link
      href="https://convra.net"
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none" }}
    >
      {wordmark}
    </Link>
  );
}
