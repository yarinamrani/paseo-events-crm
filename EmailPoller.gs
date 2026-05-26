/**
 * Paseo Leads CRM v2 — סריקת מיילים מ-Gmail
 *
 * בודק Gmail כל 15 דקות, מפרסר את גוף המייל, ומכניס לידים
 * עם כל הפרטים (שם, טלפון, סוג אירוע, תאריך...) לטאב לידים.
 * מייבא רק מיילים מ-20.5.2026 והלאה.
 *
 * מקורות:
 *   • Call Event  (label: "CRM - Call Event Leads")
 *   • אתר Paseo   (label: "CRM - Paseo Website Leads")
 *
 * התקנה:
 *   1. צור labels ב-Gmail (אם לא קיימים)
 *   2. צור filters ב-Gmail:
 *      - Call Event: subject:"הפניית לקוח מאתר CALL EVENT" → label "CRM - Call Event Leads"
 *      - Paseo:      from:paseorooftop1@gmail.com subject:"טופס הזמנה" → label "CRM - Paseo Website Leads"
 *   3. הרץ setupEmailPoller() פעם אחת
 */

var EMAIL_SOURCES = [
  {
    label:  'CRM - Call Event Leads',
    source: 'call_event_email',
    notes:  'ליד מ-Call Event',
    parser: 'callEvent'
  },
  {
    label:  'CRM - Paseo Website Leads',
    source: 'paseo_website_email',
    notes:  'ליד מאתר Paseo',
    parser: 'paseo'
  }
];

var PROCESSED_LABEL = 'CRM - Processed';

// ─── סריקה ראשית ────────────────────────────────────────────────────────────

function pollEmails() {
  ensureLabel_(PROCESSED_LABEL);
  EMAIL_SOURCES.forEach(function(src) {
    processEmailSource_(src);
  });
}

function processEmailSource_(src) {
  var query = 'label:' + src.label.replace(/ /g, '-')
            + ' -label:' + PROCESSED_LABEL.replace(/ /g, '-')
            + ' after:2026/05/20';

  var threads = GmailApp.search(query, 0, 20);
  if (threads.length === 0) return;

  var processedLabel = GmailApp.getUserLabelByName(PROCESSED_LABEL);
  var count = 0;

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    var msg = messages[messages.length - 1];

    var body = msg.getPlainBody() || msg.getBody() || '';
    var from = msg.getFrom() || '';
    var fromEmail = extractEmail_(from);
    var subject = msg.getSubject() || '';

    var parsed = {};
    if (src.parser === 'paseo') {
      parsed = parsePaseoEmail_(body);
    } else if (src.parser === 'callEvent') {
      parsed = parseCallEventEmail_(body);
    }

    var leadEmail = parsed.email || '';
    if (leadEmail && leadEmail.indexOf('@') === -1) leadEmail = '';
    if (!leadEmail) leadEmail = fromEmail;

    var notes = parsed.notes || src.notes;
    if (!parsed.notes && subject) {
      notes = src.notes + ' | ' + subject;
    }

    var result = addLead({
      source:     src.source,
      fullName:   parsed.fullName || '',
      phone:      parsed.phone || '',
      email:      leadEmail,
      eventDate:  parsed.eventDate || '',
      eventType:  parsed.eventType || '',
      numGuests:  parsed.numGuests || '',
      notes:      notes,
      rawPayload: JSON.stringify({
        subject: subject,
        from: from,
        receivedAt: formatDate_(msg.getDate()),
        body: body.substring(0, 5000)
      })
    });

    thread.addLabel(processedLabel);
    count++;
    Logger.log('ליד ' + result.leadId + ' | ' + (parsed.fullName || '?') + ' | ' + (parsed.phone || '?'));
  });

  if (count > 0) Logger.log('עובדו ' + count + ' מיילים מ-' + src.label);
}

// ═══════════════════════════════════════════════════════════════════════
//  פרסור מיילים מאתר Paseo
// ═══════════════════════════════════════════════════════════════════════
//
//  מבנה:
//    שם פרטי: כוח
//    שם משפחה: לעובדים
//    טלפון: 0526787966
//    אימייל: dalia@workers.org.il
//    תאריך: 2026-07-16
//    שעות האירוע: 19:30
//    כמות אורחים: 50
//    מה אנחנו חוגגים?: פרידה מעובדת
//    הודעה: רוצות לחגוג במוסיקה וריקודים
//    ---
//    תאריך: 24/05/2026   (תאריך שליחה — מתעלמים)

