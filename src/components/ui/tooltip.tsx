"use client";

import * as React from "react";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ children, content, side = "top" }: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md whitespace-nowrap pointer-events-none ${sideClasses[side]}`}
        >
          {content}
          <div
            className={`absolute w-0 h-0 border-4 border-transparent ${
              side === "top"
                ? "top-full left-1/2 -translate-x-1/2 border-t-gray-900"
                : side === "bottom"
                ? "bottom-full left-1/2 -translate-x-1/2 border-b-gray-900"
                : side === "left"
                ? "left-full top-1/2 -translate-y-1/2 border-l-gray-900"
                : "right-full top-1/2 -translate-y-1/2 border-r-gray-900"
            }`}
          />
        </div>
      )}
    </div>
  );
}


