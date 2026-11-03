import { SUPPORT_EMAIL } from './legal'

export const HELP_CONTACTS = [
  {
    key: 'venue',
    title: 'The venue',
    when: 'Courts, payments and refunds',
    points: [
      'Paying for a booking, receipts and payment questions',
      'Refunds (CourtEase does not hold money, so the venue decides)',
      'Problems at the venue: courts, lights, facilities, add-ons, lost items',
    ],
    how: 'Open “Need help with this booking?” on your booking in My Bookings to call the venue (shown when the venue has listed a phone number).',
  },
  {
    key: 'support',
    title: 'CourtEase support',
    when: 'Your account and the app',
    points: [
      'Login, password and account problems',
      'Something in the app not working, or a booking that looks wrong',
      'Reporting a venue, a review or a misleading event',
      'Privacy requests (a copy or deletion of your data)',
    ],
    how: `Email ${SUPPORT_EMAIL}, or use “Report a problem” on a booking. It fills in your booking reference for you.`,
  },
  {
    key: 'assistant',
    title: 'Chat assistant',
    when: 'Quick questions, any time',
    points: [
      'Prices, opening hours, facilities and shop add-ons',
      'Free courts on a given day',
      'How booking, payment, cancelling and rescheduling work',
    ],
    how: 'Signed-in players: tap the chat button at the bottom-right. It cannot see or change your bookings, and answers may contain mistakes.',
  },
]

export const HELP_FAQ = [
  {
    q: 'How do I pay for a booking?',
    a: 'You pay the venue directly by DuitNow QR or bank transfer, then upload your payment receipt in My Bookings. CourtEase does not process or hold payments. The venue checks your receipt and confirms the booking.',
  },
  {
    q: 'What if I don’t upload a receipt?',
    a: 'The booking stays pending. If there is still no receipt when the session starts, it expires automatically and the court is released.',
  },
  {
    q: 'The venue asked me for a new receipt. What now?',
    a: 'Open My Bookings and tap “Upload new receipt”. Upload it before the session starts, otherwise the booking expires.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Bookings are non-refundable. If you think a refund is due, contact the venue with your booking reference. Refunds are decided and paid by the venue.',
  },
  {
    q: 'Can I reschedule?',
    a: 'Yes, once per booking, up to 24 hours before the session starts (same venue, same duration). In My Bookings, tap Cancel and choose Reschedule.',
  },
  {
    q: 'Can I cancel?',
    a: 'You can cancel any time before the session starts, but the booking fee is not refunded.',
  },
  {
    q: 'What happens to my add-ons if I cancel?',
    a: 'Add-ons belong to the order. If you cancel the session they’re listed under, they move to your next session in the same order. They’re only forfeited if every session in the order is cancelled, and they aren’t refunded.',
  },
  {
    q: 'Where is my booking reference?',
    a: 'On each booking in My Bookings, next to “Ref”. It starts with CE-. Quote it whenever you contact the venue or CourtEase support.',
  },
  {
    q: 'How do I delete my account?',
    a: `Email ${SUPPORT_EMAIL}. We delete or anonymise your personal data, except records we must keep, such as completed bookings with payments.`,
  },
]

