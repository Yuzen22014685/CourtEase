import Modal from './Modal'

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'primary' // 'primary' or 'danger'
}) {
  const confirmButtonClass = confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} className="btn-secondary px-4">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} className={`${confirmButtonClass} px-4`}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
