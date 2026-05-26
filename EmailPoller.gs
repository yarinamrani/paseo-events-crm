/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Paseo Leads CRM — Gmail Email Poller
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Replaces Make.com for email lead ingestion.
 *  Checks Gmail every 15 minutes for new lead emails and adds them
 *  to Master Leads automatically.
 *
 *  Supported sources:
 *    • Call Event emails    (Gmail label: "CRM - Call Event Leads")
 *    • Paseo website emails (Gmail label: "CRM - Paseo Website Leads")
 *
 *  ────────────────────────────────────────────────────────
 *  SETUP (one-time, 2 minutes)
 *  ────────────────────────────────────────────────────────
 *  1. In Gmail, create two labels:
 *       "CRM - Call Event Leads"
 *       "CRM - Paseo Website Leads"
 *
 *  2. In Gmail, create filters to auto-label incoming lead emails:
 *       Settings → Filters → Create filter
 *       From: (the sender of Call Event emails)
 *       Apply label: "CRM - Call Event Leads"
 *       (repeat for Paseo website emails)
 *
 *  3. Paste this file into Apps Script (same project as Code.gs).
 *
 *  4. Run setupEmailPoller() once — it creates a 15-minute timer.
 *     That's it. Emails will flow into Master Leads automatically.
 *
 *  To stop:  run removeEmailPoller()
 *  To test:  run pollEmails() manually
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Email source configuration ─────────────────────────────────────────────

var EMAIL_SOURCES = [
  {
    label:  'CRM - Call Event Leads',
    source: 'call_event_email',
    notes:  'ליד מ-Call Event — לטפל ידנית'
  },
  {
    label:  'CRM - Paseo Website Leads',
    source: 'paseo_website_email',
    notes:  'ליד מהאתר — לטפל ידנית'
  }
];

// Processed emails are marked with this label so we don't re-process them
var PROCESSED_LABEL = 'CRM - Processed';

// ─── Main poller — runs every 15 minutes ────────────────────────────────────

function pollEmails() {
  ensureLabel_(PROCESSED_LABEL);

  EMAIL_SOURCES.forEach(function(src) {
    processEmailSource_(src);
  });
}

// ─── Process one email source ───────────────────────────────────────────────

function processEmailSource_(src) {
  var query = 'label:' + src.label.replace(/ /g, '-')
            + ' -label:' + PROCESSED_LABEL.replace(/ /g, '-');

  var threads = GmailApp.search(query, 0, 20);
  if (threads.length === 0) return;

  var processedLabel = GmailApp.getUserLabelByName(PROCESSED_LABEL);
  var count = 0;

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    var msg = messages[messages.length - 1]; // latest message in thread

    var body = msg.getPlainBody() || msg.getBody() || '';
    var from = msg.getFrom() || '';
    var fromEmail = extractEmail_(from);

    var result = addLead({
      source:          src.source,
      fullName:        '',
      phone:           '',
      email:           fromEmail,
      eventDate:       '',
      eventType:       '',
      numGuests:       '',
      notes:           src.notes,
      rawPayload:      body.substring(0, 5000), // limit to 5000 chars
      emailSubject:    msg.getSubject() || '',
      emailReceivedAt: formatDate_(msg.getDate())
    });

    // Mark as processed
    thread.addLabel(processedLabel);

    count++;
    Logger.log('Added lead ' + result.leadId + ' from ' + src.source +
               ' | subject: ' + msg.getSubject());
  });

  if (count > 0) {
    Logger.log('Processed ' + count + ' emails from ' + src.label);
  }
}

// ─── Setup: create the 15-minute timer trigger ─────────────────────────────

function setupEmailPoller() {
  // Remove existing triggers first
  removeEmailPoller();

  // Create the "CRM - Processed" label if it doesn't exist
  ensureLabel_(PROCESSED_LABEL);

  // Create a time-driven trigger that runs every 15 minutes
  ScriptApp.newTrigger('pollEmails')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('Email poller installed — runs every 15 minutes.');
  SpreadsheetApp.getUi().alert(
    'Email poller is now active ✓\n\n' +
    'It will check Gmail every 15 minutes for new lead emails\n' +
    'in these labels:\n' +
    '• CRM - Call Event Leads\n' +
    '• CRM - Paseo Website Leads\n\n' +
    'New leads will appear in Master Leads automatically.\n\n' +
    'To stop: run removeEmailPoller()'
  );
}

// ─── Remove the timer trigger ───────────────────────────────────────────────

function removeEmailPoller() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'pollEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  Logger.log('Email poller removed.');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureLabel_(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
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
  return Utilities.formatDate(date, 'Asia/Jerusalem', 'yyyy-MM-dd HH:mm');
}

// ─── Manual test ────────────────────────────────────────────────────────────

function testEmailPoller() {
  Logger.log('=== Testing Email Poller ===');
  Logger.log('Checking for unprocessed emails...');

  EMAIL_SOURCES.forEach(function(src) {
    var query = 'label:' + src.label.replace(/ /g, '-')
              + ' -label:' + PROCESSED_LABEL.replace(/ /g, '-');
    var threads = GmailApp.search(query, 0, 5);
    Logger.log(src.label + ': ' + threads.length + ' unprocessed emails found');

    if (threads.length > 0) {
      var msg = threads[0].getMessages()[0];
      Logger.log('  Example — Subject: ' + msg.getSubject());
      Logger.log('  Example — From: ' + msg.getFrom());
      Logger.log('  Example — Date: ' + msg.getDate());
    }
  });

  Logger.log('');
  Logger.log('To process these emails, run pollEmails()');
  Logger.log('To set up automatic polling every 15 min, run setupEmailPoller()');
}
