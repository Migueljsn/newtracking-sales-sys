"use client";

import { useState } from "react";
import {
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath,
  useReactFlow, type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";

export function JourneyEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, selected,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const active = hovered || selected;

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setEdges((es) => es.filter((edge) => edge.id !== id));
  }

  return (
    <>
      {/* Área invisível mais larga para facilitar hover/clique */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      <BaseEdge
        path={edgePath}
        style={{
          stroke:          active ? "var(--accent)" : "var(--border)",
          strokeWidth:     active ? 2 : 1.5,
          strokeDasharray: active ? "6 3" : undefined,
          transition:      "stroke 0.15s, stroke-dasharray 0.15s",
        }}
      />

      {selected && (
        <EdgeLabelRenderer>
          <div
            className="absolute pointer-events-auto nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          >
            <button
              title="Remover conexão"
              onClick={handleDelete}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger)] text-white shadow-sm hover:opacity-80 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
