/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Paseo Leads CRM — Google Apps Script  (Phase 1)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  This script adds a CRM layer ON TOP of the existing Google Sheet
 *  that already receives Facebook & Instagram leads via Make.com.
 *
 *  What it creates:
 *    • "Master Leads"  — the single source of truth, with statuses,
 *                         follow-ups, and duplicate detection
 *    • "Activities"    — activity log per lead
 *    • "Settings"      — dropdown values (sources, statuses, etc.)
 *    • "Dashboard"     — live counters and KPIs
 *
 *  Existing FB / IG raw-data tabs are NOT touched.
 *  They stay as raw intake; Make.com (or a formula) copies new rows
 *  into Master Leads.
 *
 *  ────────────────────────────────────────────────────────
 *  HOW TO INSTALL
 *  ────────────────────────────────────────────────────────
 *  1. Open the existing Paseo Leads spreadsheet.
 *  2. Extensions → Apps Script.
 *  3. Delete the default empty code.
 *  4. Create three files:
 *       Code.gs         — paste this file
 *       WebApp.gs       — paste WebApp.gs
 *       FormHandler.gs  — paste FormHandler.gs
 *  5. Save (Ctrl+S).
 *  6. Run  setupCRM()  from the editor (select it in the dropdown, click ▶).
 *  7. Authorize when prompted.
 *  Done — the new tabs appear in the spreadsheet.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Configuration ──────────────────────────────────────────────────────────

var CONFIG = {
  masterTab: 'Master Leads',
  webhookToken: '',

  sources: [
    'facebook',
    'instagram',
    'call_event_email',
    'paseo_website_email',
    'hostess_form',
    'manual'
  ],

  statuses: [
    'New',
    'Contacted',
    'Waiting for answer',
    'Booked',
    'Not relevant',
    'Lost'
  ],

  eventTypes: [
    'יום הולדת',
    'בר/בת מצווה',
    'חתונה',
    'אירוע חברה',
    'ברית/הברית',
    'שבת חתן',
    'אירוע פרטי',
    'ישיבת צוות',
    'אחר'
  ],

  owners: [
    'יריב',
    'מארחת',
    'מנהל אירועים'
  ],

  duplicateStatuses: ['unique', 'duplicate']
};

// ─── Column order in Master Leads ───────────────────────────────────────────

var MASTER_COLUMNS = [
  'Lead ID',              // A
  'Created At',           // B
  'Updated At',           // C
  'Source',               // D
  'Full Name',            // E
  'Phone',                // F
  'Normalized Phone',     // G
  'Email',                // H
  'Event Date',           // I
  'Event Type',           // J
  'Number of Guests',     // K
  'Notes',                // L
  'Status',               // M
  'Owner',                // N
  'Last Contact Date',    // O
  'Next Follow-up Date',  // P
  'Duplicate Status',     // Q
  'Original Lead ID',     // R
  'Raw Source Data',       // S
  'Source Email Subject',  // T
  'Source Email Received At' // U
];

var ACTIVITIES_COLUMNS = [
  'Activity ID',
  'Lead ID',
  'Date',
  'Type',
  'Notes',
  'Done By'
];

// ═══════════════════════════════════════════════════════════════════════
//  SETUP — run this ONCE
// ═══════════════════════════════════════════════════════════════════════

function setupCRM() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  setupMasterLeads(ss);
  setupActivities(ss);
  setupSettings(ss);
  setupDashboard(ss);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(
    'Paseo CRM setup complete ✓\n\n' +
    'New tabs created:\n' +
    '• Master Leads\n' +
    '• Activities\n' +
    '• Settings\n' +
    '• Dashboard\n\n' +
    'Your existing Facebook/Instagram tabs are untouched.'
  );
}

// ─── Master Leads tab ───────────────────────────────────────────────────────

