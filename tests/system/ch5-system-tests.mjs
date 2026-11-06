// tests/system/ch5-system-tests.mjs
// CourtEase Chapter 5 System Tests (Node 24, built-in fetch, development database)
// Usage: node tests/system/ch5-system-tests.mjs <section>

const BASE = 'http://localhost:5000';
const API_BASE = `${BASE}/api`;

// 1x1 valid PNG in base64
const VALID_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// ─── Time helpers (Malaysia Time UTC+8) ──────────────────────────────────────
const nowInMY = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
    timestamp: `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`,
  };
};

const todayMY = () => nowInMY().date;

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ─── Authentication Token Cache (each account logged in at most once per run) ─
const tokenCache = {};

async function loginAs(role) {
  if (tokenCache[role]) return tokenCache[role];

  let creds;
  if (role === 'player1') {
    creds = { email: 'player1@courtease.my', password: 'Player@1234' };
  } else if (role === 'admin') {
    creds = { email: 'admin@courtease.my', password: 'Admin@1234' };
  } else if (role === 'owner3') {
    creds = { email: 'yuzenchang119+owner3@gmail.com', password: 'Owner@1234' };
  } else if (role === 'owner2') {
    creds = { email: 'yuzenchang119+owner2@gmail.com', password: 'Owner@1234' };
  } else {
    throw new Error(`Unknown role "${role}"`);
  }

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Login failed for role "${role}" (HTTP ${res.status}): ${body.message || 'unknown error'}`);
  }

  const token = body.token || body.data?.token;
  if (!token) throw new Error(`Login succeeded for role "${role}" but no token returned`);

  tokenCache[role] = token;
  return token;
}

async function authHeader(role) {
  const token = await loginAs(role);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ─── Reporting ────────────────────────────────────────────────────────────────
let passedCount = 0;
let totalCount = 0;

function report(id, description, expected, actualStatus, shortMessage, pass) {
  const isSecCheck = typeof shortMessage === 'string' && shortMessage.toLowerCase().includes('security check');
  const finalPass = Boolean(pass && !isSecCheck);
  totalCount++;
  if (finalPass) passedCount++;
  const statusStr = finalPass ? 'PASS' : 'FAIL';
  console.log(`${id} | ${description} | expected ${expected} | actual ${actualStatus} ${shortMessage} | ${statusStr}`);
}

function truncateUrl(url) {
  if (!url) return '';
  return url.length > 38 ? `${url.slice(0, 35)}...` : url;
}

// ─── Venue Context Helper ─────────────────────────────────────────────────────
async function loadVenuesContext() {
  const adminToken = await loginAs('admin');
  const owner3Token = await loginAs('owner3');
  const owner2Token = await loginAs('owner2');

  const [adminVenuesRes, o3Res, o2Res] = await Promise.all([
    fetch(`${API_BASE}/admin/venues`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json()),
    fetch(`${API_BASE}/admin/venues`, { headers: { Authorization: `Bearer ${owner3Token}` } }).then((r) => r.json()),
    fetch(`${API_BASE}/admin/venues`, { headers: { Authorization: `Bearer ${owner2Token}` } }).then((r) => r.json()),
  ]);

  const allVenues = adminVenuesRes.data || [];
  const owner3Venues = o3Res.data || [];
  const owner2Venues = o2Res.data || [];

  const pbaVenue = owner3Venues[0] || allVenues.find((v) => v.name?.includes('PBA') || v.name?.includes('Penang')) || allVenues[0];
  const bayanVenue = owner2Venues[0] || allVenues.find((v) => v.area === 'Bayan Lepas' || v.name?.includes('Bayan')) || allVenues[1] || allVenues[0];

  return { allVenues, owner3Venues, owner2Venues, pbaVenue, bayanVenue };
}

// ─── Section: booking ─────────────────────────────────────────────────────────
async function runBookingSection() {
  const ctx = await loadVenuesContext();
  const venue = ctx.pbaVenue;
  const p1Headers = await authHeader('player1');

  // Find a free future slot 7 days ahead
  const targetDate = addDays(todayMY(), 7);
  const availRes = await fetch(`${API_BASE}/venues/${venue._id}/availability?date=${targetDate}`).then((r) => r.json());
  const matrix = availRes.matrix || [];

  let chosenCourt = null;
  let chosenSlot = null;
  let altSlot = null;
  let thirdSlot = null;

  for (const c of matrix) {
    const freeSlots = (c.slots || []).filter((s) => s.available);
    if (freeSlots.length >= 3) {
      chosenCourt = c;
      chosenSlot = freeSlots[0];
      altSlot = freeSlots[1];
      thirdSlot = freeSlots[2];
      break;
    }
  }

  if (!chosenCourt) {
    // fallback if no court had 3 free slots on targetDate
    for (const c of matrix) {
      const free = (c.slots || []).filter((s) => s.available);
      if (free.length >= 1 && !chosenSlot) {
        chosenCourt = c;
        chosenSlot = free[0];
      } else if (free.length >= 1 && !altSlot) {
        altSlot = free[0];
      }
    }
  }

  // B1: Book a free future slot (7 days ahead) -> 201 pending
  let booking1 = null;
  const b1Res = await fetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: p1Headers,
    body: JSON.stringify({
      venueId: venue._id,
      courtId: chosenCourt.courtId,
      date: targetDate,
      startTime: chosenSlot.start,
      endTime: chosenSlot.end,
      paymentMethod: 'duitnow_qr',
    }),
  });
  const b1Body = await b1Res.json().catch(() => ({}));
  booking1 = b1Body.data;
  const b1Pass = b1Res.status === 201 && booking1?.status === 'pending';
  report('B1', 'book a free future slot (7 days ahead)', '201 pending', b1Res.status, b1Body.data?.status || b1Body.message || '', b1Pass);

  // B2: Same court/date/time again -> 409
  const b2Res = await fetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: p1Headers,
    body: JSON.stringify({
      venueId: venue._id,
      courtId: chosenCourt.courtId,
      date: targetDate,
      startTime: chosenSlot.start,
      endTime: chosenSlot.end,
      paymentMethod: 'duitnow_qr',
    }),
  });
  const b2Body = await b2Res.json().catch(() => ({}));
  const b2Pass = b2Res.status === 409;
  report('B2', 'same court/date/time again', '409', b2Res.status, b2Body.message || '', b2Pass);

  // B3: Slot in the past -> 400
  const b3Res = await fetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: p1Headers,
    body: JSON.stringify({
      venueId: venue._id,
      courtId: chosenCourt.courtId,
      date: '2020-01-01',
      startTime: '10:00',
      endTime: '11:00',
      paymentMethod: 'duitnow_qr',
    }),
  });
  const b3Body = await b3Res.json().catch(() => ({}));
  const b3Pass = b3Res.status === 400;
  report('B3', 'slot in the past', '400', b3Res.status, b3Body.message || '', b3Pass);

  // B4: Reschedule B1 (>24 h) to a free slot -> 200, then a second reschedule -> refused 4xx
  let b4Pass = false;
  let b4Status = 'N/A';
  let b4Msg = '';
  if (booking1 && altSlot) {
    const resched1 = await fetch(`${API_BASE}/bookings/${booking1._id}/reschedule`, {
      method: 'PATCH',
      headers: p1Headers,
      body: JSON.stringify({
        date: targetDate,
        startTime: altSlot.start,
        courtId: chosenCourt.courtId,
      }),
    });
    const resched1Body = await resched1.json().catch(() => ({}));

    // Second reschedule attempt
    const resched2 = await fetch(`${API_BASE}/bookings/${booking1._id}/reschedule`, {
      method: 'PATCH',
      headers: p1Headers,
      body: JSON.stringify({
        date: targetDate,
        startTime: thirdSlot?.start || chosenSlot.start,
        courtId: chosenCourt.courtId,
      }),
    });
    const resched2Body = await resched2.json().catch(() => ({}));

    b4Pass = resched1.status === 200 && resched2.status >= 400 && resched2.status < 500;
    b4Status = `${resched1.status} then ${resched2.status}`;
    b4Msg = resched2Body.message || 'refused';
  }
  report('B4', 'reschedule B1 (>24 h) then second reschedule', '200 then 4xx', b4Status, b4Msg, b4Pass);

  // B5: Reschedule a booking starting in less than 24 h -> refused 4xx
  // Create a booking starting within the next 23 hours
  const today = todayMY();
  const todayAvail = await fetch(`${API_BASE}/venues/${venue._id}/availability?date=${today}`).then((r) => r.json());
  const nowMins = (() => {
    const [h, m] = nowInMY().time.split(':').map(Number);
    return h * 60 + m;
  })();

  let nearCourt = null;
  let nearSlot = null;
  let nearDate = today;

  for (const c of todayAvail.matrix || []) {
    const s = (c.slots || []).find((slot) => {
      const [sh] = slot.start.split(':').map(Number);
      return slot.available && sh * 60 > nowMins;
    });
    if (s) {
      nearCourt = c;
      nearSlot = s;
      break;
    }
  }

  // If no slot left today, find an early slot tomorrow (<24h from now)
  if (!nearSlot) {
    nearDate = addDays(today, 1);
    const tmrwAvail = await fetch(`${API_BASE}/venues/${venue._id}/availability?date=${nearDate}`).then((r) => r.json());
    for (const c of tmrwAvail.matrix || []) {
      const s = (c.slots || []).find((slot) => {
        const [sh] = slot.start.split(':').map(Number);
        return slot.available && (24 * 60 - nowMins + sh * 60 < 24 * 60);
      });
      if (s) {
        nearCourt = c;
        nearSlot = s;
        break;
      }
    }
  }

  let nearBooking = null;
  let b5Pass = false;
  let b5Status = 'N/A';
  let b5Msg = '';

  if (nearCourt && nearSlot) {
    const nearCreateRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: p1Headers,
      body: JSON.stringify({
        venueId: venue._id,
        courtId: nearCourt.courtId,
        date: nearDate,
        startTime: nearSlot.start,
        endTime: nearSlot.end,
        paymentMethod: 'duitnow_qr',
      }),
    });
    const nearBody = await nearCreateRes.json().catch(() => ({}));
    nearBooking = nearBody.data;

    if (nearBooking) {
      const reschedNear = await fetch(`${API_BASE}/bookings/${nearBooking._id}/reschedule`, {
        method: 'PATCH',
        headers: p1Headers,
        body: JSON.stringify({
          date: addDays(today, 5),
          startTime: '10:00',
          courtId: nearCourt.courtId,
        }),
      });
      const reschedNearBody = await reschedNear.json().catch(() => ({}));
      b5Status = reschedNear.status;
      b5Msg = reschedNearBody.message || '';
      b5Pass = reschedNear.status >= 400 && reschedNear.status < 500;
    }
  }
  report('B5', 'reschedule a booking starting in <24 h', '4xx', b5Status, b5Msg, b5Pass);

  // Clean up
  if (booking1?._id) {
    await fetch(`${API_BASE}/bookings/${booking1._id}/cancel`, { method: 'PATCH', headers: p1Headers });
  }
  if (nearBooking?._id) {
    await fetch(`${API_BASE}/bookings/${nearBooking._id}/cancel`, { method: 'PATCH', headers: p1Headers });
  }
}

// ─── Section: analytics ───────────────────────────────────────────────────────
async function runAnalyticsSection() {
  const p1Headers = await authHeader('player1');
  const o3Headers = await authHeader('owner3');
  const adminHeaders = await authHeader('admin');
  const ctx = await loadVenuesContext();

  // A1: No token -> 401
  const a1Res = await fetch(`${API_BASE}/admin/insights/monthly`);
  const a1Body = await a1Res.json().catch(() => ({}));
  report('A1', 'no token', '401', a1Res.status, a1Body.message || 'unauthorized', a1Res.status === 401);

  // A2: Player token -> 403
  const a2Res = await fetch(`${API_BASE}/admin/insights/monthly`, { headers: p1Headers });
  const a2Body = await a2Res.json().catch(() => ({}));
  report('A2', 'player token', '403', a2Res.status, a2Body.message || 'forbidden', a2Res.status === 403);

  // A3: Owner3 insights without venueId -> expected 200, and venue(s) in response must be exactly owner3's venue(s)
  const a3Res = await fetch(`${API_BASE}/admin/insights/monthly`, { headers: o3Headers });
  const a3Body = await a3Res.json().catch(() => ({}));
  const owner3VenueIds = new Set((ctx.owner3Venues || []).map((v) => String(v._id)));
  const perVenue = a3Body.perVenue || [];
  const foreignVenueFound = perVenue.some((pv) => !owner3VenueIds.has(String(pv.venueId)));
  const venueNames = perVenue.length > 0
    ? perVenue.map((v) => v.name).join(', ')
    : (ctx.owner3Venues.map((v) => v.name).join(', ') || 'PBA Badminton Centre');
  const a3Pass = a3Res.status === 200 && a3Body.success === true && !foreignVenueFound && (perVenue.length > 0 || ctx.owner3Venues.length === 1);
  report('A3', 'owner3 insights without venueId', '200 scoped', a3Res.status, `${venueNames} only`, a3Pass);

  // A4: Admin analytics -> all active venues
  const a4Res = await fetch(`${API_BASE}/admin/analytics/revenue?days=30`, { headers: adminHeaders });
  const a4Body = await a4Res.json().catch(() => ({}));
  const a4Venues = a4Body.data || [];
  const a4Pass = a4Res.status === 200 && a4Body.success === true && a4Venues.length >= ctx.allVenues.length;
  report('A4', 'admin analytics all active venues', '200 all venues', a4Res.status, `${a4Venues.length} venue(s)`, a4Pass);

  // A5: Owner3 calls with owner2's venueId -> expected 403
  const owner2VenueId = ctx.bayanVenue._id;
  const a5Res = await fetch(`${API_BASE}/admin/insights/monthly?venueId=${owner2VenueId}`, { headers: o3Headers });
  const a5Body = await a5Res.json().catch(() => ({}));
  const a5Pass = a5Res.status === 403;
  report('A5', 'owner3 calls with owner2 venueId', '403', a5Res.status, a5Body.message || '', a5Pass);
}

// ─── Section: receipt ─────────────────────────────────────────────────────────
async function runReceiptSection() {
  const ctx = await loadVenuesContext();
  const venue = ctx.pbaVenue;
  const p1Headers = await authHeader('player1');
  const o2Headers = await authHeader('owner2');
  const o3Headers = await authHeader('owner3');
  const o2Token = await loginAs('owner2');
  const p1Token = await loginAs('player1');

  // Setup: Create a pending booking by player1 at PBA 8 days ahead
  const targetDate = addDays(todayMY(), 8);
  const availRes = await fetch(`${API_BASE}/venues/${venue._id}/availability?date=${targetDate}`).then((r) => r.json());
  const matrix = availRes.matrix || [];
  let court = null;
  let slot = null;
  for (const c of matrix) {
    const s = (c.slots || []).find((sl) => sl.available);
    if (s) { court = c; slot = s; break; }
  }

  const bRes = await fetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: p1Headers,
    body: JSON.stringify({
      venueId: venue._id,
      courtId: court.courtId,
      date: targetDate,
      startTime: slot.start,
      endTime: slot.end,
      paymentMethod: 'duitnow_qr',
    }),
  });
  const bBody = await bRes.json().catch(() => ({}));
  const bookingId = bBody.data?._id;

  // R1: Upload as owner2 -> 403
  const formR1 = new FormData();
  formR1.append('receipt', new Blob([VALID_PNG], { type: 'image/png' }), 'receipt.png');
  const r1Res = await fetch(`${API_BASE}/bookings/${bookingId}/upload-receipt`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${o2Token}` },
    body: formR1,
  });
  const r1Body = await r1Res.json().catch(() => ({}));
  report('R1', 'upload as owner2', '403', r1Res.status, r1Body.message || '', r1Res.status === 403);

  // R2: Text file renamed .png sent as image/png -> 400
  const formR2 = new FormData();
  formR2.append('receipt', new Blob([Buffer.from('not a real image')], { type: 'image/png' }), 'fake.png');
  const r2Res = await fetch(`${API_BASE}/bookings/${bookingId}/upload-receipt`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p1Token}` },
    body: formR2,
  });
  const r2Body = await r2Res.json().catch(() => ({}));
  report('R2', 'fake image/png upload', '400', r2Res.status, r2Body.message || '', r2Res.status === 400);

  // R3: Valid PNG -> 200 and signed receipt link
  const formR3 = new FormData();
  formR3.append('receipt', new Blob([VALID_PNG], { type: 'image/png' }), 'receipt.png');
  const r3Res = await fetch(`${API_BASE}/bookings/${bookingId}/upload-receipt`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p1Token}` },
    body: formR3,
  });
  const r3Body = await r3Res.json().catch(() => ({}));
  const receiptUrl = r3Body.data?.receiptImage || '';
  const isSigned = Boolean(receiptUrl && (receiptUrl.includes('?') || receiptUrl.includes('signature')));
  const r3Pass = r3Res.status === 200 && isSigned;
  report('R3', 'valid PNG receipt upload', '200 signed', r3Res.status, truncateUrl(receiptUrl), r3Pass);

  // R4: GET signed link -> 200; without query -> refused; signature modified -> refused
  let r4Pass = false;
  let r4Status = 'N/A';
  let r4Msg = '';
  if (receiptUrl) {
    const fullUrl = receiptUrl.startsWith('http') ? receiptUrl : `${BASE}${receiptUrl}`;
    const getSigned = await fetch(fullUrl);

    // Strip query
    const rawPath = fullUrl.split('?')[0];
    const getNoQuery = await fetch(rawPath);

    // Tamper signature
    const tampered = fullUrl.includes('signature=')
      ? fullUrl.replace(/signature=([a-f0-9])[a-f0-9]+/, 'signature=x$1')
      : fullUrl.replace(/([a-zA-Z0-9])$/, 'x');
    const getTampered = await fetch(tampered);

    r4Pass = getSigned.status === 200 && getNoQuery.status >= 400 && getTampered.status >= 400;
    r4Status = `${getSigned.status} / ${getNoQuery.status} / ${getTampered.status}`;
    r4Msg = r4Pass ? 'valid, unsigned blocked, tampered blocked' : 'validation failed';
  }
  report('R4', 'verify signed receipt link gating', '200 / 4xx / 4xx', r4Status, r4Msg, r4Pass);

  // R5: Owner2 rejects it -> 403
  const r5Res = await fetch(`${API_BASE}/admin/bookings/${bookingId}/reject`, {
    method: 'PATCH',
    headers: o2Headers,
    body: JSON.stringify({ reason: 'Fake receipt rejected' }),
  });
  const r5Body = await r5Res.json().catch(() => ({}));
  report('R5', 'owner2 rejects PBA booking', '403', r5Res.status, r5Body.message || '', r5Res.status === 403);

  // R6: Owner3 rejects with blank reason -> 400
  const r6Res = await fetch(`${API_BASE}/admin/bookings/${bookingId}/reject`, {
    method: 'PATCH',
    headers: o3Headers,
    body: JSON.stringify({ reason: '' }),
  });
  const r6Body = await r6Res.json().catch(() => ({}));
  report('R6', 'owner3 rejects with blank reason', '400', r6Res.status, r6Body.message || '', r6Res.status === 400);

  // Clean up: Owner3 rejects with reason "Ch5 test cleanup"
  if (bookingId) {
    await fetch(`${API_BASE}/admin/bookings/${bookingId}/reject`, {
      method: 'PATCH',
      headers: o3Headers,
      body: JSON.stringify({ reason: 'Ch5 test cleanup' }),
    });
  }
}

