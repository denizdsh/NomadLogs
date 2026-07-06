import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Plus,
  BookOpen,
  PenTool,
  Map,
  MessageSquare,
  Check,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/Button";
import { ContentCard } from "~/components/ui/ContentCard";
import { ContentStatsBar } from "~/components/content/ContentSections";
import { DropdownMenu } from "~/components/ui/DropdownMenu";
import { SearchBar } from "~/components/ui/SearchBar";
import { Tag } from "~/components/ui/Tag";
import { Badge } from "~/components/ui/Badge";
import { trpc, type RouterOutputs } from "~/utils/trpc";
import { useAuth } from "~/providers/AuthProvider";
import { useToast } from "~/providers/ToastProvider";
import { Modal } from "~/components/ui/Modal";
import { mapBackendToCard } from "~/utils/mappers";
import type { ContentType, ContentTypeRaw, UserRole } from "~/types/content";
import {
  CONTENT_TYPES,
  USER_ROLES,
  DB_VERIFICATION_STATUSES,
} from "~/constants/content";
import { ROUTES } from "~/constants/routes";

export function meta() {
  return [
    { title: "Editor Studio — NomadLogs" },
    {
      name: "description",
      content: "Manage your content, create new posts, and track analytics.",
    },
  ];
}

const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "popular", label: "Most Popular" },
];

