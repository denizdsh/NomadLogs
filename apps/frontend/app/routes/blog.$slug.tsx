import { useState, Suspense, lazy, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { SplitPane } from "~/components/layout/SplitPane";
import { Tag } from "~/components/ui/Tag";
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
} from "~/constants/content";
import { ROUTES } from "~/constants/routes";

type BlogDetailType = NonNullable<RouterOutputs["blog"]["getBySlug"]>;

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

const MapView = lazy(() =>
  import("~/components/map/MapView").then((m) => ({ default: m.MapView })),
);

export function meta() {
  return [
    { title: "Blog — NomadLogs" },
    { name: "description", content: "Read this travel blog on NomadLogs." },
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

export default function BlogDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const isAuthenticated = !!user;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMoveJournalModalOpen, setIsMoveJournalModalOpen] = useState(false);
  const [targetJournalId, setTargetJournalId] = useState("");

  const hasRecordedView = useRef(false);
  const hasRecordedFullRead = useRef(false);

  // Fetch blog data
  const {
    data: blogData,
    isLoading,
    error,
  } = trpc.blog.getBySlug.useQuery({ slug: slug! });
  const blog = blogData as BlogDetailType | undefined;

  const isAuthor = user?.id === blog?.authorId;
  const isEditor =
    user?.role === USER_ROLES.EDITOR || user?.role === USER_ROLES.ADMIN;

  // Fetch comments
  const { data: commentsData } = trpc.comment.list.useQuery(
    { blogId: blog?.id },
    { enabled: !!blog?.id },
  );

  // Fetch interactions lists
  const { data: likedIds } = trpc.explore.getLikedIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: savedIds } = trpc.explore.getSavedIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: followStatus } = trpc.user.isFollowing.useQuery(
    { targetUserId: blog?.authorId ?? "" },
    { enabled: !!blog?.authorId && isAuthenticated },
  );

  const { data: myJournals } = trpc.journal.getMyJournals.useQuery(undefined, {
    enabled: isAuthenticated && isAuthor,
  });

  const isLiked = likedIds?.some((l) => l.blogId === blog?.id) ?? false;
  const isSaved = savedIds?.some((s) => s.blogId === blog?.id) ?? false;
  const isFollowing = followStatus?.isFollowing ?? false;

  // Mutations
  const toggleLikeMutation = trpc.blog.toggleLike.useMutation();
  const toggleSaveMutation = trpc.blog.toggleSave.useMutation();
  const followMutation = trpc.user.follow.useMutation();
  const unfollowMutation = trpc.user.unfollow.useMutation();
  const recordViewMutation = trpc.blog.recordView.useMutation();
  const recordFullReadMutation = trpc.blog.recordFullRead.useMutation();

  const createCommentMutation = trpc.comment.create.useMutation();
  const deleteCommentMutation = trpc.comment.delete.useMutation();

  const deleteBlogMutation = trpc.blog.delete.useMutation();
  const changeVisibilityMutation = trpc.blog.changeVisibility.useMutation();
  const setVerificationStatusMutation =
    trpc.blog.setVerificationStatus.useMutation();
  const createChatMutation = trpc.chat.create.useMutation();
  const moveToJournalMutation = trpc.blog.moveToJournal.useMutation();

  // Record view on mount
  useEffect(() => {
    if (blog?.id && !hasRecordedView.current) {
      hasRecordedView.current = true;
      recordViewMutation.mutate({ blogId: blog.id });
    }
  }, [blog?.id]);

  // Record full read on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (hasRecordedFullRead.current || !blog?.id) return;
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0 && window.scrollY >= totalHeight - 80) {
        hasRecordedFullRead.current = true;
        recordFullReadMutation.mutate({ blogId: blog.id });
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [blog?.id]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-body-lg skeleton-shimmer">
        Loading blog...
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <h1 className="text-headline-lg text-error">404 — Blog Not Found</h1>
        <p className="text-body-md text-on-surface-muted">
          This blog post does not exist or has been deleted.
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
      return toast("You must log in to like posts.", "warning");
    await toggleLikeMutation.mutateAsync({ blogId: blog.id });
    utils.explore.getLikedIds.invalidate();
    utils.blog.getBySlug.invalidate({ slug: slug! });
  };

  const handleSaveToggle = async () => {
    if (!isAuthenticated)
      return toast("You must log in to save posts.", "warning");
    await toggleSaveMutation.mutateAsync({ blogId: blog.id });
    utils.explore.getSavedIds.invalidate();
    utils.blog.getBySlug.invalidate({ slug: slug! });
  };

  const handleFollowToggle = async () => {
    if (!isAuthenticated)
      return toast("You must log in to follow travellers.", "warning");
    if (isFollowing) {
      await unfollowMutation.mutateAsync({ targetUserId: blog.authorId });
    } else {
      await followMutation.mutateAsync({ targetUserId: blog.authorId });
    }
    utils.user.isFollowing.invalidate({ targetUserId: blog.authorId });
  };

  const handleAddComment = async (content: string) => {
    await createCommentMutation.mutateAsync({
      blogId: blog.id,
      body: content,
    });
    utils.comment.list.invalidate({ blogId: blog.id });
    toast("Comment posted!", "success");
  };

  const handleReplyComment = async (parentId: string, content: string) => {
    await createCommentMutation.mutateAsync({
      blogId: blog.id,
      parentId,
      body: content,
    });
    utils.comment.list.invalidate({ blogId: blog.id });
    toast("Reply posted!", "success");
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteCommentMutation.mutateAsync({ commentId });
    utils.comment.list.invalidate({ blogId: blog.id });
    toast("Comment deleted", "success");
  };

  const handleDeleteBlog = async () => {
    try {
      await deleteBlogMutation.mutateAsync({ blogId: blog.id });
      toast("Blog deleted successfully.", "success");
      setIsDeleteModalOpen(false);
      navigate(ROUTES.STUDIO);
    } catch (err: any) {
      toast(err.message || "Failed to delete blog.", "error");
    }
  };

  const handleChangeVisibility = async (visibility: Visibility) => {
    try {
      await changeVisibilityMutation.mutateAsync({
        blogId: blog.id,
        visibility,
      });
      toast(`Visibility changed to ${visibility.toLowerCase()}.`, "success");
      utils.blog.getBySlug.invalidate({ slug: slug! });
      utils.explore.list.invalidate();
    } catch (err: any) {
      toast(err.message || "Failed to change visibility.", "error");
    }
  };

  const handleVerifyStatus = async (status: DbVerificationStatus) => {
    try {
      await setVerificationStatusMutation.mutateAsync({
        blogId: blog.id,
        status,
      });
      toast(`Content status changed to ${status.toLowerCase()}.`, "success");
      utils.blog.getBySlug.invalidate({ slug: slug! });
      utils.explore.list.invalidate();
    } catch (err: any) {
      toast(err.message || "Failed to change verification status.", "error");
    }
  };

  const handleStartChat = async () => {
    try {
      const chat = await createChatMutation.mutateAsync({
        contentType: "BLOG",
        blogId: blog.id,
      });
      toast("Chat conversation started with the author.", "success");
      navigate(`${ROUTES.CHATS}?chatId=${chat.id}`);
    } catch (err: any) {
      toast(err.message || "Failed to start chat.", "error");
    }
  };

  const handleMoveToJournal = async () => {
    try {
      await moveToJournalMutation.mutateAsync({
        blogId: blog.id,
        targetJournalId: targetJournalId || null,
      });
      toast(
        targetJournalId
          ? "Blog moved to journal."
          : "Blog removed from journal.",
        "success",
      );
      setIsMoveJournalModalOpen(false);
      utils.blog.getBySlug.invalidate({ slug: slug! });
      utils.explore.list.invalidate();
    } catch (err: any) {
      toast(err.message || "Failed to move blog.", "error");
    }
  };

  const handleRemoveFromJournal = async () => {
    try {
      await moveToJournalMutation.mutateAsync({
        blogId: blog.id,
        targetJournalId: null,
      });
      toast("Blog removed from journal.", "success");
      utils.blog.getBySlug.invalidate({ slug: slug! });
      utils.explore.list.invalidate();
    } catch (err: any) {
      toast(err.message || "Failed to remove blog from journal.", "error");
    }
  };

  const headerActions: {
    label: string;
    onClick: () => void;
    variant?: "default" | "danger";
  }[] = [];
  if (isAuthor && blog) {
    headerActions.push(
      {
        label: "Edit",
        onClick: () => navigate(`${ROUTES.BLOG.NEW}?edit=${blog.slug}`),
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
    if (blog.journalId) {
      headerActions.push({
        label: "Remove from Journal",
        onClick: handleRemoveFromJournal,
      });
    } else {
      headerActions.push({
        label: "Move to Journal",
        onClick: () => {
          setTargetJournalId("");
          setIsMoveJournalModalOpen(true);
        },
      });
    }
    headerActions.push({
      label: "Delete Blog",
      onClick: () => setIsDeleteModalOpen(true),
      variant: "danger",
    });
  } else if (isEditor && blog) {
    headerActions.push(
      {
        label: "Edit (as Editor)",
        onClick: () => navigate(`${ROUTES.BLOG.NEW}?edit=${blog.slug}`),
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
    if (blog.verificationStatus !== DB_VERIFICATION_STATUSES.VERIFIED) {
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

  const mapPins =
    blog.locations?.map((loc: any) => ({
      id: loc.location.id,
      lat: loc.location.latitude,
      lng: loc.location.longitude,
      label: loc.location.name,
      color: "#E07A5F",
    })) ?? [];

  const leftContent = (
    <section className="p-6 space-y-8">
      <ContentDetailsHeader
        title={blog.title}
        thumbnailUrl={blog.featuredImageUrl ?? undefined}
        verificationStatus={
          blog.verificationStatus.toLowerCase() as UiVerificationStatus
        }
        locationTags={blog.locations?.map((l: any) => l.location.name) ?? []}
        categoryTags={blog.tags?.map((t: any) => t.tag.name) ?? []}
        author={{
          name: blog.author.name,
          avatarUrl: blog.author.avatarUrl,
          username: blog.author.name,
        }}
        publishedAt={
          blog.publishedAt
            ? new Date(blog.publishedAt).toLocaleDateString()
            : undefined
        }
        updatedAt={new Date(blog.updatedAt).toLocaleDateString()}
        description={blog.description}
        likeCount={blog.likeCount}
        saveCount={blog.saveCount}
        isLiked={isLiked}
        isSaved={isSaved}
        isFollowing={isFollowing}
        onLikeToggle={handleLikeToggle}
        onSaveToggle={handleSaveToggle}
        onFollowToggle={handleFollowToggle}
        journalName={blog.journal?.title ?? undefined}
        journalSlug={blog.journal?.slug ?? undefined}
        sequenceNumber={blog.orderInJournal ?? undefined}
        actions={headerActions}
      />

      <section
        className="prose prose-lg max-w-none text-on-surface [&_h2]:font-serif [&_h2]:text-headline-md [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:text-body-lg [&_p]:text-on-surface/90 [&_p]:mb-4"
        dangerouslySetInnerHTML={{
          __html: renderEditorJs(blog.content as any),
        }}
      />

      <SupportSection
        authorName={blog.author.name}
        donationUrl={(blog.author.donationLinks as any)?.[0]?.url}
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
                color: "#E07A5F",
              },
            ]}
            className="h-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-muted italic">
            No locations linked to this blog.
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
        title="Delete Blog Post"
        confirmLabel="Delete Post"
        variant="danger"
        onConfirm={handleDeleteBlog}
        isLoading={deleteBlogMutation.isPending}
      >
        <p className="text-body-md text-on-surface">
          Are you sure you want to permanently delete{" "}
          <strong>{blog.title}</strong>? This action cannot be undone.
        </p>
      </Modal>

      {/* Move to Journal Modal */}
      <Modal
        isOpen={isMoveJournalModalOpen}
        onClose={() => setIsMoveJournalModalOpen(false)}
        title="Move to Journal"
        confirmLabel="Move"
        onConfirm={handleMoveToJournal}
        isLoading={moveToJournalMutation.isPending}
      >
        <div className="space-y-4">
          <p className="text-body-md text-on-surface">
            Select a journal to move this blog into:
          </p>
          <select
            value={targetJournalId}
            onChange={(e) => setTargetJournalId(e.target.value)}
            className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-md focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          >
            <option value="">Standalone (remove from journal)</option>
            {myJournals?.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </article>
  );
}
