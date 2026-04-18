/**
 * app.js
 * Hassni Ticket Company — Global Flight Dashboard
 * Main application logic: search, autocomplete, filters, WhatsApp, Amadeus API
 */

/* ============================================================
   STATE
   ============================================================ */
const selected = { from: null, to: null };

/* ============================================================
   SAMPLE FLIGHTS (shown before Amadeus API is connected)
   ============================================================ */
const SAMPLE_FLIGHTS = [
  { airline:'Air Arabia',      code:'G9 521',  dep:'02:30', arr:'04:45',    dur:'3h 15m',  stops:0, bag:'20kg + 7kg', pkr:42500, usd:152 },
  { airline:'Fly Jinnah',      code:'9P 101',  dep:'06:00', arr:'08:20',    dur:'3h 20m',  stops:0, bag:'20kg + 7kg', pkr:46000, usd:165 },
  { airline:'flydubai',        code:'FZ 349',  dep:'09:45', arr:'12:05',    dur:'3h 20m',  stops:0, bag:'20kg + 5kg', pkr:44800, usd:160 },
  { airline:'Airblue',         code:'PA 212',  dep:'11:30', arr:'13:50',    dur:'3h 20m',  stops:0, bag:'30kg + 7kg', pkr:51200, usd:183 },
  { airline:'Emirates',        code:'EK 622',  dep:'14:30', arr:'16:50',    dur:'3h 20m',  stops:0, bag:'35kg + 7kg', pkr:68500, usd:245 },
  { airline:'PIA',             code:'PK 220',  dep:'18:00', arr:'20:30',    dur:'3h 30m',  stops:0, bag:'30kg + 7kg', pkr:55000, usd:197 },
  { airline:'Turkish Airlines',code:'TK 709',  dep:'08:05', arr:'17:30',    dur:'9h 25m',  stops:1, bag:'30kg + 8kg', pkr:58200, usd:208 },
  { airline:'Qatar Airways',   code:'QR 631',  dep:'22:50', arr:'09:15+1',  dur:'10h 25m', stops:1, bag:'30kg + 7kg', pkr:63800, usd:228 },
];

/* ============================================================
   AUTOCOMPLETE
   ============================================================ */
function searchAirports(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return AIRPORTS.filter(a =>
    a.city.toLowerCase().includes(q) ||
    a.iata.toLowerCase().includes(q) ||
    a.country.toLowerCase().includes(q)
  ).slice(0, 9);
}

function onType(field) {
  const val = document.getElementById('inp-' + field).value;
  const results = searchAirports(val);
  const dd = document.getElementById('dd-' + field);
  if (val.length < 1) { dd.classList.remove('open'); return; }
  if (results.length === 0) {
    dd.innerHTML = `<div class="dd-item"><span class="dd-city" style="color:#94a3b8">No airports found for "${val}"</span></div>`;
  } else {
    dd.innerHTML = results.map(a => `
      <div class="dd-item" onmousedown="selectAirport('${field}','${a.iata}','${a.city.replace(/'/g,"\\'")}','${a.country.replace(/'/g,"\\'")}')">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div>
            <span class="dd-city">${a.city}</span>
            <span class="dd-meta"> &middot; ${a.country}</span>
          </div>
          <span class="dd-iata">${a.iata}</span>
        </div>
      </div>`).join('');
  }
  dd.classList.add('open');
}

function onFocus(field) { onType(field); }
function onBlur(field) {
  setTimeout(() => document.getElementById('dd-' + field).classList.remove('open'), 200);
}

function selectAirport(field, iata, city, country) {
  selected[field] = { iata, city, country };
  document.getElementById('inp-' + field).value = city + ' (' + iata + ')';
  const hint = document.getElementById('hint-' + field);
  hint.textContent = iata + ' · ' + country;
  hint.className = 'ac-hint ok';
  document.getElementById('dd-' + field).classList.remove('open');
}

/* ============================================================
   SWAP CITIES
   ============================================================ */
function swapCities() {
  const tmpSel  = selected.from ? { ...selected.from }  : null;
  const tmpInp  = document.getElementById('inp-from').value;
  const tmpHint = document.getElementById('hint-from').textContent;
  const tmpHintClass = document.getElementById('hint-from').className;

  selected.from = selected.to ? { ...selected.to } : null;
  selected.to   = tmpSel;

  document.getElementById('inp-from').value        = document.getElementById('inp-to').value;
  document.getElementById('hint-from').textContent = document.getElementById('hint-to').textContent;
  document.getElementById('hint-from').className   = document.getElementById('hint-to').className;

  document.getElementById('inp-to').value        = tmpInp;
  document.getElementById('hint-to').textContent = tmpHint;
  document.getElementById('hint-to').className   = tmpHintClass;
}

/* ============================================================
   ROUTE TYPE DETECTION  (no hardcoded routes — just checks if PK)
   ============================================================ */
const PK_IATA = new Set(['LHE','KHI','ISB','PEW','MUX','SKT','LYP','SUL','GWD','UET']);

function detectRouteType(fromIata, toIata) {
  const fromPk = PK_IATA.has(fromIata);
  const toPk   = PK_IATA.has(toIata);
  if (fromPk && toPk)   return 'Pakistan Domestic';
  if (fromPk && !toPk)  return 'Pakistan → International';
  if (!fromPk && toPk)  return 'International → Pakistan';
  return 'International → International';
}

/* ============================================================
   SEARCH
   ============================================================ */
