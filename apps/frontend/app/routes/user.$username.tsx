import { Link, useParams } from "react-router";
import { UserPlus, Heart, Bookmark, MessageCircle, BookOpen, PenTool, Map, Users } from "lucide-react";
import { Avatar } from "~/components/ui/Avatar";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { StatCard } from "~/components/ui/StatCard";
import { ContentCard } from "~/components/ui/ContentCard";
import { Tag } from "~/components/ui/Tag";
import { useState } from "react";
import { trpc, type RouterOutputs } from "~/utils/trpc";
import { useAuth } from "~/providers/AuthProvider";
import { useToast } from "~/providers/ToastProvider";
import { mapBackendToCard } from "~/utils/mappers";
import type { UserRole, ContentType } from "~/types/content";
import { USER_ROLES } from "~/constants/content";
import { ROUTES } from "~/constants/routes";

export function meta() {
  return [
    { title: "User Profile — NomadLogs" },
    { name: "description", content: "View this traveller's profile and content on NomadLogs." },
  ];
}

const CONTENT_TYPES = [
  { key: "journals", label: "Journals", val: "JOURNAL" },
  { key: "blogs", label: "Blogs", val: "BLOG" },
  { key: "travel-plans", label: "Travel Plans", val: "TRAVEL_PLAN" },
];

