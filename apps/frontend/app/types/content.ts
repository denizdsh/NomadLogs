export type Visibility = "PRIVATE" | "UNLISTED" | "PUBLIC";

export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER" | "WARM_SEASONS" | "COLD_SEASONS" | "ALL";

export type ContentType = "blog" | "journal" | "travel-plan";
export type ContentTypeRaw = "BLOG" | "JOURNAL" | "TRAVEL_PLAN";

export type DbVerificationStatus = "VERIFIED" | "UNVERIFIED" | "PENDING";

export type UiVerificationStatus = "verified" | "unverified" | "pending";

export type OAuthProvider = "GOOGLE" | "APPLE" | "GITHUB" | "FACEBOOK";

export type UserRole =
  | "UNVERIFIED"
  | "TEMP_UNVERIFIED"
  | "SUSPENDED"
  | "BANNED"
  | "VERIFIED"
  | "TEMP_VERIFIED"
  | "EDITOR"
  | "ADMIN";

export type TravelPlanBlockType = "DAY" | "CUSTOM";
