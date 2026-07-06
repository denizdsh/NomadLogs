import { useState, Suspense, lazy } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { SplitPane } from "~/components/layout/SplitPane";
import { Tag } from "~/components/ui/Tag";
import { SupportSection } from "~/components/content/ContentSections";
import {
  CommentSection,
  type Comment,
} from "~/components/content/CommentSection";
import { ContentCard } from "~/components/ui/ContentCard";
import { ContentDetailsHeader } from "~/components/content/ContentDetailsHeader";
import { trpc, type RouterOutputs } from "~/utils/trpc";
import { useAuth } from "~/providers/AuthProvider";
import { useToast } from "~/providers/ToastProvider";
import { Modal } from "~/components/ui/Modal";
import { mapBackendToCard, mapComment } from "~/utils/mappers";
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
  CONTENT_TYPES,
} from "~/constants/content";
import { ROUTES } from "~/constants/routes";

type JournalDetailType = NonNullable<RouterOutputs["journal"]["getBySlug"]>;

const MapView = lazy(() =>
  import("~/components/map/MapView").then((m) => ({ default: m.MapView })),
);

export function meta() {
  return [
    { title: "Journal — NomadLogs" },
    { name: "description", content: "Read this travel journal on NomadLogs." },
  ];
}

export default function JournalDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const isAuthenticated = !!user;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteBlogsOpt, setDeleteBlogsOpt] = useState(false);

  // Fetch journal data
  const {
    data: journalData,
    isLoading,
    error,
  } = trpc.journal.getBySlug.useQuery({ slug: slug! });
  const journal = journalData as JournalDetailType | undefined;

  const isAuthor = user?.id === journal?.authorId;
  const isEditor =
    user?.role === USER_ROLES.EDITOR || user?.role === USER_ROLES.ADMIN;

  // Fetch comments
  const { data: commentsData } = trpc.comment.list.useQuery(
    { journalId: journal?.id },
    { enabled: !!journal?.id },
  );

  // Fetch interaction lists
  const { data: likedIds } = trpc.explore.getLikedIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: savedIds } = trpc.explore.getSavedIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: followStatus } = trpc.user.isFollowing.useQuery(
    { targetUserId: journal?.authorId ?? "" },
    { enabled: !!journal?.authorId && isAuthenticated },
  );

  const isLiked = likedIds?.some((l) => l.journalId === journal?.id) ?? false;
  const isSaved = savedIds?.some((s) => s.journalId === journal?.id) ?? false;
  const isFollowing = followStatus?.isFollowing ?? false;

  // Mutations
  const toggleLikeMutation = trpc.journal.toggleLike.useMutation();
  const toggleSaveMutation = trpc.journal.toggleSave.useMutation();
  const followMutation = trpc.user.follow.useMutation();
  const unfollowMutation = trpc.user.unfollow.useMutation();

  const createCommentMutation = trpc.comment.create.useMutation();
  const deleteCommentMutation = trpc.comment.delete.useMutation();

  const deleteJournalMutation = trpc.journal.delete.useMutation();
  const changeVisibilityMutation = trpc.journal.changeVisibility.useMutation();
  const setVerificationStatusMutation =
    trpc.journal.setVerificationStatus.useMutation();
  const createChatMutation = trpc.chat.create.useMutation();

  if (isLoading) {
    return (
      <div className="p-8 text-center text-body-lg skeleton-shimmer">
        Loading journal...
      </div>
    );
  }

  if (error || !journal) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <h1 className="text-headline-lg text-error">404 — Journal Not Found</h1>
        <p className="text-body-md text-on-surface-muted">
          This journal does not exist or has been deleted.
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
      return toast("You must log in to like journals.", "warning");
    await toggleLikeMutation.mutateAsync({ journalId: journal.id });
    utils.explore.getLikedIds.invalidate();
    utils.journal.getBySlug.invalidate({ slug: slug! });
  };

  const handleSaveToggle = async () => {
    if (!isAuthenticated)
      return toast("You must log in to save journals.", "warning");
    await toggleSaveMutation.mutateAsync({ journalId: journal.id });
    utils.explore.getSavedIds.invalidate();
    utils.journal.getBySlug.invalidate({ slug: slug! });
  };

  const handleFollowToggle = async () => {
    if (!isAuthenticated)
      return toast("You must log in to follow travellers.", "warning");
    if (isFollowing) {
      await unfollowMutation.mutateAsync({ targetUserId: journal.authorId });
    } else {
      await followMutation.mutateAsync({ targetUserId: journal.authorId });
    }
    utils.user.isFollowing.invalidate({ targetUserId: journal.authorId });
  };

  const handleAddComment = async (content: string) => {
    await createCommentMutation.mutateAsync({
      journalId: journal.id,
      body: content,
    });
    utils.comment.list.invalidate({ journalId: journal.id });
    toast("Comment posted!", "success");
  };

  const handleReplyComment = async (parentId: string, content: string) => {
    await createCommentMutation.mutateAsync({
      journalId: journal.id,
      parentId,
      body: content,
    });
    utils.comment.list.invalidate({ journalId: journal.id });
    toast("Reply posted!", "success");
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteCommentMutation.mutateAsync({ commentId });
    utils.comment.list.invalidate({ journalId: journal.id });
    toast("Comment deleted", "success");
  };

  const handleDeleteJournal = async () => {
    try {
      await deleteJournalMutation.mutateAsync({
        journalId: journal.id,
        deleteBlogs: deleteBlogsOpt,
      });
      toast("Journal deleted successfully.", "success");
      setIsDeleteModalOpen(false);
      navigate(ROUTES.STUDIO);
    } catch (err: any) {
      toast(err.message || "Failed to delete journal.", "error");
    }
  };

  const handleChangeVisibility = async (visibility: Visibility) => {
    try {
      await changeVisibilityMutation.mutateAsync({
        journalId: journal.id,
        visibility,
      });
      toast(`Visibility changed to ${visibility.toLowerCase()}.`, "success");
      utils.journal.getBySlug.invalidate({ slug: slug! });
      utils.explore.list.invalidate();
    } catch (err: any) {
      toast(err.message || "Failed to change visibility.", "error");
    }
  };

  const handleVerifyStatus = async (status: DbVerificationStatus) => {
    try {
      await setVerificationStatusMutation.mutateAsync({
        journalId: journal.id,
        status,
      });
      toast(
        `Verification status changed to ${status.toLowerCase()}.`,
        "success",
      );
      utils.journal.getBySlug.invalidate({ slug: slug! });
      utils.explore.list.invalidate();
    } catch (err: any) {
      toast(err.message || "Failed to change verification status.", "error");
    }
  };

  const handleStartChat = async () => {
    try {
      const chat = await createChatMutation.mutateAsync({
        contentType: "JOURNAL",
        journalId: journal.id,
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
  if (isAuthor && journal) {
    headerActions.push(
      {
        label: "Edit",
        onClick: () => navigate(`${ROUTES.JOURNAL.NEW}?edit=${journal.slug}`),
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
        label: "Delete Journal",
        onClick: () => setIsDeleteModalOpen(true),
        variant: "danger",
      },
    );
  } else if (isEditor && journal) {
    headerActions.push(
      {
        label: "Edit (as Editor)",
        onClick: () => navigate(`${ROUTES.JOURNAL.NEW}?edit=${journal.slug}`),
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
    if (journal.verificationStatus !== DB_VERIFICATION_STATUSES.VERIFIED) {
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

  const journalBlogs = (journal?.blogs ?? []).map((blog: any) => ({
    ...mapBackendToCard(blog, CONTENT_TYPES.BLOG, {
      name: journal!.author.name,
      avatarUrl: journal!.author.avatarUrl,
    }),
    contentTypeLabel: `#${blog.orderInJournal || ""}`,
  }));

  const mapPins =
    journal.locations?.map((loc: any) => ({
      id: loc.location.id,
      lat: loc.location.latitude,
      lng: loc.location.longitude,
      label: loc.location.name,
      color: "#1A4D3E",
    })) ?? [];

  const leftContent = (
    <section className="p-6 space-y-8">
      <ContentDetailsHeader
        title={journal.title}
        thumbnailUrl={journal.featuredImageUrl ?? undefined}
        verificationStatus={
          journal.verificationStatus.toLowerCase() as UiVerificationStatus
        }
        locationTags={journal.locations?.map((l) => l.location.name) ?? []}
        categoryTags={journal.tags?.map((t) => t.tag.name) ?? []}
        author={{
          name: journal.author.name,
          avatarUrl: journal.author.avatarUrl,
          username: journal.author.name,
        }}
        publishedAt={
          journal.publishedAt
            ? new Date(journal.publishedAt).toLocaleDateString()
            : undefined
        }
        updatedAt={new Date(journal.updatedAt).toLocaleDateString()}
        description={journal.description}
        likeCount={journal.likeCount}
        saveCount={journal.saveCount}
        isLiked={isLiked}
        isSaved={isSaved}
        isFollowing={isFollowing}
        onLikeToggle={handleLikeToggle}
        onSaveToggle={handleSaveToggle}
        onFollowToggle={handleFollowToggle}
        actions={headerActions}
      />

      <section>
        <h2 className="text-headline-md text-on-surface mb-4">Blog Entries</h2>
        {journalBlogs.length > 0 ? (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {journalBlogs.map((blog: any) => (
              <li key={blog.id}>
                <ContentCard data={blog} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-on-surface-muted italic">
            No blogs added to this journal yet.
          </div>
        )}
      </section>

      <SupportSection
        authorName={journal.author.name}
        donationUrl={(journal.author.donationLinks as any)?.[0]?.url}
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
                color: "#1A4D3E",
              },
            ]}
            className="h-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-muted italic">
            No locations linked to this journal.
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

      {/* Delete Journal Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Journal"
        confirmLabel="Delete Journal"
        variant="danger"
        onConfirm={handleDeleteJournal}
        isLoading={deleteJournalMutation.isPending}
      >
        <div className="space-y-4">
          <p className="text-body-md text-on-surface">
            Are you sure you want to permanently delete the journal{" "}
            <strong>{journal.title}</strong>? This action cannot be undone.
          </p>
          <label className="flex items-center gap-3 text-body-md text-on-surface cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deleteBlogsOpt}
              onChange={(e) => setDeleteBlogsOpt(e.target.checked)}
              className="rounded border-border-custom text-primary focus:ring-primary/30"
            />
            Also delete all blog posts in this journal
          </label>
        </div>
      </Modal>
    </article>
  );
}
