import { Modal } from "~/components/ui/Modal";

interface SwapPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  blogTitle: string | undefined;
  maxPosition: number;
  positionValue: number;
  onChangePosition: (value: number) => void;
  onConfirm: () => void;
}

export function SwapPositionModal({
  isOpen,
  onClose,
  blogTitle,
  maxPosition,
  positionValue,
  onChangePosition,
  onConfirm,
}: SwapPositionModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Swap Blog Position"
      confirmLabel="Swap"
      onConfirm={onConfirm}
    >
      <div className="space-y-4">
        <p className="text-body-md text-on-surface">
          Change the position number of <strong>{blogTitle || ""}</strong>:
        </p>
        <div className="flex items-center gap-3">
          <span className="text-body-md text-on-surface-muted">Move to Position:</span>
          <input
            type="number"
            min={1}
            max={maxPosition}
            value={positionValue}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) onChangePosition(val);
            }}
            className="w-24 rounded-xl bg-neutral border border-border-custom px-3 py-2 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/30 text-center"
          />
          <span className="text-body-md text-on-surface-muted">of {maxPosition}</span>
        </div>
      </div>
    </Modal>
  );
}