function doSearch() {
  // Validate inputs
  const hintFrom = document.getElementById('hint-from');
  const hintTo   = document.getElementById('hint-to');
  let valid = true;
  if (!selected.from) {
    hintFrom.textContent = 'Please select a departure city';
    hintFrom.className = 'ac-hint err';
    valid = false;
  }
  if (!selected.to) {
    hintTo.textContent = 'Please select a destination city';
    hintTo.className = 'ac-hint err';
    valid = false;
  }
  if (!valid) return;
  if (selected.from.iata === selected.to.iata) {
    hintTo.textContent = 'Destination must be different from origin';
    hintTo.className = 'ac-hint err';
    return;
  }

  const o   = selected.from;
  const d   = selected.to;
  const dt  = document.getElementById('tdate').value || 'Selected date';
  const rtype = detectRouteType(o.iata, d.iata);

  // Show UI sections
  document.getElementById('route-banner').style.display = 'flex';
  document.getElementById('tbl-head').style.display     = 'grid';
  document.getElementById('foot').style.display         = 'flex';

  // Route banner
  document.getElementById('route-text').innerHTML = `
    <span class="route-pill">${o.iata} ${o.city} &rarr; ${d.iata} ${d.city} &nbsp;&middot;&nbsp; ${dt}</span>
    <span style="margin-left:8px;font-size:11px;color:#64748b;">${rtype}</span>`;

  // ----------------------------------------------------------------
  // TODO: Replace the block below with a real Amadeus API call.
  // Call your n8n webhook which calls Amadeus and returns JSON.
  // See api.js for the integration template.
  // ----------------------------------------------------------------
  renderResults(SAMPLE_FLIGHTS, o, d, rtype);
}

/* ============================================================
   RENDER RESULTS
   ============================================================ */
function renderResults(flights, o, d, rtype) {
  // Sort cheapest first
  const sorted = [...flights].sort((a, b) => a.pkr - b.pkr);
  sorted[0]._cheapest = true;

  const body = document.getElementById('results-body');
  if (sorted.length === 0) {
    body.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-title">No flights found</div>
      <div class="empty-desc">Try different dates or check the IATA codes.</div>
    </div>`;
    return;
  }

  body.innerHTML = sorted.map((f, i) => `
    <div class="row ${i === 0 ? 'best' : ''}">
      <div>
        <div class="al-name">
          ${f.airline}
          ${i === 0 ? '<span class="best-tag">Cheapest</span>' : ''}
        </div>
        <div class="al-code">${f.code} &middot; ${o.iata}&rarr;${d.iata}</div>
      </div>
      <div>
        <div class="timing">${f.dep} &rarr; ${f.arr}</div>
        <div class="dur">${f.arr.includes('+') ? 'Next day' : 'Same day'}</div>
      </div>
      <div class="dur">${f.dur}</div>
      <div>
        <span class="sbadge ${f.stops === 0 ? 's-direct' : 's-one'}">
          ${f.stops === 0 ? 'Direct' : f.stops + ' stop'}
        </span>
      </div>
      <div class="bag-info">${f.bag}</div>
      <div>
        <div class="price">PKR ${f.pkr.toLocaleString()}</div>
        <span class="price-sub">~$${f.usd} USD</span>
        <div class="brow">
          <button class="bbk" onclick="bookFlight('${f.airline}','${f.code}')">Book</button>
          <button class="bwa" onclick="sendWhatsApp(
            '${f.airline}','${f.code}',
            '${o.iata}','${d.iata}',
            '${o.city}','${d.city}',
            '${f.dep}','${f.arr}',
            'PKR ${f.pkr.toLocaleString()}',
            '${f.bag}')">
            WhatsApp
          </button>
        </div>
      </div>
    </div>`).join('');

  // Footer stats
  document.getElementById('f-count').textContent = sorted.length;
  document.getElementById('f-cheap').textContent = 'PKR ' + sorted[0].pkr.toLocaleString() + ' (' + sorted[0].airline + ')';
  document.getElementById('f-route').textContent = o.city + ' → ' + d.city;
  document.getElementById('f-type').textContent  = rtype;
}

/* ============================================================
   WHATSAPP SEND
   ============================================================ */
function sendWhatsApp(airline, code, origIata, destIata, origCity, destCity, dep, arr, price, bag) {
  const dt   = document.getElementById('tdate').value || 'Selected date';
  const pax  = document.getElementById('pax').value;
  const msg  =
`✈ *Hassni Ticket Company*
License: LHR 10829

*Flight Details*
Airline: ${airline} (${code})
Route: ${origCity} (${origIata}) → ${destCity} (${destIata})
Date: ${dt}
Time: ${dep} → ${arr}
Baggage: ${bag}
Passengers: ${pax}
Price: ${price}

To confirm your booking, reply *YES* or call us:
📞 0331-2937642 / 0332-3218300
📧 hassniticketcompany@gmail.com`;

  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

/* ============================================================
   BOOK FLIGHT (placeholder — wire to your booking system)
   ============================================================ */
function bookFlight(airline, code) {
  alert(`Booking initiated for ${airline} (${code}).\n\nConnect your booking system or Amadeus /orders API to complete this.`);
}

/* ============================================================
   FILTER CHIPS
   ============================================================ */
function filterChip(el) {
  const group = el.getAttribute('data-group');
  // For sort/stops/bag/time groups: single select
  document.querySelectorAll(`.chip[data-group="${group}"]`).forEach(c => c.classList.remove('on'));
  el.classList.add('on');
}

/* ============================================================
   TRIP TYPE TABS
   ============================================================ */
function setTab(el) {
  document.querySelectorAll('.ttab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
}

/* ============================================================
   INIT — set default date to 7 days from today
   ============================================================ */
(function init() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  document.getElementById('tdate').value = d.toISOString().split('T')[0];
})();
