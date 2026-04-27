"use client";

import { useRef, useState } from "react";

/**
 * 3D Orbit Camera Control — an SVG widget with three physical drag handles
 * that encode camera position relative to a product. More intuitive than
 * three raw sliders because the user sees where the camera *is* in space.
 *
 * Encodes:
 *   horizontalAngle  — 0..360°  (0 = front, 90 = right, 180 = back, 270 = left)
 *   verticalAngle    — −30..90° (below eye level → straight overhead)
 *   zoom             — 0..10    (close-up → wide shot)
 */

const W = 560;
const H = 400;
const CX = W / 2;
const CY = H / 2 + 30;
const ORBIT_RX = 200;
const ORBIT_RY = 60;
const DOME_HEIGHT = 160;

const TEAL = "#06b6d4";
const PINK = "#ec4899";
const AMBER = "#f59e0b";
const GHOST = "#d4d1cd";

export interface OrbitParams {
  horizontalAngle: number;
  verticalAngle: number;
  zoom: number;
}

interface OrbitCameraControlProps {
  value: OrbitParams;
  onChange: (next: OrbitParams) => void;
  /** Optional product image to render inside the orbit's center rectangle so
   *  users see the camera orbiting their actual product, not a placeholder. */
  productImageUrl?: string | null;
}

type DragTarget = "azimuth" | "elevation" | "zoom" | null;

function horizontalLabel(deg: number): string {
  const bucket = Math.round(deg / 45) % 8;
  return [
    "Front",
    "Front-Right",
    "Right",
    "Back-Right",
    "Back",
    "Back-Left",
    "Left",
    "Front-Left",
  ][bucket];
}