function parsePaseoEmail_(body) {
  var firstName = extractField_(body, 'שם פרטי');
  var lastName = extractField_(body, 'שם משפחה');
  var fullName = ((firstName || '') + ' ' + (lastName || '')).trim();

  var eventType = extractField_(body, 'מה אנחנו חוגגים');
  var notes = extractField_(body, 'הודעה');
  var howFound = extractField_(body, 'איך הגעתם אלינו');
  if (howFound) notes = (notes ? notes + ' | ' : '') + 'מצאו אותנו: ' + howFound;

  return {
    fullName:  fullName,
    phone:     extractField_(body, 'טלפון'),
    email:     extractField_(body, 'אימייל'),
    eventDate: normalizeEventDate_(extractField_(body, 'תאריך')),
    eventType: eventType,
    numGuests: extractField_(body, 'כמות אורחים'),
    notes:     notes
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  פרסור מיילים מ-Call Event
// ═══════════════════════════════════════════════════════════════════════
//
//  מבנה:
//    להלן פרטי הליד:
//    אדר מתעניין/ת בהצעת מחיר ופרטים עבור הפקת אירוע בפסאו
//    כמות מוזמנים: 120
//    סוג האירוע: חתונה בהפתעה!!!
//    מתי: 6.7
//    טלפון: 0546322097
//    מייל: ש
//    תקציב: גמיש
//    מתי נוח להתקשר: זמין-בזהירות
//    הערות:

function parseCallEventEmail_(body) {
  var fullName = '';
  var nameMatch = body.match(/להלן פרטי הליד:\s*\n?\s*(.+?)\s+מתעניין/);
  if (nameMatch) fullName = nameMatch[1].trim();

  var budget = extractField_(body, 'תקציב');
  var callTime = extractField_(body, 'מתי נוח להתקשר');
  var remarks = extractField_(body, 'הערות');

  var noteParts = [];
  if (budget) noteParts.push('תקציב: ' + budget);
  if (callTime) noteParts.push('זמינות: ' + callTime);
  if (remarks) noteParts.push(remarks);

  return {
    fullName:  fullName,
    phone:     extractField_(body, 'טלפון'),
    email:     extractField_(body, 'מייל'),
    eventDate: normalizeEventDate_(extractField_(body, 'מתי')),
    eventType: extractField_(body, 'סוג האירוע'),
    numGuests: extractField_(body, 'כמות מוזמנים'),
    notes:     noteParts.join(' | ')
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  עזרים
// ═══════════════════════════════════════════════════════════════════════

function extractField_(text, label) {
  var escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var match = text.match(new RegExp(escaped + '\\??\\s*:\\s*(.*)'));
  if (match && match[1]) return match[1].trim();
  return '';
}

function normalizeEventDate_(raw) {
  if (!raw) return '';
  raw = String(raw).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) return raw;

  // D.M or D/M → assume current year
  var m = raw.match(/^(\d{1,2})[\.\/](\d{1,2})$/);
  if (m) {
    return new Date().getFullYear() + '-' + padLeft(parseInt(m[2]), 2) + '-' + padLeft(parseInt(m[1]), 2);
  }

  // D.M.YY or D/M/YYYY
  m = raw.match(/^(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})$/);
  if (m) {
    var y = m[3].length <= 2 ? '20' + m[3] : m[3];
    return y + '-' + padLeft(parseInt(m[2]), 2) + '-' + padLeft(parseInt(m[1]), 2);
  }

  return raw;
}

function ensureLabel_(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

function extractEmail_(fromField) {
  var match = fromField.match(/<([^>]+)>/);
  if (match) return match[1];
  if (fromField.indexOf('@') > -1) return fromField.trim();
  return '';
}

function formatDate_(date) {
  if (!date) return '';
  return Utilities.formatDate(date, 'Asia/Jerusalem', 'dd/MM/yyyy HH:mm');
}

// ─── התקנה ──────────────────────────────────────────────────────────────────

function setupEmailPoller() {
  removeEmailPoller();
  ensureLabel_(PROCESSED_LABEL);

  ScriptApp.newTrigger('pollEmails')
    .timeBased()
    .everyMinutes(15)
    .create();

  SpreadsheetApp.getUi().alert(
    'סורק מיילים פעיל ✓\n\n' +
    'בודק Gmail כל 15 דקות:\n' +
    '• CRM - Call Event Leads\n' +
    '• CRM - Paseo Website Leads\n\n' +
    'שולף אוטומטית: שם, טלפון, אימייל, סוג אירוע, תאריך, כמות אורחים.\n' +
    'מייבא רק מ-20.5.2026 והלאה.\n\n' +
    'לעצירה: removeEmailPoller()'
  );
}

function removeEmailPoller() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'pollEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

// ─── בדיקה ידנית ────────────────────────────────────────────────────────────

function testEmailPoller() {
  Logger.log('=== בדיקת סורק מיילים ===');
  EMAIL_SOURCES.forEach(function(src) {
    var query = 'label:' + src.label.replace(/ /g, '-')
              + ' -label:' + PROCESSED_LABEL.replace(/ /g, '-')
              + ' after:2026/05/20';
    var threads = GmailApp.search(query, 0, 5);
    Logger.log(src.label + ': ' + threads.length + ' מיילים ממתינים');

    if (threads.length > 0) {
      var msg = threads[0].getMessages()[0];
      var body = msg.getPlainBody() || msg.getBody() || '';

      Logger.log('  נושא: ' + msg.getSubject());
      Logger.log('  מאת: ' + msg.getFrom());

      var parsed = {};
      if (src.parser === 'paseo') parsed = parsePaseoEmail_(body);
      else if (src.parser === 'callEvent') parsed = parseCallEventEmail_(body);

      Logger.log('  --- פרסור ---');
      Logger.log('  שם: ' + (parsed.fullName || '(ריק)'));
      Logger.log('  טלפון: ' + (parsed.phone || '(ריק)'));
      Logger.log('  אימייל: ' + (parsed.email || '(ריק)'));
      Logger.log('  תאריך אירוע: ' + (parsed.eventDate || '(ריק)'));
      Logger.log('  סוג אירוע: ' + (parsed.eventType || '(ריק)'));
      Logger.log('  אורחים: ' + (parsed.numGuests || '(ריק)'));
      Logger.log('  הערות: ' + (parsed.notes || '(ריק)'));
    }
  });
  Logger.log('\nלהפעלה: pollEmails()');
  Logger.log('להתקנה אוטומטית: setupEmailPoller()');
}