function setupMasterLeads(ss) {
  var sheet = getOrCreateSheet(ss, CONFIG.masterTab);
  var hasLeadData = sheet.getLastRow() > 1;
  if (!hasLeadData) {
    sheet.clear();
  }

  // Headers
  var hdr = sheet.getRange(1, 1, 1, MASTER_COLUMNS.length);
  hdr.setValues([MASTER_COLUMNS]);
  hdr.setFontWeight('bold');
  hdr.setBackground('#1c4587');
  hdr.setFontColor('#ffffff');
  hdr.setHorizontalAlignment('center');
  hdr.setWrap(true);
  sheet.setFrozenRows(1);

  // Column widths
  var widths = {
    1:90, 2:145, 3:145, 4:130, 5:170, 6:130, 7:140,
    8:170, 9:110, 10:120, 11:90, 12:260, 13:130, 14:120,
    15:120, 16:130, 17:100, 18:100, 19:260, 20:200, 21:150
  };
  for (var col in widths) {
    sheet.setColumnWidth(parseInt(col), widths[col]);
  }

  var MAX = 1000; // pre-format rows

  // ── Dropdowns ──
  setDropdown(sheet, 2, 4,  MAX, CONFIG.sources);         // D: Source
  setDropdown(sheet, 2, 10, MAX, CONFIG.eventTypes);       // J: Event Type
  setDropdown(sheet, 2, 13, MAX, CONFIG.statuses);         // M: Status
  setDropdown(sheet, 2, 14, MAX, CONFIG.owners);           // N: Owner
  setDropdown(sheet, 2, 17, MAX, CONFIG.duplicateStatuses);// Q: Duplicate Status

  // ── Date formats ──
  sheet.getRange(2, 2,  MAX, 1).setNumberFormat('yyyy-mm-dd hh:mm'); // Created At
  sheet.getRange(2, 3,  MAX, 1).setNumberFormat('yyyy-mm-dd hh:mm'); // Updated At
  sheet.getRange(2, 9,  MAX, 1).setNumberFormat('yyyy-mm-dd');       // Event Date
  sheet.getRange(2, 15, MAX, 1).setNumberFormat('yyyy-mm-dd');       // Last Contact
  sheet.getRange(2, 16, MAX, 1).setNumberFormat('yyyy-mm-dd');       // Next Follow-up
  sheet.getRange(2, 21, MAX, 1).setNumberFormat('yyyy-mm-dd hh:mm'); // Email Received

  // ── Conditional formatting ──
  var rules = [];
  var fullRange = sheet.getRange(2, 1, MAX, MASTER_COLUMNS.length);

  // 1. New leads → light green
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$M2="New"')
    .setBackground('#d9ead3')
    .setRanges([fullRange])
    .build());

  // 2. Overdue follow-ups → light red
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($P2<>"", $P2<TODAY(), $M2<>"Booked", $M2<>"Not relevant", $M2<>"Lost")')
    .setBackground('#f4cccc')
    .setRanges([fullRange])
    .build());

  // 3. Duplicates → light orange
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$Q2="duplicate"')
    .setBackground('#fce5cd')
    .setRanges([fullRange])
    .build());

  // 4. Booked → light blue
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$M2="Booked"')
    .setBackground('#cfe2f3')
    .setRanges([fullRange])
    .build());

  sheet.setConditionalFormatRules(rules);

  // Auto-filter
  var existingFilter = sheet.getFilter();
  if (existingFilter) existingFilter.remove();
  sheet.getRange(1, 1, 1, MASTER_COLUMNS.length).createFilter();
}

// ─── Activities tab ─────────────────────────────────────────────────────────

function setupActivities(ss) {
  var sheet = getOrCreateSheet(ss, 'Activities');
  var hasActivityData = sheet.getLastRow() > 1;
  if (!hasActivityData) {
    sheet.clear();
  }

  var hdr = sheet.getRange(1, 1, 1, ACTIVITIES_COLUMNS.length);
  hdr.setValues([ACTIVITIES_COLUMNS]);
  hdr.setFontWeight('bold');
  hdr.setBackground('#38761d');
  hdr.setFontColor('#ffffff');
  hdr.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  var MAX = 1000;
  setDropdown(sheet, 2, 4, MAX, ['שיחה', 'הודעה', 'מייל', 'פגישה', 'הצעת מחיר', 'הערה']);
  setDropdown(sheet, 2, 6, MAX, CONFIG.owners);
  sheet.getRange(2, 3, MAX, 1).setNumberFormat('yyyy-mm-dd hh:mm');
}

