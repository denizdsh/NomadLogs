interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: "h-8 w-8 text-label-sm",
  md: "h-10 w-10 text-label-md",
  lg: "h-12 w-12 text-label-lg",
  xl: "h-20 w-20 text-body-lg",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ src, alt, size = "md", className = "" }: AvatarProps) {
  const initials = getInitials(alt);

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`rounded-full object-cover flex-shrink-0 ${sizeClasses[size]} ${className}`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={alt}
      className={`rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold flex-shrink-0 ${sizeClasses[size]} ${className}`}
    >
      {initials}
    </span>
  );
}
