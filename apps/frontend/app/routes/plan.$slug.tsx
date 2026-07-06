import { useState, Suspense, lazy } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { SplitPane } from "~/components/layout/SplitPane";
import { Tag } from "~/components/ui/Tag";
import { Badge } from "~/components/ui/Badge";
import { SupportSection } from "~/components/content/ContentSections";
import {
  CommentSection,
  type Comment,
} from "~/components/content/CommentSection";
import { ContentDetailsHeader } from "~/components/content/ContentDetailsHeader";
import { trpc, type RouterOutputs } from "~/utils/trpc";
import { useAuth } from "~/providers/AuthProvider";
import { useToast } from "~/providers/ToastProvider";
import { Modal } from "~/components/ui/Modal";
import { mapComment } from "~/utils/mappers";
import type {
  Visibility,
  DbVerificationStatus,
  UiVerificationStatus,
  UserRole,
} from "~/types/content";
import {
  VISIBILITIES,
  USER_ROLES,
  DB_VERIFICATION_STATUSES,
  BLOCK_TYPES,
} from "~/constants/content";
import { ROUTES } from "~/constants/routes";

type PlanDetailType = NonNullable<RouterOutputs["travelPlan"]["getBySlug"]>;

interface EditorJsBlock {
  type: string;
  data: {
    text?: string;
    level?: number;
    file?: { url?: string };
    url?: string;
    caption?: string;
    style?: "ordered" | "unordered";
    items?: string[];
  };
}

interface EditorJsContent {
  blocks?: EditorJsBlock[];
  text?: string;
}

export function meta() {
  return [
    { title: "Travel Plan — NomadLogs" },
    { name: "description", content: "View this travel plan on NomadLogs." },
  ];
}

function renderEditorJs(content: unknown): string {
  if (!content) return "";
  let parsed: EditorJsContent = {};
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content) as EditorJsContent;
    } catch {
      return content;
    }
  } else {
    parsed = content as EditorJsContent;
  }
  if (!parsed.blocks) return parsed.text || "";

  return parsed.blocks
    .map((block) => {
      switch (block.type) {
        case "header":
          return `<h${block.data.level || 2}>${block.data.text || ""}</h${block.data.level || 2}>`;
        case "paragraph":
          return `<p>${block.data.text || ""}</p>`;
        case "image":
          const url = block.data.file?.url || block.data.url || "";
          return `<figure class="my-6"><img src="${url}" alt="${block.data.caption || ""}" class="rounded-xl w-full" /><figcaption class="text-center text-sm text-on-surface-muted mt-2">${block.data.caption || ""}</figcaption></figure>`;
        case "list":
          const tag = block.data.style === "ordered" ? "ol" : "ul";
          const listClass =
            block.data.style === "ordered"
              ? "list-decimal pl-6"
              : "list-disc pl-6";
          const items = (block.data.items || [])
            .map((item) => `<li>${item}</li>`)
            .join("");
          return `<${tag} class="${listClass}">${items}</${tag}>`;
        default:
          return "";
      }
    })
    .join("");
}

const MapView = lazy(() =>
  import("~/components/map/MapView").then((m) => ({ default: m.MapView })),
);

