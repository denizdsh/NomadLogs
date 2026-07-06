import { useState } from "react";
import { Settings, AlertTriangle, LogOut } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { Modal } from "~/components/ui/Modal";
import { trpc } from "~/utils/trpc";
import { useAuth } from "~/providers/AuthProvider";
import { useToast } from "~/providers/ToastProvider";
import { useNavigate } from "react-router";
import { CONFIRMATION_TEXTS } from "~/constants/api";
import { ROUTES } from "~/constants/routes";

export function meta() {
  return [
    { title: "Settings — NomadLogs" },
    { name: "description", content: "Manage your NomadLogs account settings." },
  ];
}

export default function UserSettings() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const deleteMutation = trpc.user.deleteAccount.useMutation();

  const handleLogout = () => {
    logout();
    toast("Successfully signed out.", "success");
    navigate(ROUTES.HOME);
  };

  const handleDeleteProfile = async () => {
    if (deleteConfirmation !== CONFIRMATION_TEXTS.DELETE) return;

    try {
      await deleteMutation.mutateAsync({ confirmationText: CONFIRMATION_TEXTS.DELETE });
      toast("Your profile and all contents have been permanently deleted.", "info");
      logout();
      navigate(ROUTES.HOME);
    } catch (err: any) {
      toast(err.message || "Failed to delete account.", "error");
    }
  };

  const canDelete = deleteConfirmation === CONFIRMATION_TEXTS.DELETE;

  return (
    <article className="p-8 max-w-2xl animate-fade-in">
      <header className="flex items-center gap-3 mb-8">
        <Settings size={24} className="text-on-surface-muted" />
        <h1 className="text-headline-lg text-on-surface">Settings</h1>
      </header>

      {/* Account Session */}
      <section className="rounded-2xl border border-border-custom bg-surface p-6 space-y-4 mb-6">
        <header className="flex items-center gap-2">
          <LogOut size={20} className="text-on-surface-muted" />
          <h2 className="text-headline-md text-on-surface">Account Session</h2>
        </header>

        <section className="flex items-center justify-between gap-6 flex-wrap md:flex-nowrap">
          <section>
            <h3 className="text-label-lg text-on-surface">Sign Out</h3>
            <p className="text-body-sm text-on-surface-muted">
              Disconnect from your account on this device.
            </p>
          </section>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </section>
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border-2 border-error/30 bg-surface p-6 space-y-4">
        <header className="flex items-center gap-2">
          <AlertTriangle size={20} className="text-error" />
          <h2 className="text-headline-md text-error">Danger Zone</h2>
        </header>

        <section className="flex items-center justify-between gap-6 flex-wrap md:flex-nowrap">
          <section>
            <h3 className="text-label-lg text-on-surface">Delete Profile</h3>
            <p className="text-body-sm text-on-surface-muted">
              Permanently delete your account and all your content. This action cannot be undone.
            </p>
          </section>
          <Button variant="danger" size="sm" onClick={() => setIsDeleteModalOpen(true)}>
            Delete Profile
          </Button>
        </section>
      </section>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteConfirmation("");
        }}
        title="Delete Profile"
        confirmLabel="Delete Everything"
        variant="danger"
        onConfirm={handleDeleteProfile}
        confirmDisabled={!canDelete}
      >
        <section className="space-y-4">
          <p className="text-body-md text-on-surface">
            This will permanently delete your profile and <strong>all your content</strong> (blogs, journals, travel plans, and comments). This action cannot be undone.
          </p>
          <fieldset className="space-y-2">
            <legend className="text-label-lg text-on-surface">
              Type <strong className="text-error">{CONFIRMATION_TEXTS.DELETE}</strong> to confirm
            </legend>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={`Type ${CONFIRMATION_TEXTS.DELETE}`}
              className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-md focus:border-error focus:ring-1 focus:ring-error/30 transition-all font-mono"
            />
          </fieldset>
          {deleteConfirmation && !canDelete && (
            <p className="text-label-md text-error">Please type {CONFIRMATION_TEXTS.DELETE} exactly to confirm.</p>
          )}
        </section>
      </Modal>
    </article>
  );
}
