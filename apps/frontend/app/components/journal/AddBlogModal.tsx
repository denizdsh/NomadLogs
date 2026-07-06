import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import type { RouterOutputs } from "~/utils/trpc";

type StandaloneBlog = RouterOutputs["blog"]["getStandaloneBlogs"][number];

interface AddBlogModalProps {
  isOpen: boolean;
  onClose: () => void;
  standaloneBlogs: StandaloneBlog[] | undefined;
  blogsInJournal: { id: string }[];
  onAdd: (blog: StandaloneBlog) => void;
}

export function AddBlogModal({
  isOpen,
  onClose,
  standaloneBlogs,
  blogsInJournal,
  onAdd,
}: AddBlogModalProps) {
  const filteredBlogs = standaloneBlogs?.filter(
    (b) => !blogsInJournal.some((bij) => bij.id === b.id)
  ) ?? [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Blog to Journal">
      <div className="space-y-4">
        <p className="text-body-sm text-on-surface-muted">
          Select one of your standalone blogs (blogs not belonging to any other journal) to add:
        </p>
        <ul className="max-h-72 overflow-y-auto space-y-2 divide-y divide-border-custom pr-1">
          {filteredBlogs.length > 0 ? (
            filteredBlogs.map((blog) => (
              <li key={blog.id} className="pt-2 first:pt-0">
                <div className="flex justify-between items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-label-md text-on-surface font-semibold truncate">
                      {blog.title}
                    </h4>
                    <p className="text-body-xs text-on-surface-muted truncate">
                      {blog.description}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => onAdd(blog)}>
                    Add
                  </Button>
                </div>
              </li>
            ))
          ) : (
            <li className="text-center py-6 text-on-surface-muted italic">
              No standalone blogs found.
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