export default function TravelPlanDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const isAuthenticated = !!user;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Fetch plan data
  const {
    data: planData,
    isLoading,
    error,
  } = trpc.travelPlan.getBySlug.useQuery({ slug: slug! });
  const plan = planData as PlanDetailType | undefined;

  const isAuthor = user?.id === plan?.authorId;
  const isEditor =
    user?.role === USER_ROLES.EDITOR || user?.role === USER_ROLES.ADMIN;

  // Fetch comments
  const { data: commentsData } = trpc.comment.list.useQuery(
    { travelPlanId: plan?.id },
    { enabled: !!plan?.id },
  );

  // Fetch interaction lists
  const { data: likedIds } = trpc.explore.getLikedIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: savedIds } = trpc.explore.getSavedIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: followStatus } = trpc.user.isFollowing.useQuery(
    { targetUserId: plan?.authorId ?? "" },
    { enabled: !!plan?.authorId && isAuthenticated },
  );

  const isLiked = likedIds?.some((l) => l.travelPlanId === plan?.id) ?? false;
  const isSaved = savedIds?.some((s) => s.travelPlanId === plan?.id) ?? false;
  const isFollowing = followStatus?.isFollowing ?? false;

  // Mutations
  const toggleLikeMutation = trpc.travelPlan.toggleLike.useMutation();
  const toggleSaveMutation = trpc.travelPlan.toggleSave.useMutation();
  const followMutation = trpc.user.follow.useMutation();
  const unfollowMutation = trpc.user.unfollow.useMutation();

  const createCommentMutation = trpc.comment.create.useMutation();
  const deleteCommentMutation = trpc.comment.delete.useMutation();

  const deletePlanMutation = trpc.travelPlan.delete.useMutation();
  const changeVisibilityMutation =
    trpc.travelPlan.changeVisibility.useMutation();
  const setVerificationStatusMutation =
    trpc.travelPlan.setVerificationStatus.useMutation();
  const createChatMutation = trpc.chat.create.useMutation();

  if (isLoading) {
    return (
      <div className="p-8 text-center text-body-lg skeleton-shimmer">
        Loading travel plan...
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <h1 className="text-headline-lg text-error">404 — Plan Not Found</h1>
        <p className="text-body-md text-on-surface-muted">
          This travel plan does not exist or has been deleted.
        </p>
        <Link
          to={ROUTES.EXPLORE}
          className="text-primary font-semibold hover:underline"
        >
          Back to Explore
        </Link>
      </div>
    );
  }

  const handleLikeToggle = async () => {
    if (!isAuthenticated)
      return toast("You must log in to like travel plans.", "warning");
    await toggleLikeMutation.mutateAsync({ travelPlanId: plan.id });
    utils.explore.getLikedIds.invalidate();
    utils.travelPlan.getBySlug.invalidate({ slug: slug! });
  };

  const handleSaveToggle = async () => {
    if (!isAuthenticated)
      return toast("You must log in to save travel plans.", "warning");
    await toggleSaveMutation.mutateAsync({ travelPlanId: plan.id });
    utils.explore.getSavedIds.invalidate();
    utils.travelPlan.getBySlug.invalidate({ slug: slug! });
  };

  const handleFollowToggle = async () => {
    if (!isAuthenticated)
      return toast("You must log in to follow travellers.", "warning");
    if (isFollowing) {
      await unfollowMutation.mutateAsync({ targetUserId: plan.authorId });
    } else {
      await followMutation.mutateAsync({ targetUserId: plan.authorId });
    }
    utils.user.isFollowing.invalidate({ targetUserId: plan.authorId });
  };

  const handleAddComment = async (content: string) => {
    await createCommentMutation.mutateAsync({
      travelPlanId: plan.id,
      body: content,
    });
    utils.comment.list.invalidate({ travelPlanId: plan.id });
    toast("Comment posted!", "success");
  };

  const handleReplyComment = async (parentId: string, content: string) => {
    await createCommentMutation.mutateAsync({
      travelPlanId: plan.id,
      parentId,
      body: content,
    });
    utils.comment.list.invalidate({ travelPlanId: plan.id });
    toast("Reply posted!", "success");
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteCommentMutation.mutateAsync({ commentId });
    utils.comment.list.invalidate({ travelPlanId: plan.id });
    toast("Comment deleted", "success");
  };

  const handleDeletePlan = async () => {
    try {
      await deletePlanMutation.mutateAsync({ travelPlanId: plan.id });
      toast("Travel plan deleted successfully.", "success");
      setIsDeleteModalOpen(false);
      navigate(ROUTES.STUDIO);
    } catch (err: any) {
      toast(err.message || "Failed to delete travel plan.", "error");
    }
  };

  const handleChangeVisibility = async (visibility: Visibility) => {
    try {
      await changeVisibilityMutation.mutateAsync({
        travelPlanId: plan.id,
        visibility,
      });
      toast(`Visibility changed to ${visibility.toLowerCase()}.`, "success");
      utils.travelPlan.getBySlug.invalidate({ slug: slug! });
      utils.explore.list.invalidate();
    } catch (err: any) {
      toast(err.message || "Failed to change visibility.", "error");
    }
  };

  const handleVerifyStatus = async (status: DbVerificationStatus) => {
    try {
      await setVerificationStatusMutation.mutateAsync({
        travelPlanId: plan.id,
        status,
      });
      toast(
        `Verification status changed to ${status.toLowerCase()}.`,
        "success",
      );
      utils.travelPlan.getBySlug.invalidate({ slug: slug! });
      utils.explore.list.invalidate();
    } catch (err: any) {
      toast(err.message || "Failed to change verification status.", "error");
    }
  };

  const handleStartChat = async () => {
    try {
      const chat = await createChatMutation.mutateAsync({
        contentType: "TRAVEL_PLAN",
        travelPlanId: plan.id,
      });
      toast("Chat conversation started with the author.", "success");
      navigate(`${ROUTES.CHATS}?chatId=${chat.id}`);
    } catch (err: any) {
      toast(err.message || "Failed to start chat.", "error");
    }
  };

  const headerActions: {
    label: string;
    onClick: () => void;
    variant?: "default" | "danger";
  }[] = [];
  if (isAuthor && plan) {
    headerActions.push(
      {
        label: "Edit",
        onClick: () => navigate(`${ROUTES.PLAN.NEW}?edit=${plan.slug}`),
      },
      {
        label: "Make Public 🌍",
        onClick: () => handleChangeVisibility(VISIBILITIES.PUBLIC),
      },
      {
        label: "Make Unlisted 🔗",
        onClick: () => handleChangeVisibility(VISIBILITIES.UNLISTED),
      },
      {
        label: "Make Private 🔒",
        onClick: () => handleChangeVisibility(VISIBILITIES.PRIVATE),
      },
      {
        label: "Delete Travel Plan",
        onClick: () => setIsDeleteModalOpen(true),
        variant: "danger",
      },
    );
  } else if (isEditor && plan) {
    headerActions.push(
      {
        label: "Edit (as Editor)",
        onClick: () => navigate(`${ROUTES.PLAN.NEW}?edit=${plan.slug}`),
      },
      {
        label: "Make Public 🌍",
        onClick: () => handleChangeVisibility(VISIBILITIES.PUBLIC),
      },
      {
        label: "Make Unlisted 🔗",
        onClick: () => handleChangeVisibility(VISIBILITIES.UNLISTED),
      },
      {
        label: "Make Private 🔒",
        onClick: () => handleChangeVisibility(VISIBILITIES.PRIVATE),
      },
    );
    if (plan.verificationStatus !== DB_VERIFICATION_STATUSES.VERIFIED) {
      headerActions.push({
        label: "Verify Content",
        onClick: () => handleVerifyStatus(DB_VERIFICATION_STATUSES.VERIFIED),
      });
    } else {
      headerActions.push({
        label: "Unverify Content",
        onClick: () => handleVerifyStatus(DB_VERIFICATION_STATUSES.UNVERIFIED),
      });
    }
    headerActions.push({
      label: "Start Chat with Author",
      onClick: handleStartChat,
    });
  }

  const commentsList = (commentsData?.comments ?? []).map(
    (c: any) => mapComment(c, user?.id) as unknown as Comment,
  );

  // Mapped pins across the whole plan's blocks
  const mapPins =
    plan.blocks?.flatMap(
      (block: any) =>
        block.locations?.map((l: any) => ({
          id: l.location.id,
          lat: l.location.latitude,
          lng: l.location.longitude,
          label: `${block.dayNumber ? `Day ${block.dayNumber}: ` : ""}${l.location.name}`,
          color: block.type === BLOCK_TYPES.DAY ? "#E07A5F" : "#D97706",
        })) ?? [],
    ) ?? [];

  const leftContent = (
    <section className="p-6 space-y-8">
      <ContentDetailsHeader
        title={plan.title}
        thumbnailUrl={plan.featuredImageUrl ?? undefined}
        verificationStatus={
          plan.verificationStatus.toLowerCase() as UiVerificationStatus
        }
        locationTags={plan.locations?.map((l) => l.location.name) ?? []}
        categoryTags={plan.tags?.map((t) => t.tag.name) ?? []}
        author={{
          name: plan.author.name,
          avatarUrl: plan.author.avatarUrl,
          username: plan.author.name,
        }}
        publishedAt={
          plan.publishedAt
            ? new Date(plan.publishedAt).toLocaleDateString()
            : undefined
        }
        updatedAt={new Date(plan.updatedAt).toLocaleDateString()}
        description={plan.description}
        likeCount={plan.likeCount}
        saveCount={plan.saveCount}
        isLiked={isLiked}
        isSaved={isSaved}
        isFollowing={isFollowing}
        onLikeToggle={handleLikeToggle}
        onSaveToggle={handleSaveToggle}
        onFollowToggle={handleFollowToggle}
        actions={headerActions}
      />

      <div className="flex gap-2">
        <Badge label={`Season: ${plan.season}`} variant="warning" />
      </div>

      {/* Blocks Rendering */}
      <section className="space-y-6">
        {plan.blocks?.map((block: any) => (
          <section
            key={block.id}
            className="rounded-2xl bg-surface border border-border-custom p-6 space-y-4"
          >
            <h2 className="text-headline-md text-on-surface">
              {block.type === BLOCK_TYPES.DAY ? `Day ${block.dayNumber}: ` : ""}{" "}
              {block.title}
            </h2>
            <div
              className="prose max-w-none text-on-surface [&_p]:text-body-md [&_p]:text-on-surface/90"
              dangerouslySetInnerHTML={{
                __html: renderEditorJs(block.content),
              }}
            />
            {block.locations?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {block.locations.map((l: any) => (
                  <Tag
                    key={l.location.id}
                    label={l.location.name}
                    variant="location"
                    size="sm"
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </section>

      <SupportSection
        authorName={plan.author.name}
        donationUrl={(plan.author.donationLinks as any)?.[0]?.url}
      />

      <CommentSection
        comments={commentsList}
        isAuthenticated={isAuthenticated}
        onAddComment={handleAddComment}
        onReply={handleReplyComment}
        onDelete={handleDeleteComment}
      />
    </section>
  );

  const rightContent = (
    <section className="h-full p-4">
      <Suspense
        fallback={<section className="w-full h-full skeleton rounded-2xl" />}
      >
        {mapPins.length > 0 ? (
          <MapView
            pins={mapPins}
            paths={[
              {
                positions: mapPins.map(
                  (p: any) => [p.lat, p.lng] as [number, number],
                ),
                color: "#3B7197",
              },
            ]}
            className="h-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-muted italic">
            No locations linked to this travel plan.
          </div>
        )}
      </Suspense>
    </section>
  );

  return (
    <article className="h-[calc(100vh-64px)]">
      <SplitPane
        left={leftContent}
        right={rightContent}
        initialLeftPercent={60}
        minLeftPercent={40}
        maxLeftPercent={100}
        className="h-full"
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Travel Plan"
        confirmLabel="Delete Plan"
        variant="danger"
        onConfirm={handleDeletePlan}
        isLoading={deletePlanMutation.isPending}
      >
        <p className="text-body-md text-on-surface">
          Are you sure you want to permanently delete the travel plan{" "}
          <strong>{plan.title}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </article>
  );
}