export default function Studio() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const isAuthenticated = !!currentUser;

  const isEditor =
    currentUser?.role === USER_ROLES.EDITOR ||
    currentUser?.role === USER_ROLES.ADMIN;

  const [activeTypes, setActiveTypes] = useState<string[]>([
    "BLOG",
    "JOURNAL",
    "TRAVEL_PLAN",
  ]);
  const [activeSort, setActiveSort] = useState<"newest" | "oldest" | "popular">(
    "newest",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: ContentType;
    title: string;
  } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteBlogsOpt, setDeleteBlogsOpt] = useState(false);

  // Query own contents list
  const { data: ownContentsData, isLoading: isOwnLoading } =
    trpc.explore.list.useQuery(
      {
        authorId: currentUser?.id,
        contentTypes: activeTypes as ("BLOG" | "JOURNAL" | "TRAVEL_PLAN")[],
        sort: activeSort,
        search: searchQuery || undefined,
        limit: 50,
      },
      { enabled: isAuthenticated },
    );

  // Query all pending contents (Editor Only)
  const { data: pendingData, isLoading: isPendingLoading } =
    trpc.explore.list.useQuery(
      {
        verificationStatus: DB_VERIFICATION_STATUSES.PENDING,
        contentTypes: ["BLOG", "JOURNAL", "TRAVEL_PLAN"],
        limit: 50,
      },
      { enabled: isEditor },
    );

  // User search (Editor Only)
  const { data: userSearchResults } = trpc.user.search.useQuery(
    { query: userSearchQuery },
    { enabled: isEditor && userSearchQuery.trim().length > 1 },
  );

  // Mutations
  const setBlogVerification = trpc.blog.setVerificationStatus.useMutation();
  const setJournalVerification =
    trpc.journal.setVerificationStatus.useMutation();
  const setPlanVerification =
    trpc.travelPlan.setVerificationStatus.useMutation();
  const changeUserRole = trpc.user.changeRole.useMutation();

  const deleteBlogMutation = trpc.blog.delete.useMutation();
  const deleteJournalMutation = trpc.journal.delete.useMutation();
  const deletePlanMutation = trpc.travelPlan.delete.useMutation();

  const handleVerify = async (
    id: string,
    type: "BLOG" | "JOURNAL" | "TRAVEL_PLAN",
    approve: boolean,
  ) => {
    const status = approve
      ? DB_VERIFICATION_STATUSES.VERIFIED
      : DB_VERIFICATION_STATUSES.UNVERIFIED;
    try {
      if (type === "BLOG") {
        await setBlogVerification.mutateAsync({ blogId: id, status });
      } else if (type === "JOURNAL") {
        await setJournalVerification.mutateAsync({ journalId: id, status });
      } else if (type === "TRAVEL_PLAN") {
        await setPlanVerification.mutateAsync({ travelPlanId: id, status });
      }
      toast(`Content marked as ${status.toLowerCase()}!`, "success");
      utils.explore.list.invalidate();
    } catch (err) {
      toast("Action failed.", "error");
    }
  };

  const handleChangeRole = async (userId: string, role: UserRole) => {
    try {
      await changeUserRole.mutateAsync({ targetUserId: userId, newRole: role });
      toast("User role updated successfully!", "success");
      utils.user.search.invalidate();
    } catch (err: any) {
      toast(err.message || "Failed to update role.", "error");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === CONTENT_TYPES.BLOG) {
        await deleteBlogMutation.mutateAsync({ blogId: deleteTarget.id });
      } else if (deleteTarget.type === CONTENT_TYPES.JOURNAL) {
        await deleteJournalMutation.mutateAsync({
          journalId: deleteTarget.id,
          deleteBlogs: deleteBlogsOpt,
        });
      } else if (deleteTarget.type === CONTENT_TYPES.TRAVEL_PLAN) {
        await deletePlanMutation.mutateAsync({ travelPlanId: deleteTarget.id });
      }
      toast("Content deleted successfully.", "success");
      utils.explore.list.invalidate();
    } catch (err: any) {
      toast(err.message || "Deletion failed.", "error");
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      setDeleteBlogsOpt(false);
    }
  };

  const toggleType = (val: string) => {
    setActiveTypes((prev) =>
      prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val],
    );
  };

  const ownCardsList =
    ownContentsData?.flatMap((res) =>
      res.items.map((item) =>
        mapBackendToCard(item, res.contentType.toLowerCase() as ContentType),
      ),
    ) ?? [];

  const pendingCardsList =
    pendingData?.flatMap((res) =>
      res.items.map((item) => ({
        ...mapBackendToCard(item, res.contentType.toLowerCase() as ContentType),
        rawType: res.contentType as ContentTypeRaw,
      })),
    ) ?? [];

  return (
    <article className="mx-auto max-w-7xl px-6 py-8 animate-fade-in space-y-10">
      {/* Studio Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-headline-lg text-on-surface">Editor Studio</h1>
        <nav
          className="flex items-center gap-3 flex-wrap"
          aria-label="Create content"
        >
          <Link to={ROUTES.JOURNAL.NEW}>
            <Button variant="secondary" size="sm">
              <BookOpen size={14} /> New Journal
            </Button>
          </Link>
          <Link to={ROUTES.BLOG.NEW}>
            <Button variant="secondary" size="sm">
              <PenTool size={14} /> New Blog
            </Button>
          </Link>
          <Link to={ROUTES.PLAN.NEW}>
            <Button variant="tertiary" size="sm">
              <Map size={14} /> Plan Trip
            </Button>
          </Link>
          <Link to={ROUTES.CHATS}>
            <Button variant="ghost" size="sm">
              <MessageSquare size={14} /> Pending Chats
            </Button>
          </Link>
        </nav>
      </header>

      {/* Editor/Admin Gated Tools */}
      {isEditor && (
        <section className="rounded-2xl bg-surface border border-border-custom p-6 space-y-6">
          <h2 className="text-headline-md text-on-surface">Editor Tools</h2>

          {/* User management role toggle */}
          <fieldset className="space-y-3">
            <legend className="text-label-lg text-on-surface-muted uppercase tracking-wide">
              Manage User Roles
            </legend>
            <SearchBar
              placeholder="Search user profiles by name/email..."
              value={userSearchQuery}
              onChange={setUserSearchQuery}
              onSubmit={() => {}}
              size="sm"
            />
            {userSearchResults && userSearchResults.length > 0 && (
              <ul className="rounded-xl border border-border-custom overflow-hidden divide-y divide-border-custom bg-neutral/10">
                {userSearchResults.map((usr) => (
                  <li key={usr.id}>
                    <Link
                      to={ROUTES.USER.DETAIL(usr.name)}
                      className="flex items-center justify-between p-3"
                    >
                      <section className="flex items-center gap-2">
                        <span className="text-label-lg font-semibold text-on-surface">
                          {usr.name}
                        </span>
                        <span className="text-body-sm text-on-surface-muted">
                          ({usr.email})
                        </span>
                        <Badge label={usr.role} variant="info" />
                      </section>
                      <menu className="flex gap-2">
                        {usr.role !== USER_ROLES.VERIFIED && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              handleChangeRole(usr.id, USER_ROLES.VERIFIED)
                            }
                          >
                            Promote to Verified
                          </Button>
                        )}
                        {usr.role !== USER_ROLES.EDITOR &&
                          currentUser?.role === USER_ROLES.ADMIN && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                handleChangeRole(usr.id, USER_ROLES.EDITOR)
                              }
                            >
                              Promote to Editor
                            </Button>
                          )}
                      </menu>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          {/* Verification Queue */}
          <section className="space-y-4">
            <h3 className="text-label-lg text-on-surface-muted uppercase tracking-wide">
              Pending Content Verification Queue
            </h3>
            {pendingCardsList.length > 0 ? (
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingCardsList.map((item) => (
                  <li
                    key={`${item.contentType}-${item.id}`}
                    className="relative group"
                  >
                    <ContentCard data={item} />
                    <menu className="absolute top-3 right-3 flex gap-2 z-10 bg-black/60 p-1.5 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() =>
                          handleVerify(item.id, item.rawType, true)
                        }
                        className="p-1.5 rounded-lg bg-success text-white hover:opacity-85 transition-opacity"
                        aria-label="Approve"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleVerify(item.id, item.rawType, false)
                        }
                        className="p-1.5 rounded-lg bg-error text-white hover:opacity-85 transition-opacity"
                        aria-label="Reject"
                      >
                        <X size={16} />
                      </button>
                    </menu>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-on-surface-muted italic text-sm">
                No items currently pending verification.
              </div>
            )}
          </section>
        </section>
      )}

      {/* Own Content Management */}
      <section className="space-y-6">
        <h2 className="text-headline-md text-on-surface">
          Your Content & Drafts
        </h2>

        {/* Filters */}
        <nav
          className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
          aria-label="Filters"
        >
          <ul className="flex items-center gap-2">
            {Object.entries(CONTENT_TYPES).map((type) => (
              <li key={type[0]}>
                <Tag
                  label={type[1]}
                  variant="content-type"
                  isActive={activeTypes.includes(type[1])}
                  onToggle={() => toggleType(type[1])}
                />
              </li>
            ))}
          </ul>
          <ul className="flex items-center gap-2">
            {SORT_OPTIONS.map((opt) => (
              <li key={opt.key}>
                <Tag
                  label={opt.label}
                  isActive={activeSort === opt.key}
                  onToggle={() =>
                    setActiveSort(opt.key as "newest" | "oldest" | "popular")
                  }
                  size="sm"
                />
              </li>
            ))}
          </ul>
        </nav>

        {isOwnLoading ? (
          <div className="p-8 text-center skeleton-shimmer">
            Loading your content...
          </div>
        ) : ownCardsList.length > 0 ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ownCardsList.map((item) => (
              <li key={`${item.contentType}-${item.id}`}>
                <ContentCard
                  data={item}
                  showStats
                  statsSection={
                    <ContentStatsBar
                      views={item.likeCount || 0}
                      fullReads={item.saveCount || 0}
                      likes={item.likeCount || 0}
                      saves={item.saveCount || 0}
                      comments={0}
                    />
                  }
                  menuSection={
                    <DropdownMenu
                      items={[
                        {
                          label: "Edit",
                          onClick: () => {
                            const routePrefix =
                              item.contentType === CONTENT_TYPES.TRAVEL_PLAN
                                ? "plan"
                                : item.contentType;
                            navigate(`/${routePrefix}/new?edit=${item.slug}`);
                          },
                        },
                        {
                          label: "Delete",
                          onClick: () => {
                            setDeleteTarget({
                              id: item.id,
                              type: item.contentType as ContentType,
                              title: item.title,
                            });
                            setDeleteBlogsOpt(false);
                            setIsDeleteModalOpen(true);
                          },
                          variant: "danger",
                        },
                      ]}
                    />
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center p-12 text-on-surface-muted italic">
            You haven't created any content yet.
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.type === CONTENT_TYPES.TRAVEL_PLAN ? "Travel Plan" : deleteTarget?.type === CONTENT_TYPES.BLOG ? "Blog" : "Journal"}`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        isLoading={
          deleteBlogMutation.isPending ||
          deleteJournalMutation.isPending ||
          deletePlanMutation.isPending
        }
      >
        <div className="space-y-4">
          <p className="text-body-md text-on-surface">
            Are you sure you want to permanently delete the{" "}
            {deleteTarget?.type === CONTENT_TYPES.TRAVEL_PLAN
              ? "travel plan"
              : deleteTarget?.type}{" "}
            <strong>{deleteTarget?.title}</strong>? This action cannot be
            undone.
          </p>
          {deleteTarget?.type === "journal" && (
            <label className="flex items-center gap-3 text-body-md text-on-surface cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deleteBlogsOpt}
                onChange={(e) => setDeleteBlogsOpt(e.target.checked)}
                className="rounded border-border-custom text-primary focus:ring-primary/30"
              />
              Also delete all blog posts in this journal
            </label>
          )}
        </div>
      </Modal>
    </article>
  );
}
