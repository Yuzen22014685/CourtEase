import { ExclamationCircleIcon } from '@heroicons/react/24/outline'

export default function ErrorMessage({ message, className = '' }) {
  if (!message) return null
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 ${className}`}
         role="alert">
      <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
