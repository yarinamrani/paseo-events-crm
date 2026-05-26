/**
 * Paseo Leads CRM v2 — סריקת מיילים מ-Gmail
 *
 * בודק Gmail כל 15 דקות ומוסיף לידים חדשים לטאב לידים.
 * מייבא רק מיילים מ-20.5.2026 והלאה.
 *
 * מקורות:
 *   • Call Event  (label: "CRM - Call Event Leads")
 *   • אתר Paseo   (label: "CRM - Paseo Website Leads")
 *
 * התקנה:
 *   1. צור labels ב-Gmail: "CRM - Call Event Leads", "CRM - Paseo Website Leads"
 *   2. צור filters ב-Gmail שמוסיפים את ה-label לפי כתובת השולח
 *   3. הרץ setupEmailPoller() פעם אחת
 */

var EMAIL_SOURCES = [
  {
    label:  'CRM - Call Event Leads',
    source: 'call_event_email',
    notes:  'ליד מ-Call Event'
  },
  {
    label:  'CRM - Paseo Website Leads',
    source: 'paseo_website_email',
    notes:  'ליד מאתר Paseo'
  }
];

var PROCESSED_LABEL = 'CRM - Processed';

// ─── סריקה ראשית — רצה כל 15 דקות ──────────────────────────────────────────

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
    var receivedAt = formatDate_(msg.getDate());

    var result = addLead({
      source:     src.source,
      fullName:   '',
      phone:      '',
      email:      fromEmail,
      notes:      src.notes + (subject ? ' | נושא: ' + subject : ''),
      rawPayload: JSON.stringify({
        emailSubject: subject,
        emailReceivedAt: receivedAt,
        from: from,
        body: body.substring(0, 5000)
      })
    });

    thread.addLabel(processedLabel);
    count++;
    Logger.log('ליד ' + result.leadId + ' מ-' + src.source + ' | ' + subject);
  });

  if (count > 0) {
    Logger.log('עובדו ' + count + ' מיילים מ-' + src.label);
  }
}

// ─── התקנה ──────────────────────────────────────────────────────────────────

function setupEmailPoller() {
  removeEmailPoller();
  ensureLabel_(PROCESSED_LABEL);

  ScriptApp.newTrigger('pollEmails')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('סורק מיילים הותקן — רץ כל 15 דקות.');
  SpreadsheetApp.getUi().alert(
    'סורק מיילים פעיל ✓\n\n' +
    'בודק Gmail כל 15 דקות:\n' +
    '• CRM - Call Event Leads\n' +
    '• CRM - Paseo Website Leads\n\n' +
    'לידים חדשים יופיעו בטאב לידים אוטומטית.\n' +
    'מייבא רק מ-20.5.2026 והלאה.\n\n' +
    'לעצירה: הרץ removeEmailPoller()'
  );
}

function removeEmailPoller() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'pollEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

// ─── עזרים ──────────────────────────────────────────────────────────────────

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

// ─── בדיקה ידנית ────────────────────────────────────────────────────────────

function testEmailPoller() {
  Logger.log('=== בדיקת סורק מיילים ===');
  EMAIL_SOURCES.forEach(function(src) {
    var query = 'label:' + src.label.replace(/ /g, '-')
              + ' -label:' + PROCESSED_LABEL.replace(/ /g, '-')
              + ' after:2026/05/20';
    var threads = GmailApp.search(query, 0, 5);
    Logger.log(src.label + ': ' + threads.length + ' מיילים לא מעובדים');
    if (threads.length > 0) {
      var msg = threads[0].getMessages()[0];
      Logger.log('  דוגמה — נושא: ' + msg.getSubject());
      Logger.log('  דוגמה — מאת: ' + msg.getFrom());
    }
  });
  Logger.log('להפעלה: pollEmails()');
  Logger.log('להתקנה אוטומטית: setupEmailPoller()');
}
