/**
 * Paseo Leads CRM v2 — ממשק עברי מלא
 *
 * כל הלידים מכל המקורות במקום אחד.
 * לידים מ-20.5.2026 והלאה.
 */

// ─── הגדרות ─────────────────────────────────────────────────────────────────

var CONFIG = {
  masterTab: 'לידים',
  webhookToken: '',
  cutoffDate: new Date('2026-05-20T00:00:00'),

  sources: ['פייסבוק', 'אינסטגרם', 'Call Event', 'אתר Paseo', 'טופס מארחת', 'ידני'],

  statuses: ['חדש', 'נוצר קשר', 'ממתין לתשובה', 'נסגר הזמנה', 'לא רלוונטי', 'אבוד'],

  eventTypes: [
    'יום הולדת', 'בר/בת מצווה', 'חתונה', 'אירוע חברה',
    'ברית/הברית', 'שבת חתן', 'אירוע פרטי', 'ישיבת צוות', 'אחר'
  ],

  owners: ['ירין', 'מארחת', 'מנהל אירועים'],

  duplicateStatuses: ['ייחודי', 'כפול']
};

var SOURCE_MAP = {
  'facebook':            'פייסבוק',
  'instagram':           'אינסטגרם',
  'call_event_email':    'Call Event',
  'paseo_website_email': 'אתר Paseo',
  'hostess_form':        'טופס מארחת',
  'manual':              'ידני'
};

function mapSource_(source) {
  return SOURCE_MAP[source] || source;
}

// ─── עמודות ─────────────────────────────────────────────────────────────────

var MASTER_COLUMNS = [
  'מזהה ליד',     // A (1)
  'תאריך',        // B (2)
  'מקור',         // C (3)
  'שם מלא',       // D (4)
  'טלפון',        // E (5)
  'אימייל',       // F (6)
  'תאריך אירוע',  // G (7)
  'סוג אירוע',    // H (8)
  'אורחים',       // I (9)
  'הערות',        // J (10)
  'סטטוס',        // K (11)
  'אחראי',       // L (12)
  'קשר אחרון',    // M (13)
  'מעקב הבא',     // N (14)
  'כפילות',       // O (15)
  'ליד מקורי',    // P (16)
  'טלפון מנורמל', // Q (17)
  'מידע גולמי'    // R (18)
];

var ACTIVITIES_COLUMNS = [
  'מזהה פעילות', 'מזהה ליד', 'תאריך', 'סוג', 'הערות', 'בוצע ע"י'
];

// ═══════════════════════════════════════════════════════════════════════
//  SETUP — הרץ פעם אחת
// ═══════════════════════════════════════════════════════════════════════

function setupCRM() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupMasterLeads(ss);
  setupActivities(ss);
  setupSettings(ss);
  setupDashboard(ss);
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(
    'Paseo CRM v2 מוכן ✓\n\n' +
    '• לידים — כל הלידים במקום אחד\n' +
    '• פעילויות — לוג פעילויות\n' +
    '• הגדרות — ערכי תפריטים\n' +
    '• דשבורד — סיכומים\n\n' +
    'לידים מ-20.5.2026 והלאה.'
  );
}

// ─── טאב לידים ──────────────────────────────────────────────────────────────