// ─── Settings tab (reference data) ─────────────────────────────────────────

function setupSettings(ss) {
  var sheet = getOrCreateSheet(ss, 'Settings');
  sheet.clear();

  // ── Sources list ──
  sheet.getRange('A1').setValue('Sources').setFontWeight('bold').setBackground('#b4a7d6');
  var srcData = CONFIG.sources.map(function(s) { return [s]; });
  sheet.getRange(2, 1, srcData.length, 1).setValues(srcData);

  // ── Statuses list ──
  sheet.getRange('C1').setValue('Statuses').setFontWeight('bold').setBackground('#e06666').setFontColor('#fff');
  var stData = CONFIG.statuses.map(function(s) { return [s]; });
  sheet.getRange(2, 3, stData.length, 1).setValues(stData);

  // ── Event Types list ──
  sheet.getRange('E1').setValue('Event Types').setFontWeight('bold').setBackground('#f6b26b');
  var evData = CONFIG.eventTypes.map(function(s) { return [s]; });
  sheet.getRange(2, 5, evData.length, 1).setValues(evData);

  // ── Owners list ──
  sheet.getRange('G1').setValue('Owners').setFontWeight('bold').setBackground('#6fa8dc');
  var owData = CONFIG.owners.map(function(s) { return [s]; });
  sheet.getRange(2, 7, owData.length, 1).setValues(owData);
}

// ─── Dashboard tab ──────────────────────────────────────────────────────────

function setupDashboard(ss) {
  var sheet = getOrCreateSheet(ss, 'Dashboard');
  sheet.clear();

  var ml = CONFIG.masterTab; // "Master Leads"

  sheet.getRange('A1').setValue('Paseo Leads CRM — Dashboard')
    .setFontSize(16).setFontWeight('bold');
  sheet.getRange('A2').setValue('Last refresh:');
  sheet.getRange('B2').setFormula('=NOW()').setNumberFormat('yyyy-mm-dd hh:mm');

  // ── By Status ──
  var r = 4;
  sheet.getRange(r, 1).setValue('Leads by Status').setFontSize(13).setFontWeight('bold');
  r++;
  sheet.getRange(r, 1).setValue('Status').setFontWeight('bold');
  sheet.getRange(r, 2).setValue('Count').setFontWeight('bold');
  sheet.getRange(r, 1, 1, 2).setBackground('#1c4587').setFontColor('#fff');
  r++;
  CONFIG.statuses.forEach(function(st) {
    sheet.getRange(r, 1).setValue(st);
    sheet.getRange(r, 2).setFormula("=COUNTIF('" + ml + "'!M:M,\"" + st + "\")");
    r++;
  });
  sheet.getRange(r, 1).setValue('Total').setFontWeight('bold');
  sheet.getRange(r, 2).setFormula("=COUNTA('" + ml + "'!M2:M)").setFontWeight('bold');
  r += 2;

  // ── By Source ──
  sheet.getRange(r, 1).setValue('Leads by Source').setFontSize(13).setFontWeight('bold');
  r++;
  sheet.getRange(r, 1).setValue('Source').setFontWeight('bold');
  sheet.getRange(r, 2).setValue('Count').setFontWeight('bold');
  sheet.getRange(r, 1, 1, 2).setBackground('#38761d').setFontColor('#fff');
  r++;
  CONFIG.sources.forEach(function(src) {
    sheet.getRange(r, 1).setValue(src);
    sheet.getRange(r, 2).setFormula("=COUNTIF('" + ml + "'!D:D,\"" + src + "\")");
    r++;
  });
  r += 1;

  // ── Key metrics ──
  sheet.getRange(r, 1).setValue('Key Metrics').setFontSize(13).setFontWeight('bold');
  r++;

  sheet.getRange(r, 1).setValue('New leads (today)');
  sheet.getRange(r, 2).setFormula("=COUNTIFS('" + ml + "'!M:M,\"New\",'" + ml + "'!B:B,\">=\"&TODAY())");
  r++;

  sheet.getRange(r, 1).setValue('Overdue follow-ups');
  sheet.getRange(r, 2).setFormula(
    "=COUNTIFS('" + ml + "'!P:P,\"<\"&TODAY(),'" + ml + "'!P:P,\"<>\",'" + ml + "'!M:M,\"<>Booked\",'" + ml + "'!M:M,\"<>Not relevant\",'" + ml + "'!M:M,\"<>Lost\")"
  );
  r++;

  sheet.getRange(r, 1).setValue('Open leads');
  sheet.getRange(r, 2).setFormula(
    "=COUNTIFS('" + ml + "'!M:M,\"<>Booked\",'" + ml + "'!M:M,\"<>Not relevant\",'" + ml + "'!M:M,\"<>Lost\",'" + ml + "'!M:M,\"<>\")"
  );
  r++;

  sheet.getRange(r, 1).setValue('Duplicates');
  sheet.getRange(r, 2).setFormula("=COUNTIF('" + ml + "'!Q:Q,\"duplicate\")");
  r++;

  sheet.getRange(r, 1).setValue('Booking rate');
  sheet.getRange(r, 2).setFormula(
    "=IFERROR(COUNTIF('" + ml + "'!M:M,\"Booked\")/COUNTA('" + ml + "'!M2:M),0)"
  ).setNumberFormat('0.0%');

  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 120);
}


