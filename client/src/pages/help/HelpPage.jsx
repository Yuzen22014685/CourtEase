import { Link } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import { SUPPORT_EMAIL } from '../../content/legal'
import { HELP_CONTACTS, HELP_FAQ } from '../../content/help'
import {
  QuestionMarkCircleIcon,
  BuildingStorefrontIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'

const CONTACT_ICONS = {
  venue: BuildingStorefrontIcon,
  support: EnvelopeIcon,
  assistant: ChatBubbleLeftRightIcon,
}

export default function HelpPage() {
  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-primary-600 text-sm font-medium mb-2">
            <QuestionMarkCircleIcon className="h-4 w-4" />
            Help
          </div>
          <h1 className="page-title text-3xl mb-3">Help &amp; Contact</h1>
          <p className="text-gray-500 text-sm max-w-lg">
            Who to contact about courts, payments, your account or the app.
          </p>
        </div>

        {/* Section: Who to contact */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">Who to contact</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {HELP_CONTACTS.map((contact) => {
              const Icon = CONTACT_ICONS[contact.key] || QuestionMarkCircleIcon
              return (
                <div key={contact.key} className="card p-5 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{contact.title}</h3>
                    <p className="text-xs text-primary-700 font-medium">{contact.when}</p>
                  </div>
                  <ul className="space-y-1.5">
                    {contact.points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-0.5 text-gray-400 shrink-0">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">{contact.how}</p>
                  {contact.key === 'support' && (
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="btn-secondary btn-sm w-full justify-center flex items-center gap-1.5"
                    >
                      <EnvelopeIcon className="h-4 w-4" />
                      Email support
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Section: Common questions */}
        <section className="mt-10">
          <h2 className="font-semibold text-gray-900 mb-3">Common questions</h2>
          <div className="card divide-y divide-gray-100">
            {HELP_FAQ.map((faq, i) => (
              <details key={i} className="group px-5 py-4">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-sm font-medium text-gray-900">
                  {faq.q}
                  <ChevronDownIcon className="h-4 w-4 text-gray-400 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Footer line */}
        <div className="mt-8 text-xs text-gray-400">
          See also{' '}
          <Link to="/privacy" state={{ from: '/help' }} className="hover:text-gray-600 underline">
            Privacy Notice
          </Link>
          {' · '}
          <Link to="/terms" state={{ from: '/help' }} className="hover:text-gray-600 underline">
            Terms of Use
          </Link>
        </div>
      </div>
    </Layout>
  )
}

