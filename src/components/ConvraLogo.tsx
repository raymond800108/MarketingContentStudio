"use client";

import Image from "next/image";

interface ConvraLogoProps {
  /** Desired rendered height (e.g. "1.2rem", "2rem", "40px"). Default "1.4rem". */
  size?: string;
  /** Dark background? Light → PNG with multiply blend. Dark → CSS wordmark. */
  dark?: boolean;
  /** Wrap in an anchor to convra.net. Default false. */
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
  linked = false,
  className = "",
}: ConvraLogoProps) {
  const content = (
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
          display: "block",
          // Light: multiply removes white bg cleanly
          // Dark:  invert(white→black) + hue-rotate(tan blue→back to warm orange)
          //        then screen blend makes the black fully transparent
          ...(dark
            ? { filter: "invert(1) hue-rotate(180deg)", mixBlendMode: "screen" }
            : { mixBlendMode: "multiply" }),
        }}
        priority
        unoptimized
      />
    </span>
  );

  return content;
}