// ═══════════════════════════════════════════════════════════════════════
//  PHONE NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Normalizes an Israeli phone number to +972XXXXXXXXX format.
 *
 * Usage in a cell:  =NORMALIZE_PHONE(F2)
 *
 * @param {string} phone  Raw phone string.
 * @return {string} Normalized phone, or original if unrecognized.
 * @customfunction
 */
function NORMALIZE_PHONE(phone) {
  if (!phone) return '';
  var p = String(phone).trim().replace(/[^\d\+]/g, '');

  if (/^00972/.test(p)) p = '+972' + p.substring(5);
  if (/^\+9720\d{8,9}$/.test(p)) return '+972' + p.substring(5);
  if (/^\+972\d{8,9}$/.test(p)) return p;
  if (/^9720\d{8,9}$/.test(p)) return '+972' + p.substring(4);
  if (/^972\d{8,9}$/.test(p)) return '+' + p;
  if (/^0\d{8,9}$/.test(p)) return '+972' + p.substring(1);
  if (/^5\d{8}$/.test(p)) return '+972' + p;

  return p;
}


// ═══════════════════════════════════════════════════════════════════════
//  DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Checks if a normalized phone already exists earlier in Master Leads.
 *
 * Usage in a cell:  =CHECK_DUPLICATE(G2, ROW())
 *
 * @param {string} normalizedPhone  The normalized phone to check.
 * @param {number} currentRow       ROW() of the current row.
 * @return {string} "duplicate" or "unique"
 * @customfunction
 */
function CHECK_DUPLICATE(normalizedPhone, currentRow) {
  if (!normalizedPhone) return '';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.masterTab);
  if (!sheet) return '';
  var phones = sheet.getRange('G2:G').getValues();

  for (var i = 0; i < phones.length; i++) {
    var dataRow = i + 2;
    if (dataRow >= currentRow) break; // only check rows above
    if (String(phones[i][0]) === String(normalizedPhone)) return 'duplicate';
  }
  return 'unique';
}

/**
 * Finds the Lead ID of the first matching phone.
 *
 * Usage in a cell:  =FIND_ORIGINAL_LEAD(G2, ROW())
 *
 * @param {string} normalizedPhone
 * @param {number} currentRow
 * @return {string} Lead ID of the original, or empty.
 * @customfunction
 */
function FIND_ORIGINAL_LEAD(normalizedPhone, currentRow) {
  if (!normalizedPhone) return '';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.masterTab);
  if (!sheet) return '';
  var data = sheet.getRange('A2:G').getValues(); // cols A..G

  for (var i = 0; i < data.length; i++) {
    var dataRow = i + 2;
    if (dataRow >= currentRow) break;
    if (String(data[i][6]) === String(normalizedPhone)) return data[i][0]; // col A = Lead ID
  }
  return '';
}


