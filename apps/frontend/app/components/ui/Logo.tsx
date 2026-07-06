interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Logo({ size = "md", className = "" }: LogoProps) {
  const iconSize = size === "sm" ? 22 : size === "lg" ? 36 : 28;
  const textSize = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";

  return (
    <div className={`flex items-center gap-2.5 select-none group ${className}`}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary group-hover:scale-110 transition-transform duration-300"
      >
        {/* Globe Outline / Compass Ring */}
        <circle
          cx="16"
          cy="16"
          r="13"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        
        {/* Dashed Latitudinal Grid Lines */}
        <circle
          cx="16"
          cy="16"
          r="8"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 2"
          className="opacity-60"
        />

        {/* Dynamic travel route S-curve representing path logs */}
        <path
          d="M8 20C12 20 12 12 16 12C20 12 20 20 24 20"
          stroke="var(--secondary)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Compass needle pointing North */}
        <path
          d="M16 5L20 13L16 10L12 13L16 5Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`font-serif font-extrabold tracking-tight ${textSize} text-on-surface`}>
        Nomad<span className="text-primary font-serif font-normal italic">Logs</span>
      </span>
    </div>
  );
}
