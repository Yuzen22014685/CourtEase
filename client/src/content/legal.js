// Privacy Notice and Terms of Use content (rendered by the /privacy and /terms pages).
// LEGAL_VERSION must match LEGAL_VERSION in config/legal.js on the backend.
// When the text changes materially: update LEGAL_VERSION and LEGAL_EFFECTIVE in both places.

export const LEGAL_VERSION = '2026-11-02'
export const LEGAL_EFFECTIVE = '2 November 2026'
export const SUPPORT_EMAIL = 'courtease.support@gmail.com'

export const PRIVACY = {
    title: 'Privacy Notice',
    intro: [
        'This notice explains what personal data CourtEase collects, why we use it, who we share it with and the choices you have. It is written to meet the Personal Data Protection Act 2010 (PDPA) of Malaysia.',
        'CourtEase is a badminton court booking platform for venues in Penang, developed as a final-year project at INTI International College Penang in collaboration with Coventry University.',
    ],
    sections: [
        {
            heading: '1. Personal data we collect',
            bullets: [
                'Account details: full name, email address and password. Your password is stored only as a one-way hash, so nobody (including CourtEase) can read it.',
                'Player details: gender, skill level and (optionally) your phone number.',
                'Booking details: venue, date, time, courts, add-on items and notes, amounts, payment method, payment reference and the payment receipt image you upload.',
                'Reviews: the rating and comment you leave for a completed booking.',
                'Notifications about your bookings.',
                'Venue owners: venue details including the bank account name, account number and DuitNow QR code shown to players for payment, and commission statements and payment slips.',
                'Technical data: your IP address is processed for security checks and rate limiting; a login token is kept in your browser.',
                'Chat assistant: the messages you type to the assistant.',
            ],
            paragraphs: [
                'Location: the "Near me" feature uses your device location only inside your browser to sort venues by distance. It is never sent to our servers or stored.',
            ],
        },
        {
            heading: '2. Required and optional data',
            paragraphs: [
                'Your name, email address, password and gender are required to create a player account; without them we cannot provide the service. Your phone number is optional. Uploading a payment receipt is needed for a venue to confirm a booking.',
            ],
        },
        {
            heading: '3. Why we use your data',
            bullets: [
                'To create and manage your account and verify your email address.',
                'To process your bookings and let the venue confirm your payment.',
                'To send service emails: email verification, password reset and security notices; booking emails (a summary with payment instructions, payment confirmed or not confirmed, cancellations, changes, expiry and a reminder about 1 hour before your session); and, for venue owners, notices about event moderation and platform fee changes. We do not send marketing emails.',
                'To show reviews that help other players choose a venue.',
                'To prevent fraud and abuse (bot checks, rate limits, receipt checks).',
                'To administer platform commission with venue owners.',
                'To keep the service working, fix problems and improve it.',
            ],
        },
        {
            heading: '4. Who we share your data with',
            bullets: [
                'The venue you book: your name, email address, phone number, booking details and payment receipt, so the venue can manage your booking and verify payment. Venues are independent businesses.',
                'Other users: reviews show only your first name and last initial. Your email address and phone number are never shown publicly.',
                'CourtEase platform administrators, for support, moderation and payment disputes.',
                'Service providers that run CourtEase on our behalf: MongoDB Atlas (database), Render and Vercel (hosting), Cloudinary (image storage, including private receipts), Brevo (email delivery), Cloudflare Turnstile (bot protection, processes your IP address), Google Gemini (chat assistant) and Google Fonts (fonts loaded by your browser).',
                'Authorities, where the law requires it.',
            ],
            paragraphs: ['We do not sell your personal data and we do not use it for advertising.'],
        },
        {
            heading: '5. The chat assistant',
            paragraphs: [
                'Your chat messages (and up to the last six messages of the conversation) are sent to Google Gemini together with public venue information, so it can answer. We do not send your name, email address, account or booking details. CourtEase does not store your chat messages; the conversation disappears when you reload the page.',
                'Google may use content sent to its free service to improve its products. Please do not type personal or payment information into the chat.',
            ],
        },
        {
            heading: '6. Processing outside Malaysia',
            paragraphs: [
                'Some of our service providers store or process data outside Malaysia (for example in Singapore, the United States or the European Union). We only send them what is needed for their service and use established providers with security measures in place.',
            ],
        },
        {
            heading: '7. How we protect your data',
            bullets: [
                'All connections use HTTPS.',
                'Passwords are hashed; email verification and password reset links are single-use and expire.',
                'Payment receipts are private files. Only you, the venue and administrators can open them, through links that expire within a few hours.',
                'Bot protection and rate limits protect sign-up, login and password reset.',
                'Changing your password signs you out on all other devices.',
            ],
            paragraphs: ['No system is completely secure, but we work to protect your data and will act promptly on any issue.'],
        },
        {
            heading: '8. How long we keep your data',
            paragraphs: [
                'We keep your account and booking records while your account is active and for as long as they are needed for booking, payment and dispute records. Email verification links expire after 24 hours and password reset links after 30 minutes.',
                `You can ask us to delete your account by emailing ${SUPPORT_EMAIL}. We will delete or anonymise your personal data, except records we must keep (for example completed bookings with payments).`,
            ],
        },
        {
            heading: '9. Your rights',
            bullets: [
                'Access: ask for a copy of the personal data we hold about you.',
                'Correction: update your details on the My Profile page, or ask us to correct anything else.',
                'Withdraw consent or limit processing: you can ask us to stop processing your data; this may mean we can no longer provide the service to you.',
                'Complaints: you can contact the Personal Data Protection Commissioner of Malaysia (JPDP).',
            ],
            paragraphs: [`Send requests to ${SUPPORT_EMAIL}. We aim to respond within 21 days.`],
        },
        {
            heading: '10. Browser storage and cookies',
            paragraphs: [
                'CourtEase keeps your login token and a copy of your basic profile in your browser\'s local storage so you stay signed in. We do not use advertising or tracking cookies. The Cloudflare security check may use its own essential cookies.',
            ],
        },
        {
            heading: '11. Children',
            paragraphs: ['CourtEase is intended for users aged 18 and over. Users under 18 should use it with the consent of a parent or guardian.'],
        },
        {
            heading: '12. Changes to this notice',
            paragraphs: ['If we change this notice in a significant way, we will update the version date and ask you to review it.'],
        },
        {
            heading: '13. Contact',
            paragraphs: [`Questions or requests about your personal data: ${SUPPORT_EMAIL}.`],
        },
    ],
}

