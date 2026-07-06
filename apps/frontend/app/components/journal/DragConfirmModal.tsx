import { Modal } from "~/components/ui/Modal";

interface DragConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DragConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isPending,
}: DragConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Order Change"
      confirmLabel="Apply Change"
      onConfirm={onConfirm}
      isLoading={isPending}
    >
      <p className="text-body-md text-on-surface">
        Are you sure you want to change the order of the blogs inside this journal?
      </p>
    </Modal>
  );
}
