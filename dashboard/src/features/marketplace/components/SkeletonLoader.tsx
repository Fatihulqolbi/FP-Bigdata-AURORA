import React from "react";

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export default function SkeletonLoader({ width, height, borderRadius, style }: SkeletonProps) {
  const mergedStyle: React.CSSProperties = { width, height, borderRadius, display: "block", ...style };

  return React.createElement("phantom-ui", {
    loading: true,
    animation: "shimmer",
    style: mergedStyle,
    "fallback-radius": 4,
  } as any);
}
