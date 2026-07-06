import { useState, useRef } from "react";
import { Link } from "react-router";
import {
  Eye,
  BookOpen,
  Heart,
  Bookmark,
  MessageCircle,
  Users,
  PenTool,
  Camera,
  LinkIcon,
  Coffee,
  ArrowRight,
  Plus,
  Trash2,
  Edit2,
  Check,
} from "lucide-react";
import { Avatar } from "~/components/ui/Avatar";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { StatCard } from "~/components/ui/StatCard";
import { ContentCard } from "~/components/ui/ContentCard";
import { mapBackendToCard } from "~/utils/mappers";
import { Modal } from "~/components/ui/Modal";
import { trpc } from "~/utils/trpc";
import { useAuth } from "~/providers/AuthProvider";
import { useToast } from "~/providers/ToastProvider";
import { uploadImage } from "~/utils/upload";
import type { ContentType, OAuthProvider } from "~/types/content";
import { USER_ROLES, DB_VERIFICATION_STATUSES } from "~/constants/content";
import { ROUTES } from "~/constants/routes";

export function meta() {
  return [
    { title: "Dashboard — NomadLogs" },
    {
      name: "description",
      content: "View your NomadLogs profile and analytics.",
    },
  ];
}

export default function DashboardIndex() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const isAuthenticated = !!currentUser;

  // Local State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkProviderName, setLinkProviderName] =
    useState<OAuthProvider>("GOOGLE");
  const [linkMockCode, setLinkMockCode] = useState("");

  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [donationProvider, setDonationProvider] = useState("Ko-fi");
  const [donationUrl, setDonationUrl] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: profile, isLoading: isProfileLoading } =
    trpc.user.getProfile.useQuery(
      { userId: currentUser?.id },
      { enabled: !!currentUser?.id },
    );

  const { data: analytics, isLoading: isAnalyticsLoading } =
    trpc.user.getAnalytics.useQuery(undefined, { enabled: !!currentUser?.id });

  const { data: topPostsData, isLoading: isTopPostsLoading } =
    trpc.user.getTopPosts.useQuery(undefined, { enabled: !!currentUser?.id });

  const { data: linkedProviders, isLoading: isLinkedLoading } =
    trpc.auth.getLinkedProviders.useQuery(undefined, {
      enabled: !!currentUser?.id,
    });

  // Mutations
  const updateProfileMutation = trpc.user.updateProfile.useMutation();
  const linkProviderMutation = trpc.auth.linkProvider.useMutation();
  const unlinkProviderMutation = trpc.auth.unlinkProvider.useMutation();

  if (
    isProfileLoading ||
    isAnalyticsLoading ||
    isTopPostsLoading ||
    isLinkedLoading
  ) {
    return (
      <div className="p-8 text-center text-body-lg skeleton-shimmer">
        Loading dashboard data...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-body-md text-error">
        Failed to resolve your profile session. Please try logging in again.
      </div>
    );
  }

  const totals = analytics?.totals ?? {
    posts: 0,
    views: 0,
    fullReads: 0,
    comments: 0,
    likes: 0,
    saves: 0,
    followers: 0,
  };

  const averages = analytics?.averages ?? {
    views: 0,
    fullReads: 0,
    comments: 0,
    likes: 0,
    saves: 0,
  };

  const topPostsList = (topPostsData ?? []).map((post: any) =>
    mapBackendToCard(post, post.contentType.toLowerCase() as ContentType, {
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    }),
  );

  const roleBadgeVariant =
    profile.role === USER_ROLES.EDITOR
      ? "primary"
      : profile.role === USER_ROLES.ADMIN
        ? "info"
        : "success";

  const getRoleLabel = (role: string) => {
    switch (role) {
      case USER_ROLES.ADMIN:
        return "Administrator";
      case USER_ROLES.EDITOR:
        return "Editor";
      case USER_ROLES.VERIFIED:
        return "Verified Author";
      case USER_ROLES.TEMP_VERIFIED:
        return "Verified (Temporary)";
      case USER_ROLES.TEMP_UNVERIFIED:
        return "Unverified (Temporary)";
      case USER_ROLES.UNVERIFIED:
        return "Unverified Author";
      default:
        return role;
    }
  };

  // Handlers
  const handleStartEditName = () => {
    setNameInput(profile.name);
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return toast("Name cannot be empty.", "warning");
    try {
      await updateProfileMutation.mutateAsync({ name: nameInput });
      setIsEditingName(false);
      toast("Name updated successfully!", "success");
      utils.user.getProfile.invalidate({ userId: currentUser?.id });
    } catch (err: any) {
      toast(err.message || "Failed to update name.", "error");
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      await updateProfileMutation.mutateAsync({ avatarUrl: url });
      toast("Profile picture updated!", "success");
      utils.user.getProfile.invalidate({ userId: currentUser?.id });
    } catch (err: any) {
      toast(err.message || "Failed to upload avatar.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkProvider = async () => {
    if (!linkMockCode.trim())
      return toast("Please enter a mock code.", "warning");
    try {
      await linkProviderMutation.mutateAsync({
        provider: linkProviderName,
        code: linkMockCode,
        redirectUri: window.location.origin + "/dashboard",
      });
      toast(`Successfully linked ${linkProviderName}!`, "success");
      setIsLinkModalOpen(false);
      setLinkMockCode("");
      utils.auth.getLinkedProviders.invalidate();
    } catch (err: any) {
      toast(err.message || "Failed to link provider.", "error");
    }
  };

  const handleUnlinkProvider = async (provider: any) => {
    try {
      await unlinkProviderMutation.mutateAsync({ provider });
      toast(`Successfully unlinked ${provider}.`, "success");
      utils.auth.getLinkedProviders.invalidate();
    } catch (err: any) {
      toast(err.message || "Failed to unlink provider.", "error");
    }
  };

  const handleAddDonationLink = async () => {
    if (!donationUrl.trim()) return toast("URL cannot be empty.", "warning");
    try {
      const currentLinks = (profile.donationLinks as any) || [];
      const updatedLinks = [
        ...currentLinks,
        { provider: donationProvider, url: donationUrl },
      ];

      await updateProfileMutation.mutateAsync({ donationLinks: updatedLinks });
      toast("Donation link added!", "success");
      setIsDonationModalOpen(false);
      setDonationUrl("");
      utils.user.getProfile.invalidate({ userId: currentUser?.id });
    } catch (err: any) {
      toast(err.message || "Failed to add donation link.", "error");
    }
  };

  const handleRemoveDonationLink = async (index: number) => {
    try {
      const currentLinks = [...((profile.donationLinks as any) || [])];
      currentLinks.splice(index, 1);

      await updateProfileMutation.mutateAsync({ donationLinks: currentLinks });
      toast("Donation link removed.", "success");
      utils.user.getProfile.invalidate({ userId: currentUser?.id });
    } catch (err: any) {
      toast(err.message || "Failed to remove donation link.", "error");
    }
  };

  return (
    <article className="p-8 space-y-10 animate-fade-in pb-24">
      {/* Profile Info */}
      <section className="rounded-2xl max-w-5xl bg-surface border border-border-custom p-6">
        <h2 className="text-headline-md text-on-surface mb-6 border-b border-border-custom pb-2">
          Profile Information
        </h2>

        <section className="flex flex-col md:flex-row items-start gap-6">
          <section
            className="relative group cursor-pointer"
            onClick={handleAvatarClick}
          >
            <Avatar src={profile.avatarUrl} alt={profile.name} size="xl" />
            <button
              type="button"
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Change profile picture"
            >
              <Camera size={20} className="text-white" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </section>

          <section className="flex-1 space-y-3">
            <section className="flex flex-wrap items-center gap-3">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="rounded-xl bg-neutral border border-border-custom px-3 py-1.5 text-headline-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/30 font-semibold"
                  />
                  <Button variant="primary" size="sm" onClick={handleSaveName}>
                    <Check size={14} /> Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingName(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-headline-lg text-on-surface font-semibold">
                    {profile.name}
                  </h3>
                  <button
                    type="button"
                    onClick={handleStartEditName}
                    className="p-1 hover:bg-neutral rounded-lg text-on-surface-muted hover:text-on-surface transition-all"
                    aria-label="Edit name"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              )}
              <Badge
                label={getRoleLabel(profile.role)}
                variant={roleBadgeVariant}
              />
            </section>
            <p className="text-body-md text-on-surface-muted">
              {profile.email}
            </p>

            <section className="flex items-center gap-4 text-label-lg">
              <span className="text-on-surface">
                {profile._count?.followers.toLocaleString()}{" "}
                <span className="text-on-surface-muted font-normal">
                  followers
                </span>
              </span>
              <span className="text-on-surface">
                {profile._count?.following.toLocaleString()}{" "}
                <span className="text-on-surface-muted font-normal">
                  following
                </span>
              </span>
            </section>

            <p className="text-label-md text-on-surface-muted">
              Member since {new Date(profile.createdAt).toLocaleDateString()}
            </p>
          </section>
        </section>
      </section>

      {/* Linked Accounts & Support */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Linked Accounts */}
        <section className="rounded-2xl bg-surface border border-border-custom p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-border-custom pb-2">
            <h2 className="text-headline-md text-on-surface">
              Linked Accounts
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsLinkModalOpen(true)}
            >
              <Plus size={14} /> Link Provider
            </Button>
          </div>
          <ul className="space-y-3">
            {linkedProviders && linkedProviders.length > 0 ? (
              linkedProviders.map((acc) => (
                <li
                  key={acc.provider}
                  className="flex justify-between items-center p-3 rounded-xl bg-neutral/10 border border-border-custom"
                >
                  <div className="flex items-center gap-2">
                    <LinkIcon size={16} className="text-primary" />
                    <span className="text-label-md text-on-surface capitalize font-semibold">
                      {acc.provider.toLowerCase()}
                    </span>
                    <span className="text-body-xs text-on-surface-muted">
                      ({new Date(acc.createdAt).toLocaleDateString()})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error hover:bg-error/10"
                    onClick={() => handleUnlinkProvider(acc.provider)}
                    disabled={(linkedProviders?.length ?? 0) <= 1}
                  >
                    Unlink
                  </Button>
                </li>
              ))
            ) : (
              <li className="text-on-surface-muted italic text-sm">
                No linked accounts found.
              </li>
            )}
          </ul>
        </section>

        {/* Donation Support Links */}
        <section className="rounded-2xl bg-surface border border-border-custom p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-border-custom pb-2">
            <h2 className="text-headline-md text-on-surface">Donation Links</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDonationModalOpen(true)}
            >
              <Plus size={14} /> Add Link
            </Button>
          </div>
          <ul className="space-y-3">
            {profile.donationLinks &&
            (profile.donationLinks as any).length > 0 ? (
              ((profile.donationLinks as any) || []).map(
                (link: any, index: number) => (
                  <li
                    key={index}
                    className="flex justify-between items-center p-3 rounded-xl bg-neutral/10 border border-border-custom"
                  >
                    <div className="flex items-center gap-2">
                      <Coffee size={16} className="text-warning" />
                      <span className="text-label-md text-on-surface font-semibold">
                        {link.provider}
                      </span>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-body-xs text-primary hover:underline truncate max-w-xs"
                      >
                        {link.url}
                      </a>
                    </div>
                    <button
                      type="button"
                      className="p-1 hover:bg-error/10 text-on-surface-muted hover:text-error rounded-lg transition-colors"
                      onClick={() => handleRemoveDonationLink(index)}
                      aria-label="Remove link"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ),
              )
            ) : (
              <li className="text-on-surface-muted italic text-sm">
                No donation links set up.
              </li>
            )}
          </ul>
        </section>
      </section>

      {/* Analytics Stats */}
      <section className="space-y-6">
        <h2 className="text-headline-md text-on-surface">Analytics</h2>

        {/* Totals */}
        <section>
          <h3 className="text-label-lg text-on-surface-muted mb-3 uppercase tracking-wide">
            Total
          </h3>
          <ul className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <li>
              <StatCard
                icon={<PenTool size={16} />}
                label="Posts"
                value={totals.posts}
              />
            </li>
            <li>
              <StatCard
                icon={<Eye size={16} />}
                label="Views"
                value={totals.views.toLocaleString()}
              />
            </li>
            <li>
              <StatCard
                icon={<BookOpen size={16} />}
                label="Full Reads"
                value={totals.fullReads.toLocaleString()}
              />
            </li>
            <li>
              <StatCard
                icon={<MessageCircle size={16} />}
                label="Comments"
                value={totals.comments}
              />
            </li>
            <li>
              <StatCard
                icon={<Heart size={16} />}
                label="Likes"
                value={totals.likes.toLocaleString()}
              />
            </li>
            <li>
              <StatCard
                icon={<Bookmark size={16} />}
                label="Saves"
                value={totals.saves.toLocaleString()}
              />
            </li>
            <li>
              <StatCard
                icon={<Users size={16} />}
                label="Followers"
                value={totals.followers.toLocaleString()}
              />
            </li>
          </ul>
        </section>

        {/* Averages */}
        <section>
          <h3 className="text-label-lg text-on-surface-muted mb-3 uppercase tracking-wide">
            Per Post Average
          </h3>
          <ul className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <li>
              <StatCard
                icon={<Eye size={16} />}
                label="Views"
                value={averages.views}
              />
            </li>
            <li>
              <StatCard
                icon={<BookOpen size={16} />}
                label="Full Reads"
                value={averages.fullReads}
              />
            </li>
            <li>
              <StatCard
                icon={<MessageCircle size={16} />}
                label="Comments"
                value={averages.comments}
              />
            </li>
            <li>
              <StatCard
                icon={<Heart size={16} />}
                label="Likes"
                value={averages.likes}
              />
            </li>
            <li>
              <StatCard
                icon={<Bookmark size={16} />}
                label="Saves"
                value={averages.saves}
              />
            </li>
          </ul>
        </section>

        {/* Top Posts */}
        <section>
          <header className="flex items-center justify-between mb-4">
            <h3 className="text-label-lg text-on-surface-muted uppercase tracking-wide">
              Top 5 Most Popular Posts
            </h3>
            <Link
              to={ROUTES.STUDIO}
              className="text-label-lg text-primary hover:text-secondary transition-colors flex items-center gap-1"
            >
              See Studio <ArrowRight size={14} />
            </Link>
          </header>

          {topPostsList.length > 0 ? (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {topPostsList.map((post) => (
                <li key={post.id}>
                  <ContentCard data={post} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-on-surface-muted italic">
              You haven't published any content yet.
            </div>
          )}
        </section>
      </section>

      {/* Link Additional Provider Modal */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Link Additional OAuth Provider"
        confirmLabel="Link"
        onConfirm={handleLinkProvider}
        isLoading={linkProviderMutation.isPending}
      >
        <div className="space-y-4">
          <fieldset className="space-y-1">
            <legend className="text-body-sm text-on-surface-muted">
              Provider
            </legend>
            <select
              value={linkProviderName}
              onChange={(e) => setLinkProviderName(e.target.value as any)}
              className="w-full rounded-xl bg-neutral border border-border-custom px-4 py-3 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/30"
            >
              <option value="GOOGLE">Google</option>
              <option value="GITHUB">GitHub</option>
              <option value="APPLE">Apple</option>
              <option value="FACEBOOK">Facebook</option>
            </select>
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="text-body-sm text-on-surface-muted">
              Developer Mock Code
            </legend>
            <input
              type="text"
              placeholder="e.g. mock_google_user"
              value={linkMockCode}
              onChange={(e) => setLinkMockCode(e.target.value)}
              className="w-full rounded-xl bg-neutral border border-border-custom px-4 py-3 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
            <p className="text-body-xs text-on-surface-muted">
              Use code format `mock_[provider]_[identifier]` matching your
              account email's name for easy linking verification.
            </p>
          </fieldset>
        </div>
      </Modal>

      {/* Add Donation Link Modal */}
      <Modal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
        title="Add Donation Support Link"
        confirmLabel="Add Support Link"
        onConfirm={handleAddDonationLink}
        isLoading={updateProfileMutation.isPending}
      >
        <div className="space-y-4">
          <fieldset className="space-y-1">
            <legend className="text-body-sm text-on-surface-muted">
              Platform Provider
            </legend>
            <select
              value={donationProvider}
              onChange={(e) => setDonationProvider(e.target.value)}
              className="w-full rounded-xl bg-neutral border border-border-custom px-4 py-3 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/30"
            >
              <option value="Ko-fi">Ko-fi</option>
              <option value="Patreon">Patreon</option>
              <option value="PayPal">PayPal</option>
              <option value="Buy Me a Coffee">Buy Me a Coffee</option>
            </select>
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="text-body-sm text-on-surface-muted">
              Support URL
            </legend>
            <input
              type="url"
              placeholder="https://ko-fi.com/username"
              value={donationUrl}
              onChange={(e) => setDonationUrl(e.target.value)}
              className="w-full rounded-xl bg-neutral border border-border-custom px-4 py-3 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </fieldset>
        </div>
      </Modal>
    </article>
  );
}