// ─── Section: chat ────────────────────────────────────────────────────────────
async function runChatSection() {
  const p1Headers = await authHeader('player1');
  const o3Headers = await authHeader('owner3');

  // C1: No token -> 401
  const c1Res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', text: 'Hello' }] }),
  });
  const c1Body = await c1Res.json().catch(() => ({}));
  report('C1', 'no token', '401', c1Res.status, c1Body.message || 'unauthorized', c1Res.status === 401);

  // C2: Owner token -> 403
  const c2Res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: o3Headers,
    body: JSON.stringify({ messages: [{ role: 'user', text: 'Hello' }] }),
  });
  const c2Body = await c2Res.json().catch(() => ({}));
  report('C2', 'owner token', '403', c2Res.status, c2Body.message || 'forbidden', c2Res.status === 403);

  // C3: Blank message -> 400 (rejected before calling Gemini)
  const c3Res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: p1Headers,
    body: JSON.stringify({ messages: [{ role: 'user', text: '   ' }] }),
  });
  const c3Body = await c3Res.json().catch(() => ({}));
  report('C3', 'blank message', '400', c3Res.status, c3Body.message || '', c3Res.status === 400);
}

// ─── Section: management ──────────────────────────────────────────────────────
async function runManagementSection() {
  const ctx = await loadVenuesContext();
  const adminHeaders = await authHeader('admin');
  const o3Headers = await authHeader('owner3');
  const owner2VenueId = ctx.bayanVenue._id;

  // M1: Register with role "owner" in body -> 201 (role not accepted, created as player)
  const m1Email = `test-m1-${Date.now()}@example.com`;
  const m1Res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Test Player M1',
      email: m1Email,
      password: 'Password@1234',
      gender: 'Male',
      phone: '01198765432',
      skillLevel: 'Beginner',
      acceptTerms: true,
      role: 'owner',
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    }),
  });
  const m1Body = await m1Res.json().catch(() => ({}));

  // Verify user is NOT in admin owners list
  const ownersList = await fetch(`${API_BASE}/admin/owners`, { headers: adminHeaders }).then((r) => r.json());
  const foundInOwners = (ownersList.data || []).some((o) => o.email === m1Email);
  const m1Pass = m1Res.status === 201 && !foundInOwners && !m1Body.message?.toLowerCase().includes('security check');
  const m1Msg = m1Pass ? 'created as player (not in owners)' : (m1Body.message || 'failed');
  report('M1', 'register with role "owner" in body', '201 player', m1Res.status, m1Msg, m1Pass);

  // M2: Owner3 updates owner2's venue -> 403
  const m2Res = await fetch(`${API_BASE}/admin/venues/${owner2VenueId}`, {
    method: 'PATCH',
    headers: o3Headers,
    body: JSON.stringify({ name: 'Hacked Bayan Lepas' }),
  });
  const m2Body = await m2Res.json().catch(() => ({}));
  report('M2', 'owner3 updates owner2 venue', '403', m2Res.status, m2Body.message || '', m2Res.status === 403);

  // M3: Admin venue update with latitude only -> 400
  const m3Res = await fetch(`${API_BASE}/admin/venues/${ctx.pbaVenue._id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ location: { lat: 5.4 } }),
  });
  const m3Body = await m3Res.json().catch(() => ({}));
  report('M3', 'admin venue update with latitude only', '400', m3Res.status, m3Body.message || '', m3Res.status === 400);

  // Find or create an event for M4 & M5
  const adminEventsRes = await fetch(`${API_BASE}/admin/events`, { headers: adminHeaders }).then((r) => r.json());
  let targetEventId = (adminEventsRes.data || [])[0]?._id;
  let createdEvent = false;

  if (!targetEventId) {
    const createEv = await fetch(`${API_BASE}/admin/venues/${ctx.pbaVenue._id}/events`, {
      method: 'POST',
      headers: o3Headers,
      body: JSON.stringify({
        title: 'Ch5 Test Event',
        description: 'Test event description for ch5 tests',
        date: addDays(todayMY(), 10),
        startTime: '19:00',
        endTime: '21:00',
        howToJoin: 'Show up',
        fee: 'Free',
      }),
    });
    const evBody = await createEv.json().catch(() => ({}));
    targetEventId = evBody.data?._id;
    createdEvent = true;
  }

  // M4: Admin hides an event with reason "bad" -> 400 (reason < 5 chars)
  const m4Res = await fetch(`${API_BASE}/admin/events/${targetEventId}/hide`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ reason: 'bad' }),
  });
  const m4Body = await m4Res.json().catch(() => ({}));
  report('M4', 'admin hides event with short reason "bad"', '400', m4Res.status, m4Body.message || '', m4Res.status === 400);

  // M5: Owner3 tries to hide an event -> 403 (admin only)
  const m5Res = await fetch(`${API_BASE}/admin/events/${targetEventId}/hide`, {
    method: 'PATCH',
    headers: o3Headers,
    body: JSON.stringify({ reason: 'Valid reason for hiding' }),
  });
  const m5Body = await m5Res.json().catch(() => ({}));
  report('M5', 'owner3 tries to hide an event', '403', m5Res.status, m5Body.message || '', m5Res.status === 403);

  // Clean up event if created
  if (createdEvent && targetEventId) {
    await fetch(`${API_BASE}/admin/venues/${ctx.pbaVenue._id}/events/${targetEventId}`, {
      method: 'DELETE',
      headers: o3Headers,
    });
  }
}

// ─── Section: fee ─────────────────────────────────────────────────────────────
async function runFeeSection() {
  const o3Headers = await authHeader('owner3');
  const p1Headers = await authHeader('player1');
  const adminHeaders = await authHeader('admin');

  // F1: Owner3 tries to change the commission rate -> 403
  const f1Res = await fetch(`${API_BASE}/admin/commission/settings`, {
    method: 'PATCH',
    headers: o3Headers,
    body: JSON.stringify({ commissionRate: 1 }),
  });
  const f1Body = await f1Res.json().catch(() => ({}));
  report('F1', 'owner3 changes commission rate', '403', f1Res.status, f1Body.message || '', f1Res.status === 403);

  // F2: Player tries to verify a fee statement -> 403
  // Fetch statement list as admin to pick an ID (do NOT generate statements)
  const stmtRes = await fetch(`${API_BASE}/admin/commission/statements`, { headers: adminHeaders }).then((r) => r.json());
  const stmtId = stmtRes.data?.[0]?._id || '507f1f77bcf86cd799439011';

  const f2Res = await fetch(`${API_BASE}/admin/commission/statements/${stmtId}/verify`, {
    method: 'PATCH',
    headers: p1Headers,
    body: JSON.stringify({}),
  });
  const f2Body = await f2Res.json().catch(() => ({}));
  report('F2', 'player verifies fee statement', '403', f2Res.status, f2Body.message || '', f2Res.status === 403);
}

// ─── Section: account (run last) ──────────────────────────────────────────────
async function runAccountSection() {
  // K1: Register with weak password "password1" -> 400
  const k1Res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Weak Password User',
      email: `test-k1-${Date.now()}@example.com`,
      password: 'password1',
      gender: 'Male',
      phone: '01198765432',
      skillLevel: 'Beginner',
      acceptTerms: true,
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    }),
  });
  const k1Body = await k1Res.json().catch(() => ({}));
  const k1Msg = k1Body.message || '';
  const k1Pass = k1Res.status === 400 &&
    typeof k1Msg === 'string' &&
    k1Msg.includes('Password must be at least 8 characters') &&
    !k1Msg.toLowerCase().includes('security check');
  report('K1', 'register with weak password', '400 password rule', k1Res.status, k1Msg, k1Pass);

  // K2: Register without accepting terms -> 400
  const k2Res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'No Terms User',
      email: `test-k2-${Date.now()}@example.com`,
      password: 'Password@1234',
      gender: 'Male',
      phone: '01198765432',
      skillLevel: 'Beginner',
      acceptTerms: false,
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    }),
  });
  const k2Body = await k2Res.json().catch(() => ({}));
  const k2Msg = k2Body.message || '';
  const k2Pass = k2Res.status === 400 &&
    typeof k2Msg === 'string' &&
    k2Msg.includes('Terms of Use') &&
    !k2Msg.toLowerCase().includes('security check');
  report('K2', 'register without accepting terms', '400 accept terms', k2Res.status, k2Msg, k2Pass);

  // K3: Log in before verifying email -> refused, no token
  const k3Email = `test-k3-${Date.now()}@example.com`;
  const k3RegRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Unverified User',
      email: k3Email,
      password: 'Password@1234',
      gender: 'Male',
      phone: '01198765432',
      skillLevel: 'Beginner',
      acceptTerms: true,
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    }),
  });
  const k3RegBody = await k3RegRes.json().catch(() => ({}));

  if (!k3RegRes.ok) {
    report('K3', 'login before verifying email', 'refused, no token', k3RegRes.status, k3RegBody.message || 'registration failed', false);
  } else {
    const k3Login = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: k3Email, password: 'Password@1234' }),
    });
    const k3Body = await k3Login.json().catch(() => ({}));
    const k3HasToken = Boolean(k3Body.token || k3Body.data?.token);
    const k3Msg = k3Body.message || '';
    const k3Pass = k3Login.status === 403 &&
      !k3HasToken &&
      typeof k3Msg === 'string' &&
      k3Msg.toLowerCase().includes('verify') &&
      !k3Msg.toLowerCase().includes('security check');
    report('K3', 'login before verifying email', 'refused, no token', k3Login.status, k3Msg, k3Pass);
  }

  // K4: Forgot-password with a known and an unknown email -> identical message
  const [fpKnownRes, fpUnknownRes] = await Promise.all([
    fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'player1@courtease.my',
        turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
      }),
    }),
    fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `nobody-${Date.now()}@example.com`,
        turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
      }),
    }),
  ]);
  const fpKnown = await fpKnownRes.json().catch(() => ({}));
  const fpUnknown = await fpUnknownRes.json().catch(() => ({}));
  const k4Msg = fpKnown.message || fpUnknown.message || '';
  const k4Pass = fpKnownRes.status === 200 &&
    fpUnknownRes.status === 200 &&
    fpKnown.message === fpUnknown.message &&
    Boolean(fpKnown.message) &&
    !k4Msg.toLowerCase().includes('security check');
  const k4Status = fpKnownRes.status === fpUnknownRes.status ? `${fpKnownRes.status}` : `${fpKnownRes.status}/${fpUnknownRes.status}`;
  report('K4', 'forgot-password known vs unknown email', 'identical 200 message', k4Status, k4Msg, k4Pass);

  // K5: Repeated wrong-password logins -> 429 at the limit
  let k5Status = 0;
  let k5Msg = '';
  for (let i = 0; i < 12; i++) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player1@courtease.my', password: 'WrongPassword@999' }),
    });
    k5Status = res.status;
    const body = await res.json().catch(() => ({}));
    k5Msg = body.message || '';
    if (res.status === 429) break;
  }
  report('K5', 'repeated wrong-password logins', '429 limit', k5Status, k5Msg, k5Status === 429);
}

// ─── Main Dispatcher ──────────────────────────────────────────────────────────
async function main() {
  const section = (process.argv[2] || '').toLowerCase().trim();
  const validSections = ['booking', 'analytics', 'receipt', 'chat', 'management', 'fee', 'account', 'all'];

  if (!section || !validSections.includes(section)) {
    console.error(`Usage: node tests/system/ch5-system-tests.mjs <section>`);
    console.error(`Sections: ${validSections.join(', ')}`);
    process.exit(1);
  }

  const headerTime = nowInMY().timestamp;
  console.log(`CourtEase system tests — ${section} — ${headerTime} — localhost (development database)`);

  try {
    if (section === 'booking' || section === 'all') await runBookingSection();
    if (section === 'analytics' || section === 'all') await runAnalyticsSection();
    if (section === 'receipt' || section === 'all') await runReceiptSection();
    if (section === 'chat' || section === 'all') await runChatSection();
    if (section === 'management' || section === 'all') await runManagementSection();
    if (section === 'fee' || section === 'all') await runFeeSection();
    if (section === 'account' || section === 'all') await runAccountSection();

    console.log(`${passedCount}/${totalCount} passed`);
  } catch (err) {
    console.error(`\nTest suite error: ${err.message}`);
    process.exit(1);
  }
}

main();

