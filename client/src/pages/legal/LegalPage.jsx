import { Link, useNavigate, useLocation } from 'react-router-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import { homePathForRole } from '../../utils/routes'
import { PRIVACY, TERMS, LEGAL_EFFECTIVE } from '../../content/legal'

export default function LegalPage({ doc }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const handleClose = () => {
    const target = location.state?.from || (user ? homePathForRole(user.role) : '/login')
    navigate(target, { replace: true })
  }

  const isPrivacy = doc === 'privacy'
  const isTerms   = doc === 'terms'
  const content   = isPrivacy ? PRIVACY : isTerms ? TERMS : null

  if (!content) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">Page not found</p>
          <Link to="/" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            ← Go home
          </Link>
        </div>
      </div>
    )
  }

  const otherLabel = isPrivacy ? 'Terms of Use' : 'Privacy Notice'
  const otherPath  = isPrivacy ? '/terms' : '/privacy'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Sticky top row: Logo on the left, Close on the right */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center
                            group-hover:bg-primary-700 transition-colors shrink-0">
              <span className="text-white text-lg" aria-hidden>🏸</span>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">
              Court<span className="text-primary-600">Ease</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={handleClose}
            className="btn-secondary btn-sm inline-flex items-center gap-1.5 shrink-0"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>
      </header>

      {/* Main legal content */}
      <main className="flex-1 py-6 sm:py-10 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Card */}
          <div className="card p-6 sm:p-8">

            {/* Heading */}
            <h1 className="page-title mb-1">{content.title}</h1>
            <p className="text-sm text-gray-400 mb-6">Effective {LEGAL_EFFECTIVE}</p>

            {/* Intro */}
            {content.intro && content.intro.map((p, i) => (
              <p key={i} className="text-gray-600 leading-relaxed mb-4">{p}</p>
            ))}

            {/* Sections */}
            {content.sections && content.sections.map((section, si) => (
              <div key={si} className="mt-6">
                <h2 className="font-semibold text-gray-900 mb-2">{section.heading}</h2>
                {section.paragraphs && section.paragraphs.map((p, pi) => (
                  <p key={pi} className="text-gray-600 leading-relaxed mb-3">{p}</p>
                ))}
                {section.bullets && (
                  <ul className="list-disc list-outside pl-5 space-y-1.5 text-gray-600">
                    {section.bullets.map((b, bi) => (
                      <li key={bi} className="leading-relaxed">{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {/* Footer row */}
            <div className="mt-10 pt-6 border-t border-gray-100 flex items-center justify-between gap-3">
              <Link
                to={otherPath}
                replace
                state={{ from: location.state?.from }}
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                {otherLabel} →
              </Link>
            </div>

          </div>

          {/* Bottom padding for mobile */}
          <div className="h-8" />
        </div>
      </main>
    </div>
  )
}
