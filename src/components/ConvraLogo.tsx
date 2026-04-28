"use client";

import Link from "next/link";
import Image from "next/image";

interface ConvraLogoProps {
  /** Desired rendered height (e.g. "1.2rem", "2rem", "40px"). Default "1.4rem". */
  size?: string;
  /** Dark background? Light → PNG with multiply blend. Dark → CSS wordmark. */
  dark?: boolean;
  /** Wrap in an anchor to convra.net. Default true. */
  linked?: boolean;
  className?: string;
}

/**
 * convra. logo component.
 *
 * Light theme → renders the actual PNG via mix-blend-mode:multiply so the
 *   white background disappears and only the real letterforms show.
 * Dark theme  → CSS wordmark (PNG is white-background, can't invert tan dot).
 *
 * The cropped PNG is 900×220px (aspect ratio 4.09:1).
 */
const PNG_ASPECT = 900 / 220; // width / height

export default function ConvraLogo({
  size = "1.4rem",
  dark = true,
  linked = true,
  className = "",
}: ConvraLogoProps) {
  const content = dark ? (
    // ── Dark: CSS wordmark ──────────────────────────────────────────
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "baseline", gap: 0, userSelect: "none" }}
    >
      <span style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 300,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "0.04em",
        color: "rgba(210,230,255,0.78)",
        transition: "color 0.2s ease",
      }}>convra</span>
      <span style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 300,
        fontSize: size,
        lineHeight: 1,
        color: "#d4a574",
      }}>.</span>
    </span>
  ) : (
    // ── Light: real PNG, white bg vanishes via multiply blend ───────
    <span
      className={className}
      style={{ display: "inline-block", lineHeight: 0, userSelect: "none" }}
    >
      <Image
        src="/convra-logo-crop.png"
        alt="convra."
        width={900}
        height={220}
        style={{
          height: size,
          width: `calc(${size} * ${PNG_ASPECT.toFixed(4)})`,
          mixBlendMode: "multiply",
          display: "block",
        }}
        priority
        unoptimized
      />
    </span>
  );

  if (!linked) return content;

  return (
    <Link
      href="https://convra.net"
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "inline-flex" }}
    >
      {content}
    </Link>
  );
}
