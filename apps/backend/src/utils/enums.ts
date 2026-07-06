import {
  UserRole,
  VerificationStatus,
  Visibility,
  ContentType,
  CommentStatus,
  OAuthProvider,
  NotificationType,
  Season,
  TravelPlanBlockType,
} from "@nomadlogs/db";
import { z } from "zod";

// Zod schemas for validation based on database-level enums
export const userRoleSchema = z.enum(UserRole);
export const verificationStatusSchema = z.enum(VerificationStatus);
export const visibilitySchema = z.enum(Visibility);
export const contentTypeSchema = z.enum(ContentType);
export const commentStatusSchema = z.enum(CommentStatus);
export const oauthProviderSchema = z.enum(OAuthProvider);
export const notificationTypeSchema = z.enum(NotificationType);
export const seasonSchema = z.enum(Season);
export const travelPlanBlockTypeSchema = z.enum(TravelPlanBlockType);

// Helper functions to get all listable values of the enums
export function getUserRoles(): UserRole[] {
  return Object.values(UserRole);
}

export function getVerificationStatuses(): VerificationStatus[] {
  return Object.values(VerificationStatus);
}

export function getVisibilities(): Visibility[] {
  return Object.values(Visibility);
}

export function getContentTypes(): ContentType[] {
  return Object.values(ContentType);
}

export function getCommentStatuses(): CommentStatus[] {
  return Object.values(CommentStatus);
}

export function getOauthProviders(): OAuthProvider[] {
  return Object.values(OAuthProvider);
}

export function getNotificationTypes(): NotificationType[] {
  return Object.values(NotificationType);
}

export function getSeasons(): Season[] {
  return Object.values(Season);
}

export function getTravelPlanBlockTypes(): TravelPlanBlockType[] {
  return Object.values(TravelPlanBlockType);
}
