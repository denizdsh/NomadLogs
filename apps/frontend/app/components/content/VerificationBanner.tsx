import type { UiVerificationStatus } from "~/types/content";
import { UI_VERIFICATION_STATUSES } from "~/constants/content";

interface VerificationBannerProps {
  status: UiVerificationStatus;
}

const statusConfig: Record<UiVerificationStatus, { label: string; className: string; tagClass: string }> = {
  [UI_VERIFICATION_STATUSES.UNVERIFIED]: {
    label: "Unverified",
    className: "verification-unverified",
    tagClass: "bg-on-surface-muted/15 text-on-surface-muted",
  },
  [UI_VERIFICATION_STATUSES.PENDING]: {
    label: "Pending",
    className: "verification-pending",
    tagClass: "bg-warning/15 text-warning",
  },
  [UI_VERIFICATION_STATUSES.VERIFIED]: {
    label: "Verified",
    className: "verification-verified",
    tagClass: "bg-success/15 text-success",
  },
};

export function VerificationBanner({ status }: VerificationBannerProps) {
  const config = statusConfig[status];

  return (
    <header className={`${config.className} pt-1`}>
      {status !== UI_VERIFICATION_STATUSES.VERIFIED && (
        <span className={`inline-block rounded-full px-3 py-0.5 text-label-sm font-semibold ${config.tagClass} mt-3 ml-4`}>
          {config.label}
        </span>
      )}
    </header>
  );
}