function setupMasterLeads(ss) {
  var sheet = getOrCreateSheet(ss, CONFIG.masterTab);
  if (sheet.getLastRow() <= 1) sheet.clear();

  var hdr = sheet.getRange(1, 1, 1, MASTER_COLUMNS.length);
  hdr.setValues([MASTER_COLUMNS]);
  hdr.setFontWeight('bold').setFontSize(10);
  hdr.setBackground('#1a237e').setFontColor('#ffffff');
  hdr.setHorizontalAlignment('center').setWrap(true);
  sheet.setFrozenRows(1);

  var w = {1:130,2:135,3:115,4:170,5:125,6:175,7:105,8:115,9:75,10:270,11:115,12:105,13:105,14:105,15:80,16:105,17:125,18:190};
  for (var c in w) sheet.setColumnWidth(parseInt(c), w[c]);

  var MAX = 1000;

  setDropdown(sheet, 2, 3,  MAX, CONFIG.sources);
  setDropdown(sheet, 2, 8,  MAX, CONFIG.eventTypes);
  setDropdown(sheet, 2, 11, MAX, CONFIG.statuses);
  setDropdown(sheet, 2, 12, MAX, CONFIG.owners);
  setDropdown(sheet, 2, 15, MAX, CONFIG.duplicateStatuses);

  sheet.getRange(2, 1, MAX, 1).setNumberFormat('@');
  sheet.getRange(2, 4, MAX, 3).setNumberFormat('@');
  sheet.getRange(2, 10, MAX, 3).setNumberFormat('@');
  sheet.getRange(2, 15, MAX, 4).setNumberFormat('@');

  sheet.getRange(2, 2, MAX, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  sheet.getRange(2, 7, MAX, 1).setNumberFormat('dd/mm/yyyy');
  sheet.getRange(2, 13, MAX, 1).setNumberFormat('dd/mm/yyyy');
  sheet.getRange(2, 14, MAX, 1).setNumberFormat('dd/mm/yyyy');

  var fullRange = sheet.getRange(2, 1, MAX, MASTER_COLUMNS.length);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$K2="חדש"')
      .setBackground('#e8f5e9').setRanges([fullRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($N2<>"",$N2<TODAY(),$K2<>"נסגר הזמנה",$K2<>"לא רלוונטי",$K2<>"אבוד")')
      .setBackground('#fce4ec').setRanges([fullRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$O2="כפול"')
      .setBackground('#fff8e1').setRanges([fullRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$K2="נסגר הזמנה"')
      .setBackground('#e3f2fd').setRanges([fullRange]).build()
  ]);

  var f = sheet.getFilter();
  if (f) f.remove();
  sheet.getRange(1, 1, 1, MASTER_COLUMNS.length).createFilter();
}

// ─── טאב פעילויות ───────────────────────────────────────────────────────────

function setupActivities(ss) {
  var sheet = getOrCreateSheet(ss, 'פעילויות');
  if (sheet.getLastRow() <= 1) sheet.clear();

  var hdr = sheet.getRange(1, 1, 1, ACTIVITIES_COLUMNS.length);
  hdr.setValues([ACTIVITIES_COLUMNS]);
  hdr.setFontWeight('bold');
  hdr.setBackground('#2d6a4f').setFontColor('#ffffff');
  hdr.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  var MAX = 1000;
  setDropdown(sheet, 2, 4, MAX, ['שיחה', 'הודעה', 'מייל', 'פגישה', 'הצעת מחיר', 'הערה']);
  setDropdown(sheet, 2, 6, MAX, CONFIG.owners);
  sheet.getRange(2, 3, MAX, 1).setNumberFormat('dd/mm/yyyy hh:mm');
}

// ─── טאב הגדרות ─────────────────────────────────────────────────────────────

function setupSettings(ss) {
  var sheet = getOrCreateSheet(ss, 'הגדרות');
  sheet.clear();

  sheet.getRange('A1').setValue('מקורות').setFontWeight('bold').setBackground('#b4a7d6');
  sheet.getRange(2, 1, CONFIG.sources.length, 1).setValues(CONFIG.sources.map(function(s) { return [s]; }));

  sheet.getRange('C1').setValue('סטטוסים').setFontWeight('bold').setBackground('#e06666').setFontColor('#fff');
  sheet.getRange(2, 3, CONFIG.statuses.length, 1).setValues(CONFIG.statuses.map(function(s) { return [s]; }));

  sheet.getRange('E1').setValue('סוגי אירועים').setFontWeight('bold').setBackground('#f6b26b');
  sheet.getRange(2, 5, CONFIG.eventTypes.length, 1).setValues(CONFIG.eventTypes.map(function(s) { return [s]; }));

  sheet.getRange('G1').setValue('אחראים').setFontWeight('bold').setBackground('#6fa8dc');
  sheet.getRange(2, 7, CONFIG.owners.length, 1).setValues(CONFIG.owners.map(function(s) { return [s]; }));
}

// ─── דשבורד ─────────────────────────────────────────────────────────────────

function setupDashboard(ss) {
  var sheet = getOrCreateSheet(ss, 'דשבורד');
  sheet.clear();
  var ml = CONFIG.masterTab;

  sheet.getRange('A1').setValue('Paseo CRM — דשבורד').setFontSize(18).setFontWeight('bold').setFontColor('#1a237e');
  sheet.getRange('A2').setValue('לידים מ-20.5.2026 והלאה').setFontSize(11).setFontColor('#666666');
  sheet.getRange('A3').setValue('עדכון אחרון:');
  sheet.getRange('B3').setFormula('=NOW()').setNumberFormat('dd/mm/yyyy hh:mm');

  var r = 5;

  // ── סיכום מהיר ──
  sheet.getRange(r, 1).setValue('סה"כ לידים').setFontWeight('bold').setFontSize(13);
  sheet.getRange(r, 2).setFormula("=COUNTA('" + ml + "'!K2:K)").setFontWeight('bold').setFontSize(16).setFontColor('#1a237e');
  sheet.getRange(r, 3).setValue('חדשים היום').setFontWeight('bold').setFontSize(13);
  sheet.getRange(r, 4).setFormula("=COUNTIFS('" + ml + "'!K:K,\"חדש\",'" + ml + "'!B:B,\">=\"&TODAY())").setFontWeight('bold').setFontSize(16).setFontColor('#2d6a4f');
  r += 2;

  // ── לפי סטטוס ──
  sheet.getRange(r, 1).setValue('לפי סטטוס').setFontSize(13).setFontWeight('bold').setFontColor('#1a237e');
  r++;
  sheet.getRange(r, 1).setValue('סטטוס').setFontWeight('bold');
  sheet.getRange(r, 2).setValue('כמות').setFontWeight('bold');
  sheet.getRange(r, 1, 1, 2).setBackground('#1a237e').setFontColor('#fff');
  r++;
  CONFIG.statuses.forEach(function(st) {
    sheet.getRange(r, 1).setValue(st);
    sheet.getRange(r, 2).setFormula("=COUNTIF('" + ml + "'!K:K,\"" + st + "\")");
    r++;
  });
  r++;

  // ── לפי מקור ──
  sheet.getRange(r, 1).setValue('לפי מקור').setFontSize(13).setFontWeight('bold').setFontColor('#1a237e');
  r++;
  sheet.getRange(r, 1).setValue('מקור').setFontWeight('bold');
  sheet.getRange(r, 2).setValue('כמות').setFontWeight('bold');
  sheet.getRange(r, 1, 1, 2).setBackground('#2d6a4f').setFontColor('#fff');
  r++;
  CONFIG.sources.forEach(function(src) {
    sheet.getRange(r, 1).setValue(src);
    sheet.getRange(r, 2).setFormula("=COUNTIF('" + ml + "'!C:C,\"" + src + "\")");
    r++;
  });
  r++;

  // ── מדדים ──
  sheet.getRange(r, 1).setValue('מדדים').setFontSize(13).setFontWeight('bold').setFontColor('#1a237e');
  r++;
  sheet.getRange(r, 1).setValue('לידים פתוחים');
  sheet.getRange(r, 2).setFormula("=COUNTIFS('" + ml + "'!K:K,\"<>נסגר הזמנה\",'" + ml + "'!K:K,\"<>לא רלוונטי\",'" + ml + "'!K:K,\"<>אבוד\",'" + ml + "'!K:K,\"<>\")");
  r++;
  sheet.getRange(r, 1).setValue('מעקבים שעבר זמנם');
  sheet.getRange(r, 2).setFormula("=COUNTIFS('" + ml + "'!N:N,\"<\"&TODAY(),'" + ml + "'!N:N,\"<>\",'" + ml + "'!K:K,\"<>נסגר הזמנה\",'" + ml + "'!K:K,\"<>לא רלוונטי\",'" + ml + "'!K:K,\"<>אבוד\")");
  r++;
  sheet.getRange(r, 1).setValue('כפילויות');
  sheet.getRange(r, 2).setFormula("=COUNTIF('" + ml + "'!O:O,\"כפול\")");
  r++;
  sheet.getRange(r, 1).setValue('אחוז סגירה');
  sheet.getRange(r, 2).setFormula("=IFERROR(COUNTIF('" + ml + "'!K:K,\"נסגר הזמנה\")/COUNTA('" + ml + "'!K2:K),0)").setNumberFormat('0.0%');

  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(4, 100);
}

// ═══════════════════════════════════════════════════════════════════════
//  נירמול טלפון
// ═══════════════════════════════════════════════════════════════════════

/**
 * @param {string} phone
 * @return {string}
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
//  בדיקת כפילויות
// ═══════════════════════════════════════════════════════════════════════

/** @customfunction */
function CHECK_DUPLICATE(normalizedPhone, currentRow) {
  if (!normalizedPhone) return '';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.masterTab);
  if (!sheet) return '';
  var phones = sheet.getRange('Q2:Q').getValues();
  for (var i = 0; i < phones.length; i++) {
    if (i + 2 >= currentRow) break;
    if (String(phones[i][0]) === String(normalizedPhone)) return 'כפול';
  }
  return 'ייחודי';
}

/** @customfunction */
function FIND_ORIGINAL_LEAD(normalizedPhone, currentRow) {
  if (!normalizedPhone) return '';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.masterTab);
  if (!sheet) return '';
  var ids = sheet.getRange('A2:A').getValues();
  var phones = sheet.getRange('Q2:Q').getValues();
  for (var i = 0; i < phones.length; i++) {
    if (i + 2 >= currentRow) break;
    if (String(phones[i][0]) === String(normalizedPhone)) return ids[i][0];
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════════════
//  הוספת ליד
// ═══════════════════════════════════════════════════════════════════════

function addLead(lead) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.masterTab);
  if (!sheet) throw new Error('טאב "' + CONFIG.masterTab + '" לא נמצא. הרץ setupCRM() קודם.');

  var now = new Date();
  var lastRow = Math.max(sheet.getLastRow(), 1);

  var seq = lastRow;
  var leadId = 'PSO-'
    + Utilities.formatDate(now, 'Asia/Jerusalem', 'yyyyMMdd')
    + '-' + padLeft(seq, 4);

  var normalizedPhone = NORMALIZE_PHONE(lead.phone || '');

  var dupStatus = 'ייחודי';
  var originalLeadId = '';
  if (normalizedPhone && lastRow > 1) {
    var phones = sheet.getRange('Q2:Q' + lastRow).getValues();
    var ids    = sheet.getRange('A2:A' + lastRow).getValues();
    for (var i = 0; i < phones.length; i++) {
      if (String(phones[i][0]) === normalizedPhone) {
        dupStatus = 'כפול';
        originalLeadId = ids[i][0];
        break;
      }
    }
  }

  var followUp = dupStatus === 'כפול' ? '' : new Date(now.getTime() + 86400000);

  var row = [
    leadId,                                        // A מזהה ליד
    now,                                           // B תאריך
    mapSource_(lead.source || 'manual'),           // C מקור
    lead.fullName || '',                           // D שם מלא
    lead.phone || '',                              // E טלפון
    lead.email || '',                              // F אימייל
    lead.eventDate || '',                          // G תאריך אירוע
    lead.eventType || '',                          // H סוג אירוע
    lead.numGuests || '',                          // I אורחים
    lead.notes || '',                              // J הערות
    dupStatus === 'כפול' ? 'לא רלוונטי' : 'חדש',  // K סטטוס
    lead.owner || '',                              // L אחראי
    '',                                            // M קשר אחרון
    followUp,                                      // N מעקב הבא
    dupStatus,                                     // O כפילות
    originalLeadId,                                // P ליד מקורי
    normalizedPhone,                               // Q טלפון מנורמל
    lead.rawPayload || ''                          // R מידע גולמי
  ];

  var newRow = lastRow + 1;
  var rowRange = sheet.getRange(newRow, 1, 1, row.length);
  rowRange.setNumberFormat('@');
  rowRange.setValues([row]);

  sheet.getRange(newRow, 2).setNumberFormat('dd/mm/yyyy hh:mm');
  if (lead.eventDate) sheet.getRange(newRow, 7).setNumberFormat('dd/mm/yyyy');
  if (followUp)       sheet.getRange(newRow, 14).setNumberFormat('dd/mm/yyyy');

  return {
    leadId: leadId,
    row: newRow,
    duplicateStatus: dupStatus,
    originalLeadId: originalLeadId
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  עזרים
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
