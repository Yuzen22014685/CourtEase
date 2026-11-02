// Transactional email templates (booking lifecycle + owner notices).
// Every template returns { subject, html, text }.
// All content passed in is PLAIN TEXT: render() escapes it, so user input
// (reject reasons, event titles, item notes) can never inject HTML into an email.
// Dates and times are the booking's own Malaysia-time strings ("YYYY-MM-DD", "HH:MM").

const BRAND = '#16a34a';
const SUPPORT_EMAIL = 'courtease.support@gmail.com';

const TONES = {
  info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1e3a8a' },
  success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
  warn:    { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
  danger:  { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const escLines = (v) => esc(v).replace(/\r?\n/g, '<br/>');
const oneLine = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim();

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-11-20" -> "Fri, 20 Nov 2026"
const fmtDate = (ymd) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return String(ymd || '');
  const d = new Date(`${ymd}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// "19:00" -> "7:00 PM"
const fmtTime = (hm) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hm || '');
  if (!m) return String(hm || '');
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};
const fmtRange = (start, end) => `${fmtTime(start)} – ${fmtTime(end)}`;
const money = (n) => `RM ${(Number(n) || 0).toFixed(2)}`;
const clientUrl = (path = '') =>
  `${(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '')}${path}`;
const mapsUrl = (address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`;

// ---------------------------------------------------------------------------
// Renderer: one layout for every email, HTML and plain-text versions together
// content = { subject, heading, name, intro[], callout{tone,text}, sections[{title, rows[[label,value]], list[]}], cta{label,url}, outro[] }
// ---------------------------------------------------------------------------
const render = ({ subject, heading, name, intro = [], callout, sections = [], cta, outro = [] }) => {
  const P = 'margin:0 0 14px;color:#374151;font-size:15px;line-height:23px;';
  const h = [];
  const t = [];

  t.push(heading, '');
  if (name) {
    h.push(`<p style="${P}">Hello <strong>${esc(name)}</strong>,</p>`);
    t.push(`Hello ${name},`, '');
  }
  for (const para of intro) {
    h.push(`<p style="${P}">${escLines(para)}</p>`);
    t.push(para, '');
  }
  if (callout && callout.text) {
    const c = TONES[callout.tone] || TONES.info;
    h.push(
      `<div style="margin:0 0 18px;padding:12px 14px;background:${c.bg};border:1px solid ${c.border};border-radius:8px;color:${c.color};font-size:14px;line-height:21px;">${escLines(callout.text)}</div>`
    );
    t.push(callout.text, '');
  }
  for (const s of sections) {
    if (s.title) {
      h.push(`<p style="margin:18px 0 8px;color:#111827;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">${esc(s.title)}</p>`);
      t.push(s.title.toUpperCase());
    }
    if (s.rows && s.rows.length) {
      const rows = s.rows
        .filter((r) => r && r[1] !== undefined && r[1] !== null && String(r[1]) !== '')
        .map(
          ([label, value]) =>
            `<tr><td style="padding:6px 10px 6px 0;color:#6b7280;font-size:14px;vertical-align:top;white-space:nowrap;">${esc(label)}</td>` +
            `<td style="padding:6px 0;color:#111827;font-size:14px;vertical-align:top;">${escLines(value)}</td></tr>`
        );
      h.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid #f3f4f6;">${rows.join('')}</table>`);
      for (const r of s.rows) {
        if (r && r[1] !== undefined && r[1] !== null && String(r[1]) !== '') t.push(`  ${r[0]}: ${String(r[1]).replace(/\n/g, ' / ')}`);
      }
    }
    if (s.list && s.list.length) {
      h.push(`<ul style="margin:0 0 8px;padding-left:20px;color:#111827;font-size:14px;line-height:22px;">${s.list.map((li) => `<li>${escLines(li)}</li>`).join('')}</ul>`);
      for (const li of s.list) t.push(`  - ${li}`);
    }
    t.push('');
  }
  if (cta && cta.url) {
    h.push(
      `<div style="text-align:center;margin:26px 0 22px;"><a href="${esc(cta.url)}" style="background:${BRAND};color:#ffffff;padding:12px 26px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">${esc(cta.label)}</a></div>`
    );
    t.push(`${cta.label}: ${cta.url}`, '');
  }
  for (const para of outro) {
    h.push(`<p style="${P}">${escLines(para)}</p>`);
    t.push(para, '');
  }

  const footer = `This is a service email about your CourtEase account. CourtEase does not send marketing emails. Questions? ${SUPPORT_EMAIL}`;
  t.push('--', footer);

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="background:${BRAND};padding:16px 24px;color:#ffffff;font-size:20px;font-weight:700;">CourtEase</td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 16px;color:#111827;font-size:21px;line-height:28px;">${esc(heading)}</h1>
${h.join('\n')}
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:18px;">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;

  return { subject: oneLine(subject), html, text: t.join('\n') };
};

// Shared "session" rows
const sessionRows = (venue, s) => [
  ['Venue', venue.name],
  ['Address', venue.address],
  ['Date', fmtDate(s.date)],
  ['Time', fmtRange(s.startTime, s.endTime)],
  ['Court', s.courtNumber != null ? `Court ${s.courtNumber}` : ''],
  ['Reference', s.paymentRef],
];

// ---------------------------------------------------------------------------
// Player templates
// ---------------------------------------------------------------------------

// One email per checkout (order = all sessions sharing one CE- reference)
const orderSummary = ({ playerName, venue, sessions, items = [], courtTotal, itemsTotal, total, paymentRef, paymentMethod, bank, hasQr }) => {
  const many = sessions.length > 1;
  const paymentRows = [
    ['Reference', paymentRef],
    ['Courts', money(courtTotal)],
    ['Add-ons', itemsTotal > 0 ? money(itemsTotal) : ''],
    ['Total to pay', money(total)],
    ['Method', paymentMethod === 'bank_transfer' ? 'Bank transfer' : 'DuitNow QR'],
  ];
  if (paymentMethod === 'bank_transfer' && bank) {
    paymentRows.push(['Bank', bank.bankName], ['Account name', bank.accountName], ['Account number', bank.accountNumber]);
  }
  const sections = [
    {
      title: many ? `Your ${sessions.length} sessions` : 'Your session',
      rows: sessions.map((s) => [`${fmtDate(s.date)}, ${fmtRange(s.startTime, s.endTime)}`, `Court ${s.courtNumber ?? '-'} · ${money(s.amount)}`]),
    },
  ];
  if (items.length) {
    sections.push({
      title: 'Add-ons',
      rows: items.map((it) => [`${it.name} × ${it.quantity}`, `${money(it.unitPrice * it.quantity)}${it.note ? `\nNote: ${it.note}` : ''}`]),
    });
  }
  sections.push({ title: 'Payment', rows: paymentRows });
  sections.push({ title: 'Venue', rows: [['Name', venue.name], ['Address', venue.address], ['Phone', venue.phone]] });

  return render({
    subject: `Booking received ${paymentRef} – ${venue.name}`,
    heading: 'Booking received – please pay the venue',
    name: playerName,
    intro: [`Thanks for booking with CourtEase. Your court${many ? 's are' : ' is'} reserved at ${venue.name} and waiting for payment.`],
    callout: {
      tone: 'warn',
      text:
        `Pay the venue directly${paymentMethod === 'duitnow_qr' && hasQr ? " by scanning the venue's DuitNow QR shown in CourtEase (My Bookings)" : ''}, ` +
        `put ${paymentRef} in the transfer note, then upload your receipt in CourtEase. ` +
        'If no receipt is uploaded before your session starts, the booking expires.',
    },
    sections,
    cta: { label: 'Upload my receipt', url: clientUrl('/my-bookings') },
    outro: ['The venue checks your receipt and confirms the booking. We will email you when it is confirmed.'],
  });
};

const bookingConfirmed = ({ playerName, venue, session, auto }) =>
  render({
    subject: `Booking confirmed – ${venue.name}, ${fmtDate(session.date)}`,
    heading: 'Your booking is confirmed',
    name: playerName,
    callout: {
      tone: 'success',
      text: auto
        ? 'Your booking has been confirmed. Your receipt was on record when the session started.'
        : `${venue.name} has verified your payment.`,
    },
    sections: [{ title: 'Session', rows: sessionRows(venue, session) }],
    cta: { label: 'Open in Google Maps', url: mapsUrl(`${venue.name} ${venue.address || ''}`) },
    outro: ['See you on court! Please arrive a few minutes early.'],
  });

const bookingRejected = ({ playerName, venue, session, reason }) =>
  render({
    subject: `Booking not confirmed – ${venue.name}, ${fmtDate(session.date)}`,
    heading: 'Your booking was not confirmed',
    name: playerName,
    callout: { tone: 'danger', text: `The venue could not verify your payment.\nReason: ${reason || 'not given'}` },
    sections: [{ title: 'Session', rows: sessionRows(venue, session) }],
    cta: { label: 'Book again', url: clientUrl(venue._id ? `/venues/${venue._id}` : '/venues') },
    outro: [
      `If you think this is a mistake, contact the venue${venue.phone ? ` (${venue.phone})` : ''} with your payment reference. The court has been released for other players.`,
    ],
  });

const bookingCancelled = ({ playerName, venue, session, byAdmin }) =>
  render({
    subject: `Booking cancelled – ${venue.name}, ${fmtDate(session.date)}`,
    heading: 'Your booking was cancelled',
    name: playerName,
    callout: {
      tone: 'info',
      text:
        (byAdmin ? 'A CourtEase administrator cancelled this booking. ' : 'You cancelled this booking. ') +
        'CourtEase does not handle refunds: if you already paid, any refund is decided by the venue, so contact them with your payment reference.',
    },
    sections: [{ title: 'Cancelled session', rows: sessionRows(venue, session) }],
    cta: { label: 'Find another court', url: clientUrl('/venues') },
  });

const bookingRescheduled = ({ playerName, venue, session, from }) =>
  render({
    subject: `Booking rescheduled – ${venue.name}, ${fmtDate(session.date)}`,
    heading: 'Your booking was rescheduled',
    name: playerName,
    sections: [
      { title: 'New time', rows: sessionRows(venue, session) },
      from
        ? {
            title: 'Previous time',
            rows: [
              ['Date', fmtDate(from.date)],
              ['Time', fmtRange(from.startTime, from.endTime)],
              ['Court', from.courtNumber != null ? `Court ${from.courtNumber}` : ''],
            ],
          }
        : null,
    ].filter(Boolean),
    cta: { label: 'View my bookings', url: clientUrl('/my-bookings') },
    outro: ['A booking can be rescheduled once, so this new time is final.'],
  });

const sessionReminder = ({ playerName, venue, session }) =>
  render({
    subject: `Starts in about 1 hour: ${fmtTime(session.startTime)} at ${venue.name}`,
    heading: 'Your session starts in about 1 hour',
    name: playerName,
    sections: [{ title: 'Session', rows: [...sessionRows(venue, session), ['Venue phone', venue.phone]] }],
    cta: { label: 'Open in Google Maps', url: mapsUrl(`${venue.name} ${venue.address || ''}`) },
    outro: ['Have a great game!'],
  });

const bookingExpired = ({ playerName, venue, session }) =>
  render({
    subject: `Booking expired – ${venue.name}, ${fmtDate(session.date)}`,
    heading: 'Your booking expired',
    name: playerName,
    callout: {
      tone: 'warn',
      text: 'No payment receipt was uploaded before the session started, so the booking expired and the court was released.',
    },
    sections: [{ title: 'Session', rows: sessionRows(venue, session) }],
    cta: { label: 'Book again', url: clientUrl(venue._id ? `/venues/${venue._id}` : '/venues') },
  });

// ---------------------------------------------------------------------------
// Owner templates
// ---------------------------------------------------------------------------
const eventHidden = ({ ownerName, venueName, event, reason }) =>
  render({
    subject: `Your event was hidden – ${event.title}`,
    heading: 'One of your events was hidden',
    name: ownerName,
    intro: [`A CourtEase administrator hid an event at ${venueName}. Players can no longer see it.`],
    callout: { tone: 'danger', text: `Reason: ${reason}` },
    sections: [
      {
        title: 'Event',
        rows: [
          ['Title', event.title],
          ['Date', fmtDate(event.date)],
          ['Time', fmtRange(event.startTime, event.endTime)],
        ],
      },
    ],
    cta: { label: 'Open my events', url: clientUrl('/owner/events') },
    outro: [
      'Edit the event to fix the issue: your changes are sent to an admin for review, and the admin can make it visible again. You can also remove it.',
    ],
  });

const scopeText = (includeAddOns) => (includeAddOns ? 'court and add-on revenue' : 'court revenue');

const commissionChanged = ({ ownerName, before, after }) =>
  render({
    subject: 'CourtEase platform fee update',
    heading: 'Your platform fee rule has changed',
    name: ownerName,
    sections: [
      {
        title: 'Platform fee',
        rows: [
          ['Previous', `${before.rate}% of confirmed ${scopeText(before.includeAddOns)}`],
          ['New', `${after.rate}% of confirmed ${scopeText(after.includeAddOns)}`],
        ],
      },
    ],
    callout: {
      tone: 'info',
      text: 'The new rule applies to monthly statements generated from now on. Statements already issued keep the rule they were generated with.',
    },
    cta: { label: 'View platform fee', url: clientUrl('/owner/insights') },
    outro: [`Questions about this change? Contact ${SUPPORT_EMAIL}.`],
  });

module.exports = {
  orderSummary,
  bookingConfirmed,
  bookingRejected,
  bookingCancelled,
  bookingRescheduled,
  sessionReminder,
  bookingExpired,
  eventHidden,
  commissionChanged,
  // exported for tests
  _helpers: { esc, fmtDate, fmtTime, money, render },
};
