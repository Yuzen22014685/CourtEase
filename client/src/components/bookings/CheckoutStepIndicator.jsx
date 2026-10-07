import { Fragment } from 'react'
import { CheckIcon } from '@heroicons/react/24/solid'

export default function CheckoutStepIndicator({ steps, currentStep, failedAll = false }) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep)
  const payIndex = steps.findIndex((s) => s.id === 'pay')

  return (
    <div className="w-full pb-4 border-b border-gray-100">
      <nav aria-label="Checkout Progress">
        <ol className="flex items-center w-full">
          {steps.map((step, idx) => {
            const isSkipped = failedAll && step.id === 'pay'
            const isCompleted = !isSkipped && idx < currentIndex
            const isCurrent = !isSkipped && idx === currentIndex
            const isConnectorActive =
              idx < currentIndex && !(failedAll && payIndex !== -1 && idx >= payIndex - 1)

            return (
              <Fragment key={step.id}>
                <li className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <span
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 transition-colors ${
                      isCompleted
                        ? 'bg-primary-600 text-white'
                        : isCurrent
                        ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-600'
                        : isSkipped
                        ? 'bg-gray-100 text-gray-400 border border-gray-200'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isSkipped ? (
                      <span className="text-xs font-bold leading-none select-none">−</span>
                    ) : isCompleted ? (
                      <CheckIcon className="h-3.5 w-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span
                    className={`text-xs font-semibold shrink-0 ${
                      isCurrent
                        ? 'text-gray-900'
                        : isCompleted
                        ? 'text-gray-700'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </li>

                {idx < steps.length - 1 && (
                  <li
                    aria-hidden="true"
                    className={`flex-1 min-w-[1.25rem] sm:min-w-[2.5rem] h-0.5 mx-2 sm:mx-3 rounded ${
                      isConnectorActive ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </Fragment>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
