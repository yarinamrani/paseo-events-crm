/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Paseo Leads CRM — Google Form Handler (Hostess leads)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Handles submissions from the hostess Google Form and writes them
 *  directly into the Master Leads tab.
 *
 *  ────────────────────────────────────────────────────────
 *  SETUP (one-time)
 *  ────────────────────────────────────────────────────────
 *  1. Create a Google Form with these questions (in Hebrew):
 *
 *       שם מלא              (Short answer, required)
 *       טלפון               (Short answer, required)
 *       תאריך אירוע          (Date, optional)
 *       סוג אירוע            (Dropdown — values from CONFIG.eventTypes)
 *       כמות אורחים           (Short answer / Number, optional)
 *       הערות                (Paragraph, optional)
 *       מי קיבל/ה את השיחה    (Dropdown — values from CONFIG.owners)
 *
 *  2. Link the form responses to the EXISTING Paseo CRM spreadsheet:
 *       Form → Responses → Link to spreadsheet → select existing.
 *       This creates a "Form Responses" tab (raw intake, leave it).
 *
 *  3. In the Apps Script editor of the CRM spreadsheet:
 *       Triggers (clock icon) → Add Trigger:
 *         Function:      onHostessFormSubmit
 *         Event source:  From spreadsheet
 *         Event type:    On form submit
 *       Save.
 *
 *  Now every form submission automatically creates a row in Master Leads.
 *
 *  ────────────────────────────────────────────────────────
 *  OPTIONAL — WhatsApp notification
 *  ────────────────────────────────────────────────────────
 *  If you want the "פסאו לידים" WhatsApp group to still get notified:
 *    • Create a Make.com scenario with a Custom Webhook trigger.
 *    • Connect it to a WhatsApp Cloud API / Twilio / chat-api action.
 *    • Paste the webhook URL into WHATSAPP_WEBHOOK_URL below.
 *  This way the WhatsApp group stays as a notification channel,
 *  but the CRM sheet is the source of truth.
 * ═══════════════════════════════════════════════════════════════════════
 */

// Paste your Make.com webhook URL here to notify WhatsApp (or leave empty)
var WHATSAPP_WEBHOOK_URL = '';

/**
 * Triggered when the hostess submits the Google Form.
 *
 * @param {Object} e  The form-submit event object.
 */
function onHostessFormSubmit(e) {
  var vals = e.namedValues;

  var lead = {
    source:    'hostess_form',
    fullName:  grab(vals, 'שם מלא'),
    phone:     grab(vals, 'טלפון'),
    eventDate: grab(vals, 'תאריך אירוע'),
    eventType: grab(vals, 'סוג אירוע'),
    numGuests: grab(vals, 'כמות אורחים'),
    notes:     grab(vals, 'הערות'),
    owner:     grab(vals, 'מי קיבל/ה את השיחה') || 'מארחת',
    rawPayload: JSON.stringify(vals)
  };

  var result = addLead(lead);

  // Send WhatsApp notification (if webhook configured)
  if (WHATSAPP_WEBHOOK_URL) {
    sendWhatsAppNotification(lead, result);
  }

  Logger.log('Hostess lead added: ' + result.leadId +
             ' | dup=' + result.duplicateStatus);
}

/**
 * Safely extracts a value from named form responses.
 */
function grab(namedValues, key) {
  if (namedValues && namedValues[key] && namedValues[key].length > 0) {
    return namedValues[key][0].trim();
  }
  return '';
}

/**
 * Sends a notification to the WhatsApp group via Make.com webhook.
 */
function sendWhatsAppNotification(lead, result) {
  if (!WHATSAPP_WEBHOOK_URL) return;

  var message = '📋 ליד חדש מהמארחת\n'
    + '👤 ' + lead.fullName + '\n'
    + '📞 ' + lead.phone + '\n'
    + (lead.eventDate  ? '📅 ' + lead.eventDate + '\n' : '')
    + (lead.eventType  ? '🎉 ' + lead.eventType + '\n' : '')
    + (lead.numGuests  ? '👥 ' + lead.numGuests + ' אורחים\n' : '')
    + (lead.notes      ? '📝 ' + lead.notes + '\n' : '')
    + '🔖 ' + result.leadId
    + (result.duplicateStatus === 'duplicate'
        ? '\n⚠️ כפול! ראו ליד ' + result.originalLeadId
        : '');

  try {
    UrlFetchApp.fetch(WHATSAPP_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        leadId: result.leadId,
        message: message,
        name: lead.fullName,
        phone: lead.phone,
        duplicate: result.duplicateStatus
      }),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log('WhatsApp notification failed: ' + err.message);
  }
}
