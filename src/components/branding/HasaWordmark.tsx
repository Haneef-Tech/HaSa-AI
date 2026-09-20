import React from "react";
import { HasaLogo } from "./HasaLogo";

interface HasaWordmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const HasaWordmark: React.FC<HasaWordmarkProps> = ({
  className = "",
  size = "md",
}) => {
  const iconSize = size === "sm" ? 22 : size === "lg" ? 36 : 26;
  const textSize = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <HasaLogo size={iconSize} />
      <span className={`font-semibold tracking-tight ${textSize} text-foreground flex items-center`}>
        HaSa
        <span className="text-accent-light font-bold ml-1">AI</span>
      </span>
    </div>
  );
};

