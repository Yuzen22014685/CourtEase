import clsx from 'clsx'

const variants = {
  confirmed:  'bg-green-100 text-green-800',
  completed:  'bg-green-100 text-green-800',
  pending:    'bg-yellow-100 text-yellow-800',
  rejected:   'bg-red-100 text-red-700',
  cancelled:  'bg-red-100 text-red-700',
  expired:    'bg-gray-100 text-gray-600',
  refunded:   'bg-gray-100 text-gray-600',
  not_verified: 'bg-orange-50 text-orange-700',
  'not verified': 'bg-orange-50 text-orange-700',
  paid:       'bg-blue-100 text-blue-800',
  active:     'bg-green-100 text-green-800',
  inactive:   'bg-gray-100 text-gray-700',
  maintenance:'bg-orange-100 text-orange-800',
  visible:    'bg-green-100 text-green-800',
  hidden:     'bg-gray-100 text-gray-700',
}

const dots = {
  confirmed: 'bg-green-500',
  completed: 'bg-green-500',
  pending:   'bg-yellow-500',
  rejected:  'bg-red-500',
  cancelled: 'bg-red-500',
  expired:   'bg-gray-400',
  refunded:  'bg-gray-400',
  not_verified: 'bg-orange-400',
  'not verified': 'bg-orange-400',
  paid:      'bg-blue-500',
  active:    'bg-green-500',
  inactive:  'bg-gray-400',
  maintenance:'bg-orange-500',
  visible:   'bg-green-500',
  hidden:    'bg-gray-400',
}

const customLabels = {
  not_verified: 'Not verified',
  'not verified': 'Not verified',
}

export default function Badge({ status, label, className = '' }) {
  const key = (status || '').toLowerCase()
  const text = label || customLabels[key] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : '—')

  return (
    <span className={clsx('badge', variants[key] ?? 'bg-gray-100 text-gray-600', className)}>
      <span className={clsx('mr-1.5 h-1.5 w-1.5 rounded-full inline-block', dots[key] ?? 'bg-gray-400')} />
      {text}
    </span>
  )
}
