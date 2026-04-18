/**
 * api.js — Amadeus API Integration
 * Hassni Ticket Company
 *
 * HOW TO USE:
 * 1. Get free API keys from https://developers.amadeus.com
 * 2. Set up n8n webhook (see n8n-workflow.json)
 * 3. Replace N8N_WEBHOOK_URL below with your actual n8n webhook URL
 * 4. In index.html, add <script src="js/api.js"></script> AFTER app.js
 * 5. The doSearch() function in app.js will automatically use this
 *
 * ⚠️ NEVER put your Amadeus API key directly in frontend code.
 *    Always call through your n8n backend which keeps keys secret.
 */

/* ── CONFIG ── */
const N8N_WEBHOOK_URL = 'https://YOUR-N8N-URL/webhook/flight-search';

/* ── OVERRIDE doSearch to use real Amadeus data ── */
async function searchLiveFlights(origin, destination, date, adults, baggage) {
  const loadingEl = showLoading();
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin:      origin,       // e.g. "LHE"
        destination: destination,  // e.g. "DXB"
        date:        date,         // e.g. "2025-05-15"
        adults:      adults,       // e.g. 1
        baggage:     baggage,      // e.g. "any" | "checked" | "hand"
        currencyCode:'PKR',
        max:         20
      })
    });

    if (!response.ok) throw new Error('API error: ' + response.status);

    const data = await response.json();
    removeLoading(loadingEl);
    return parseAmadeusResponse(data);

  } catch (err) {
    removeLoading(loadingEl);
    console.error('Flight search error:', err);
    showError('Could not fetch live flights. Showing sample data instead.');
    return null;
  }
}

/* ── PARSE Amadeus API Response ── */
function parseAmadeusResponse(data) {
  if (!data || !Array.isArray(data)) return [];

  return data.map(offer => {
    const itinerary = offer.itineraries[0];
    const segments  = itinerary.segments;
    const firstSeg  = segments[0];
    const lastSeg   = segments[segments.length - 1];

    // Baggage
    const baggageInfo = offer.travelerPricings?.[0]
      ?.fareDetailsBySegment?.[0]
      ?.includedCheckedBags;
    const checkedKg  = baggageInfo?.weight   || 0;
    const checkedPcs = baggageInfo?.quantity || 0;
    const bagText    = checkedKg
      ? checkedKg + 'kg checked + 7kg carry-on'
      : checkedPcs
        ? checkedPcs + ' piece(s) + 7kg carry-on'
        : 'Hand carry only';

    // Duration — convert PT3H15M → "3h 15m"
    const dur = itinerary.duration
      .replace('PT','')
      .replace('H','h ')
      .replace('M','m')
      .trim();

    // Price in PKR
    const pkr = Math.round(parseFloat(offer.price.total));
    const usd = Math.round(pkr / 279); // approx conversion

    // Format times
    const depTime = firstSeg.departure.at.split('T')[1].substring(0,5);
    const arrTime = lastSeg.arrival.at.split('T')[1].substring(0,5);
    const depDate = firstSeg.departure.at.split('T')[0];
    const arrDate = lastSeg.arrival.at.split('T')[0];
    const nextDay = depDate !== arrDate;

    return {
      airline: getAirlineName(firstSeg.carrierCode),
      code:    firstSeg.carrierCode + ' ' + firstSeg.number,
      dep:     depTime,
      arr:     arrTime + (nextDay ? '+1' : ''),
      dur:     dur,
      stops:   segments.length - 1,
      bag:     bagText,
      pkr:     pkr,
      usd:     usd,
      _raw:    offer  // keep raw for booking step
    };
  });
}

/* ── AIRLINE CODE → NAME MAP ── */
const AIRLINE_NAMES = {
  'EK':'Emirates',      'FZ':'flydubai',       'G9':'Air Arabia',
  'QR':'Qatar Airways', 'EY':'Etihad Airways',  'SV':'Saudia',
  'XY':'flynas',        'PK':'PIA',             'PA':'Airblue',
  '9P':'Fly Jinnah',    'ER':'Serene Air',      'E4':'AirSial',
  'TK':'Turkish Airlines','LH':'Lufthansa',     'BA':'British Airways',
  'AF':'Air France',    'KL':'KLM',             'MS':'EgyptAir',
  'MH':'Malaysia Airlines','SQ':'Singapore Airlines',
  'CX':'Cathay Pacific','AI':'Air India',       'WY':'Oman Air',
  'KU':'Kuwait Airways','GF':'Gulf Air',        'ET':'Ethiopian Airlines',
};
function getAirlineName(code) {
  return AIRLINE_NAMES[code] || code;
}

/* ── UI HELPERS ── */
function showLoading() {
  const div = document.createElement('div');
  div.id = 'loading-overlay';
  div.innerHTML = `
    <div style="padding:40px;text-align:center;color:#64748b;font-size:14px;">
      <div style="margin-bottom:10px;font-size:24px;">✈</div>
      Searching live flights via Amadeus API...
    </div>`;
  document.getElementById('results-body').appendChild(div);
  return div;
}
function removeLoading(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

function showError(msg) {
  const banner = document.createElement('div');
  banner.style.cssText = 'padding:10px 22px;background:#fef2f2;color:#991b1b;font-size:12px;border-bottom:1px solid #fecaca;';
  banner.textContent = '⚠ ' + msg;
  document.getElementById('route-banner').after(banner);
  setTimeout(() => banner.remove(), 5000);
}

/* ── EXPORT so app.js can call it ── */
window.searchLiveFlights = searchLiveFlights;
