import ConfirmModal from "../../shared/ConfirmModal";

// A small "are you sure" box used before anything is deleted.
export const ConfirmDelete = ({ item, title, detail, busy, onClose, onConfirm }) => <ConfirmModal isOpen={Boolean(item)} title={title} description={detail} confirmLabel="Delete" tone="danger" isLoading={busy} onClose={onClose} onConfirm={onConfirm} />;