// ═══════════════════════════════════════════════════════════════════════
//  ADD LEAD  (called by WebApp, FormHandler, or manually)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Adds a new lead row to Master Leads.
 *
 * @param {Object} lead
 * @param {string}  lead.source              — one of CONFIG.sources
 * @param {string}  lead.fullName
 * @param {string}  lead.phone               — raw phone
 * @param {string} [lead.email]
 * @param {string} [lead.eventDate]          — YYYY-MM-DD
 * @param {string} [lead.eventType]
 * @param {number} [lead.numGuests]
 * @param {string} [lead.notes]
 * @param {string} [lead.owner]
 * @param {string} [lead.rawPayload]         — JSON string of original data
 * @param {string} [lead.emailSubject]
 * @param {string} [lead.emailReceivedAt]
 * @return {Object} { leadId, row, duplicateStatus, originalLeadId }
 */
function addLead(lead) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.masterTab);
  if (!sheet) throw new Error('Master Leads tab not found. Run setupCRM() first.');

  var now = new Date();
  var lastRow = Math.max(sheet.getLastRow(), 1);

  // Generate Lead ID: PSO-YYYYMMDD-NNNN
  var seq = lastRow; // simple sequential
  var leadId = 'PSO-'
    + Utilities.formatDate(now, 'Asia/Jerusalem', 'yyyyMMdd')
    + '-' + padLeft(seq, 4);

  var normalizedPhone = NORMALIZE_PHONE(lead.phone || '');

  // Duplicate check
  var dupStatus = 'unique';
  var originalLeadId = '';
  if (normalizedPhone && lastRow > 1) {
    var phones = sheet.getRange('G2:G' + lastRow).getValues();
    var ids    = sheet.getRange('A2:A' + lastRow).getValues();
    for (var i = 0; i < phones.length; i++) {
      if (String(phones[i][0]) === normalizedPhone) {
        dupStatus = 'duplicate';
        originalLeadId = ids[i][0];
        break;
      }
    }
  }

  // Default follow-up: +1 business day (simplified to +1 day)
  var followUp = dupStatus === 'duplicate' ? '' : new Date(now.getTime() + 86400000);

  var row = [
    leadId,                                           // A  Lead ID
    now,                                              // B  Created At
    now,                                              // C  Updated At
    lead.source || 'manual',                          // D  Source
    lead.fullName || '',                              // E  Full Name
    lead.phone || '',                                 // F  Phone
    normalizedPhone,                                  // G  Normalized Phone
    lead.email || '',                                 // H  Email
    lead.eventDate || '',                             // I  Event Date
    lead.eventType || '',                             // J  Event Type
    lead.numGuests || '',                             // K  Number of Guests
    lead.notes || '',                                 // L  Notes
    dupStatus === 'duplicate' ? 'Not relevant' : 'New', // M  Status
    lead.owner || '',                                 // N  Owner
    '',                                               // O  Last Contact Date
    followUp,                                         // P  Next Follow-up Date
    dupStatus,                                        // Q  Duplicate Status
    originalLeadId,                                   // R  Original Lead ID
    lead.rawPayload || '',                            // S  Raw Source Data
    lead.emailSubject || '',                          // T  Source Email Subject
    lead.emailReceivedAt || ''                        // U  Source Email Received At
  ];

  sheet.appendRow(row);
  var newRow = sheet.getLastRow();

  // Apply date formats to the new row
  sheet.getRange(newRow, 2).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(newRow, 3).setNumberFormat('yyyy-mm-dd hh:mm');
  if (lead.eventDate)      sheet.getRange(newRow, 9).setNumberFormat('yyyy-mm-dd');
  if (followUp)            sheet.getRange(newRow, 16).setNumberFormat('yyyy-mm-dd');
  if (lead.emailReceivedAt) sheet.getRange(newRow, 21).setNumberFormat('yyyy-mm-dd hh:mm');

  return {
    leadId: leadId,
    row: newRow,
    duplicateStatus: dupStatus,
    originalLeadId: originalLeadId
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function setDropdown(sheet, startRow, col, endRow, values) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(startRow, col, endRow - startRow + 1, 1).setDataValidation(rule);
}

function padLeft(num, size) {
  var s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}
