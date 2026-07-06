import type { ReactNode } from "react";
import type { OAuthProvider } from "~/types/content";

interface OAuthButtonProps {
  provider: Lowercase<OAuthProvider>;
  onClick: () => void;
  icon: ReactNode;
  loading?: boolean;
  disabled?: boolean;
}

const providerLabels: Record<string, string> = {
  google: "Continue with Google",
  apple: "Continue with Apple",
  github: "Continue with GitHub",
  facebook: "Continue with Facebook",
};

const providerStyles: Record<string, string> = {
  google: "bg-white text-gray-800 border border-gray-300 hover:bg-gray-50",
  apple: "bg-black text-white hover:bg-gray-900",
  github: "bg-[#24292F] text-white hover:bg-[#1B1F23]",
  facebook: "bg-[#1877F2] text-white hover:bg-[#166FE5]",
};

export function OAuthButton({
  provider,
  onClick,
  icon,
  loading = false,
  disabled = false,
}: OAuthButtonProps) {
  const isDisabled = loading || disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`flex items-center justify-center gap-3 w-full rounded-xl px-6 py-3.5 text-label-lg font-semibold transition-all duration-200 ${providerStyles[provider]} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {loading ? (
        <span
          className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading"
        />
      ) : (
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {icon}
        </span>
      )}
      {loading ? "Redirecting…" : providerLabels[provider]}
      {disabled && !loading && (
        <span className="text-xs opacity-60 ml-1">(Coming soon)</span>
      )}
    </button>
  );
}
