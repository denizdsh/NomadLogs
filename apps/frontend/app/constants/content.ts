import type {
  Visibility,
  Season,
  ContentType,
  DbVerificationStatus,
  UiVerificationStatus,
  UserRole,
  TravelPlanBlockType,
} from "~/types/content";

export const VISIBILITIES = {
  PRIVATE: "PRIVATE",
  UNLISTED: "UNLISTED",
  PUBLIC: "PUBLIC",
} as const satisfies Record<Visibility, Visibility>;

export const SEASONS = {
  SPRING: "SPRING",
  SUMMER: "SUMMER",
  AUTUMN: "AUTUMN",
  WINTER: "WINTER",
  WARM_SEASONS: "WARM_SEASONS",
  COLD_SEASONS: "COLD_SEASONS",
  ALL: "ALL",
} as const satisfies Record<Season, Season>;

export const CONTENT_TYPES = {
  BLOG: "blog",
  JOURNAL: "journal",
  TRAVEL_PLAN: "travel-plan",
} as const satisfies Record<string, ContentType>;

export const DB_VERIFICATION_STATUSES = {
  VERIFIED: "VERIFIED",
  UNVERIFIED: "UNVERIFIED",
  PENDING: "PENDING",
} as const satisfies Record<DbVerificationStatus, DbVerificationStatus>;

export const UI_VERIFICATION_STATUSES = {
  VERIFIED: "verified",
  UNVERIFIED: "unverified",
  PENDING: "pending",
} as const satisfies Record<string, UiVerificationStatus>;

export const USER_ROLES = {
  UNVERIFIED: "UNVERIFIED",
  TEMP_UNVERIFIED: "TEMP_UNVERIFIED",
  SUSPENDED: "SUSPENDED",
  BANNED: "BANNED",
  VERIFIED: "VERIFIED",
  TEMP_VERIFIED: "TEMP_VERIFIED",
  EDITOR: "EDITOR",
  ADMIN: "ADMIN",
} as const satisfies Record<UserRole, UserRole>;

export const BLOCK_TYPES = {
  DAY: "DAY",
  CUSTOM: "CUSTOM",
} as const satisfies Record<TravelPlanBlockType, TravelPlanBlockType>;