export const TERMS = {
    title: 'Terms of Use',
    intro: [
        'These terms apply to your use of CourtEase. By creating an account you agree to them and to our Privacy Notice.',
        'CourtEase is a badminton court booking platform for venues in Penang, developed as a final-year project at INTI International College Penang in collaboration with Coventry University.',
    ],
    sections: [
        {
            heading: '1. Your account',
            bullets: [
                'Give accurate details and keep them up to date.',
                'Keep your password secret. You are responsible for activity on your account.',
                'One account per person. Do not create accounts for others or impersonate anyone.',
                'We may suspend accounts that break these terms.',
            ],
        },
        {
            heading: '2. Bookings and payments',
            bullets: [
                'Venues are independent businesses. They set their prices, opening hours and rules; CourtEase shows them and takes booking requests.',
                'You pay the venue directly (for example by bank transfer or DuitNow). CourtEase does not hold your money.',
                'Upload a genuine receipt for your payment. The venue checks it and confirms or rejects the booking.',
                'Uploading a false or edited receipt may lead to the booking being cancelled and your account being suspended.',
            ],
        },
        {
            heading: '3. Cancellations, rescheduling and refunds',
            paragraphs: [
                'Cancellation and rescheduling follow the rules shown in the app when you book. Refunds, where applicable, are handled by the venue directly; contact the venue about any refund.',
            ],
        },
        {
            heading: '4. Reviews',
            bullets: [
                'Reviews must be honest and about your own completed booking.',
                'Do not post offensive content, personal information about others or advertising.',
                'Administrators may hide reviews that break these rules.',
            ],
        },
        {
            heading: '5. Acceptable use',
            bullets: [
                'Do not make false bookings or block courts you do not intend to use.',
                'Do not use bots or automated tools, scrape data, or try to bypass security checks.',
                'Do not attempt to access other users\' data or interfere with the service.',
            ],
        },
        {
            heading: '6. Venue owners',
            bullets: [
                'Keep venue details, prices, hours and payment information accurate.',
                'Honour confirmed bookings and verify receipts fairly and promptly.',
                'Use players\' personal data only to manage their bookings, and protect it.',
                'Pay platform commission according to your monthly statements.',
            ],
        },
        {
            heading: '7. The chat assistant',
            paragraphs: [
                'The assistant gives general information and live availability to help you choose. It can make mistakes; the booking page is always the final source for prices and availability.',
            ],
        },
        {
            heading: '8. Availability of the service',
            paragraphs: [
                'CourtEase is provided "as is". As an academic project it may be interrupted, changed or taken offline; the first page load may take a moment while the server starts.',
            ],
        },
        {
            heading: '9. Liability',
            paragraphs: [
                'Court services are provided by the venues, which are responsible for their facilities and safety. To the extent permitted by law, CourtEase is not liable for losses arising from a venue\'s services or from interruptions of the platform. Nothing in these terms limits your rights under Malaysian consumer protection law.',
            ],
        },
        {
            heading: '10. Changes and termination',
            paragraphs: [
                'We may update these terms; the version date will change and significant changes will be shown to you. You may stop using CourtEase at any time and ask us to delete your account.',
            ],
        },
        {
            heading: '11. Governing law',
            paragraphs: ['These terms are governed by the laws of Malaysia.'],
        },
        {
            heading: '12. Contact',
            paragraphs: [`Questions about these terms: ${SUPPORT_EMAIL}.`],
        },
    ],
}