export default function UserContent() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const isAuthenticated = !!currentUser;

  const [activeTypes, setActiveTypes] = useState<string[]>(["BLOG", "JOURNAL", "TRAVEL_PLAN"]);

  // Fetch target user profile details
  const { data: profileUser, isLoading: isProfileLoading } = trpc.user.getProfile.useQuery({
    name: username!,
  });

  // Check if current user is following target user
  const { data: followStatus } = trpc.user.isFollowing.useQuery(
    { targetUserId: profileUser?.id ?? "" },
    { enabled: !!profileUser?.id && isAuthenticated }
  );
  const isFollowing = followStatus?.isFollowing ?? false;

  // Fetch target user contents list
  const { data: userContents, isLoading: isContentsLoading } = trpc.explore.list.useQuery(
    {
      authorId: profileUser?.id,
      contentTypes: activeTypes as ("BLOG" | "JOURNAL" | "TRAVEL_PLAN")[],
      limit: 50,
    },
    { enabled: !!profileUser?.id }
  );

  // Mutations
  const followMutation = trpc.user.follow.useMutation();
  const unfollowMutation = trpc.user.unfollow.useMutation();
  const changeUserRole = trpc.user.changeRole.useMutation();

  const handleFollowToggle = async () => {
    if (!isAuthenticated) return toast("Please log in to follow other travellers.", "warning");
    if (!profileUser) return;

    try {
      if (isFollowing) {
        await unfollowMutation.mutateAsync({ targetUserId: profileUser.id });
        toast(`Unfollowed ${profileUser.name}`, "info");
      } else {
        await followMutation.mutateAsync({ targetUserId: profileUser.id });
        toast(`Followed ${profileUser.name}!`, "success");
      }
      utils.user.isFollowing.invalidate({ targetUserId: profileUser.id });
      utils.user.getProfile.invalidate({ name: username! });
    } catch (err) {
      toast("Action failed.", "error");
    }
  };

  const handleChangeRole = async (role: UserRole) => {
    if (!profileUser) return;
    try {
      await changeUserRole.mutateAsync({ targetUserId: profileUser.id, newRole: role });
      toast("User role updated successfully!", "success");
      utils.user.getProfile.invalidate({ name: username! });
    } catch (err: any) {
      toast(err.message || "Failed to update role.", "error");
    }
  };

  const toggleType = (val: string) => {
    setActiveTypes((prev) =>
      prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val]
    );
  };

  if (isProfileLoading) {
    return <div className="p-8 text-center text-body-lg skeleton-shimmer">Loading profile...</div>;
  }

  if (!profileUser) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <h1 className="text-headline-lg text-error">User Not Found</h1>
        <p className="text-body-md text-on-surface-muted">The user @{username} does not exist.</p>
        <Link to={ROUTES.EXPLORE} className="text-primary font-semibold hover:underline">Back to Explore</Link>
      </div>
    );
  }

  const cardsList = userContents?.flatMap((res: any) =>
    res.items.map((item: any) =>
      mapBackendToCard(item, res.contentType.toLowerCase() as ContentType, {
        name: profileUser.name,
        avatarUrl: profileUser.avatarUrl,
      })
    )
  ) ?? [];

  const roleBadgeVariant =
    profileUser.role === USER_ROLES.EDITOR ? "primary" : profileUser.role === USER_ROLES.ADMIN ? "info" : "success";

  return (
    <article className="mx-auto max-w-7xl px-6 py-8 animate-fade-in">
      {/* Profile header */}
      <header className="rounded-2xl bg-surface border border-border-custom p-8 mb-8">
        <section className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <Avatar src={profileUser.avatarUrl} alt={profileUser.name} size="xl" />

          <section className="flex-1 text-center md:text-left">
            <section className="flex flex-col md:flex-row items-center gap-3 mb-2 justify-center md:justify-start">
              <h1 className="text-headline-lg text-on-surface">{profileUser.name}</h1>
              <Badge label={profileUser.role} variant={roleBadgeVariant} />
            </section>
            <p className="text-body-md text-on-surface-muted mb-4">@{username}</p>

            {profileUser.id !== currentUser?.id && (
              <div className="space-y-4">
                <nav className="flex items-center gap-3 justify-center md:justify-start">
                  <Button variant={isFollowing ? "secondary" : "primary"} size="sm" onClick={handleFollowToggle}>
                    <UserPlus size={14} /> {isFollowing ? "Unfollow" : "Follow"}
                  </Button>
                  <span className="text-label-lg text-on-surface">
                    {profileUser._count?.followers.toLocaleString()}{" "}
                    <span className="text-on-surface-muted font-normal">followers</span>
                  </span>
                  <span className="text-label-lg text-on-surface">
                    {profileUser._count?.following.toLocaleString()}{" "}
                    <span className="text-on-surface-muted font-normal">following</span>
                  </span>
                </nav>

                {(currentUser?.role === USER_ROLES.EDITOR || currentUser?.role === USER_ROLES.ADMIN) && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border-custom justify-center md:justify-start">
                    <span className="text-label-md text-on-surface-muted">Manage User Role:</span>
                    <select
                      value={profileUser.role}
                      onChange={(e) => handleChangeRole(e.target.value as any)}
                      className="rounded-xl bg-neutral border border-border-custom px-3 py-1.5 text-body-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/30"
                    >
                      <option value={USER_ROLES.UNVERIFIED}>Unverified</option>
                      <option value={USER_ROLES.VERIFIED}>Verified Author</option>
                      {currentUser?.role === USER_ROLES.ADMIN && (
                        <>
                          <option value={USER_ROLES.EDITOR}>Editor</option>
                          <option value={USER_ROLES.ADMIN}>Administrator</option>
                        </>
                      )}
                    </select>
                  </div>
                )}
              </div>
            )}
          </section>
        </section>

        {/* Stats cards */}
        <ul className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-6">
          <li><StatCard icon={<BookOpen size={18} />} label="Journals" value={profileUser._count?.journals ?? 0} /></li>
          <li><StatCard icon={<PenTool size={18} />} label="Blogs" value={profileUser._count?.blogs ?? 0} /></li>
          <li><StatCard icon={<Map size={18} />} label="Plans" value={profileUser._count?.travelPlans ?? 0} /></li>
          <li><StatCard icon={<Users size={18} />} label="Followers" value={profileUser._count?.followers ?? 0} /></li>
          <li><StatCard icon={<Users size={18} />} label="Following" value={profileUser._count?.following ?? 0} /></li>
        </ul>
      </header>

      {/* Content filters */}
      <nav className="flex items-center gap-2 mb-6" aria-label="Content type filters">
        {CONTENT_TYPES.map((type) => (
          <Tag
            key={type.key}
            label={type.label}
            variant="content-type"
            isActive={activeTypes.includes(type.val)}
            onToggle={() => toggleType(type.val)}
          />
        ))}
      </nav>

      {/* Content grid */}
      {isContentsLoading ? (
        <div className="p-8 text-center skeleton-shimmer">Loading items...</div>
      ) : cardsList.length > 0 ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cardsList.map((item) => (
            <li key={`${item.contentType}-${item.id}`}>
              <ContentCard data={item} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center p-12 text-on-surface-muted italic">No public items found for this traveller.</div>
      )}
    </article>
  );
}