export default function OrbitCameraControl({
  value,
  onChange,
  productImageUrl,
}: OrbitCameraControlProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<DragTarget>(null);
  const [hover, setHover] = useState<DragTarget>(null);

  const { horizontalAngle, verticalAngle, zoom } = value;

  // ── 3D → 2D projection ──────────────────────────────────────────
  const azRad = (horizontalAngle / 180) * Math.PI;
  const azX = Math.sin(azRad);
  const azZ = Math.cos(azRad);

  const elevNorm = Math.max(0, (verticalAngle + 30) / 120); // 0..1
  const elevRad = elevNorm * (Math.PI / 2);
  const cosElev = Math.cos(elevRad);
  const sinElev = Math.sin(elevRad);

  const camX = CX + azX * cosElev * ORBIT_RX;
  const camY = CY - sinElev * DOME_HEIGHT + azZ * cosElev * ORBIT_RY;

  // Direction from camera toward product center
  const productY = CY - 30;
  const lookDx = CX - camX;
  const lookDy = productY - camY;
  const lookLen = Math.hypot(lookDx, lookDy) || 1;
  const ndx = lookDx / lookLen;
  const ndy = lookDy / lookLen;
  const lookAngle = Math.atan2(lookDy, lookDx) * (180 / Math.PI);

  // Zoom handle — slides along the sight line between camera and product.
  const distLineLen = Math.min(lookLen * 0.6, 80);
  const zoomHandleX = camX + ndx * distLineLen * (zoom / 10);
  const zoomHandleY = camY + ndy * distLineLen * (zoom / 10);

  // Azimuth handle on the orbit ellipse (ignores elevation so it always
  // stays on the ring, giving users a stable 0..360° control surface).
  const azHandleX = CX + Math.sin(azRad) * ORBIT_RX;
  const azHandleY = CY + Math.cos(azRad) * ORBIT_RY;

  // ── Pointer handling ────────────────────────────────────────────
  const onPointerDown =
    (target: DragTarget) => (e: React.PointerEvent<SVGElement>) => {
      e.preventDefault();
      setDragging(target);
      (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top) * (H / rect.height);

    if (dragging === "azimuth") {
      let a = Math.atan2(px - CX, py - CY) * (180 / Math.PI);
      if (a < 0) a += 360;
      onChange({
        ...value,
        horizontalAngle: (Math.round(a / 5) * 5) % 360,
      });
    } else if (dragging === "elevation") {
      // Combined — horizontal from X, vertical from Y
      let a = Math.atan2(px - CX, py - CY) * (180 / Math.PI);
      if (a < 0) a += 360;
      const relY = (CY - py) / DOME_HEIGHT;
      const clamped = Math.max(0, Math.min(1, relY));
      const v = Math.round((-30 + clamped * 120) / 5) * 5;
      onChange({
        ...value,
        horizontalAngle: (Math.round(a / 5) * 5) % 360,
        verticalAngle: Math.max(-30, Math.min(90, v)),
      });
    } else if (dragging === "zoom") {
      const dx = px - camX;
      const dy = py - camY;
      const proj = (dx * ndx + dy * ndy) / distLineLen;
      const clamped = Math.max(0, Math.min(1, proj));
      onChange({
        ...value,
        zoom: Math.round(clamped * 20) / 2, // 0.5 step
      });
    }
  };

  const onPointerUp = () => setDragging(null);

  // ── Scene helpers ──────────────────────────────────────────────
  // Elevation arc (pink) — drawn from base of dome up to current elevation
  // using a quadratic Bezier curve for a simple arc approximation.
  const domeBaseX = CX;
  const domeBaseY = CY;
  const domeTopX = camX;
  const domeTopY = camY;
  const domeArcPath = `M ${domeBaseX} ${domeBaseY} Q ${(domeBaseX + domeTopX) / 2} ${domeBaseY - DOME_HEIGHT * 0.4} ${domeTopX} ${domeTopY}`;

  // Meridian arcs (ghost lines for depth)
  const meridians = [0, 45, 90, 135].map((m) => {
    const rad = (m / 180) * Math.PI;
    const mx1 = CX + Math.sin(rad) * ORBIT_RX;
    const my1 = CY + Math.cos(rad) * ORBIT_RY;
    const mx2 = CX - Math.sin(rad) * ORBIT_RX;
    const my2 = CY - Math.cos(rad) * ORBIT_RY;
    return (
      <path
        key={m}
        d={`M ${mx1} ${my1} Q ${CX} ${CY - DOME_HEIGHT} ${mx2} ${my2}`}
        stroke={GHOST}
        strokeWidth={1}
        fill="none"
        strokeDasharray="4 4"
        opacity={0.25}
      />
    );
  });

  const handleGlow = (target: DragTarget) =>
    dragging === target || hover === target;

  return (
    <div className="w-full select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full block"
        style={{ touchAction: "none" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <filter id="handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* ── Ghost meridians (depth cue) ── */}
        {meridians}

        {/* ── Elevation arc highlight (pink, base→current) ── */}
        <path
          d={domeArcPath}
          stroke={PINK}
          strokeWidth={1.5}
          fill="none"
          opacity={0.35}
          strokeDasharray="3 3"
        />

        {/* ── Orbit ring ── */}
        <ellipse
          cx={CX}
          cy={CY}
          rx={ORBIT_RX}
          ry={ORBIT_RY}
          stroke={TEAL}
          strokeWidth={1.5}
          fill="none"
          strokeDasharray="2 4"
          opacity={0.55}
        />

        {/* ── Orbit tick marks at 45° increments ── */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const rad = (a / 180) * Math.PI;
          const tx = CX + Math.sin(rad) * ORBIT_RX;
          const ty = CY + Math.cos(rad) * ORBIT_RY;
          return (
            <circle key={a} cx={tx} cy={ty} r={2} fill={TEAL} opacity={0.6} />
          );
        })}

        {/* ── Axis labels on the orbit ── */}
        <text x={CX} y={CY + ORBIT_RY + 18} textAnchor="middle" fontSize="11" fill={GHOST} fontWeight={500}>
          0° Front
        </text>
        <text x={CX + ORBIT_RX + 18} y={CY + 4} textAnchor="start" fontSize="11" fill={GHOST} fontWeight={500}>
          90° R
        </text>
        <text x={CX} y={CY - ORBIT_RY - 10} textAnchor="middle" fontSize="11" fill={GHOST} fontWeight={500}>
          180° Back
        </text>
        <text x={CX - ORBIT_RX - 18} y={CY + 4} textAnchor="end" fontSize="11" fill={GHOST} fontWeight={500}>
          270° L
        </text>

        {/* ── Product preview (box at orbit center, above the ring) ── */}
        <defs>
          <clipPath id="orbit-product-clip">
            <rect x={CX - 44} y={productY - 54} width={88} height={108} rx={6} />
          </clipPath>
        </defs>
        <rect
          x={CX - 44}
          y={productY - 54}
          width={88}
          height={108}
          rx={6}
          fill="#faf9f6"
          stroke={GHOST}
          strokeWidth={1.5}
        />
        {productImageUrl ? (
          <image
            href={productImageUrl}
            x={CX - 44}
            y={productY - 54}
            width={88}
            height={108}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#orbit-product-clip)"
            style={{ pointerEvents: "none" }}
          />
        ) : (
          <text
            x={CX}
            y={productY + 4}
            textAnchor="middle"
            fontSize="11"
            fill="#9ca3af"
            fontWeight={500}
            letterSpacing="0.05em"
          >
            PRODUCT
          </text>
        )}

        {/* ── Sight line from camera to product ── */}
        <line
          x1={camX}
          y1={camY}
          x2={CX}
          y2={productY}
          stroke={GHOST}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.5}
        />

        {/* ── Zoom handle (amber, on sight line) ── */}
        <g
          onPointerDown={onPointerDown("zoom")}
          onPointerEnter={() => setHover("zoom")}
          onPointerLeave={() => setHover(null)}
          style={{ cursor: dragging === "zoom" ? "grabbing" : "grab" }}
        >
          {/* glow ring */}
          {handleGlow("zoom") && (
            <circle cx={zoomHandleX} cy={zoomHandleY} r={18} fill={AMBER} opacity={0.12} />
          )}
          {/* invisible hit target */}
          <circle cx={zoomHandleX} cy={zoomHandleY} r={22} fill="transparent" />
          {/* visible handle */}
          <circle
            cx={zoomHandleX}
            cy={zoomHandleY}
            r={handleGlow("zoom") ? 8 : 6}
            fill={AMBER}
            filter="url(#handle-shadow)"
          />
        </g>

        {/* ── Azimuth handle (teal, on orbit ring) ── */}
        <g
          onPointerDown={onPointerDown("azimuth")}
          onPointerEnter={() => setHover("azimuth")}
          onPointerLeave={() => setHover(null)}
          style={{ cursor: dragging === "azimuth" ? "grabbing" : "grab" }}
        >
          {handleGlow("azimuth") && (
            <circle cx={azHandleX} cy={azHandleY} r={18} fill={TEAL} opacity={0.15} />
          )}
          <circle cx={azHandleX} cy={azHandleY} r={22} fill="transparent" />
          <circle
            cx={azHandleX}
            cy={azHandleY}
            r={handleGlow("azimuth") ? 8 : 6}
            fill={TEAL}
            filter="url(#handle-shadow)"
          />
        </g>

        {/* ── Elevation handle (pink camera, rotates to face product) ── */}
        <g
          onPointerDown={onPointerDown("elevation")}
          onPointerEnter={() => setHover("elevation")}
          onPointerLeave={() => setHover(null)}
          style={{ cursor: dragging === "elevation" ? "grabbing" : "grab" }}
          transform={`translate(${camX} ${camY}) rotate(${lookAngle})`}
        >
          {handleGlow("elevation") && (
            <circle r={20} fill={PINK} opacity={0.12} />
          )}
          <circle r={26} fill="transparent" />
          {/* Camera icon — small body + lens pointing toward product (+X) */}
          <g filter="url(#handle-shadow)">
            <rect
              x={-9}
              y={-7}
              width={14}
              height={14}
              rx={2}
              fill={PINK}
            />
            {/* Lens (pointing toward product = +X direction after rotate) */}
            <circle cx={8} cy={0} r={5} fill={PINK} />
            <circle cx={8} cy={0} r={2.5} fill="#fdf2f8" />
          </g>
        </g>
      </svg>

      {/* ── Legend ── */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: TEAL }} />
          Horizontal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: PINK }} />
          Vertical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: AMBER }} />
          Zoom
        </span>
      </div>

      {/* ── Live readout ── */}
      <div className="text-center mt-2 text-sm font-mono text-foreground">
        {horizontalAngle}° {horizontalLabel(horizontalAngle)}
        <span className="text-muted"> · </span>
        {verticalAngle > 0 ? "+" : ""}
        {verticalAngle}°
        <span className="text-muted"> · </span>
        {zoom.toFixed(1)}× zoom
      </div>
    </div>
  );
}
