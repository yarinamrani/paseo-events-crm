/**
 * Paseo Leads CRM v2 — טופס מארחת
 *
 * מטפל בהגשות מטופס Google של המארחת ומכניס ישירות לטאב לידים.
 *
 * שדות הטופס (בדיוק):
 *   שם מלא, טלפון, תאריך אירוע, סוג אירוע,
 *   כמות אורחים, הערות, מי קיבל/ה את השיחה
 *
 * טריגר: On form submit → onHostessFormSubmit
 */

var WHATSAPP_WEBHOOK_URL = '';

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

  if (WHATSAPP_WEBHOOK_URL) {
    sendWhatsAppNotification_(lead, result);
  }

  Logger.log('ליד מטופס מארחת: ' + result.leadId + ' | כפילות=' + result.duplicateStatus);
}

function grab(namedValues, key) {
  if (namedValues && namedValues[key] && namedValues[key].length > 0) {
    return namedValues[key][0].trim();
  }
  return '';
}

function sendWhatsAppNotification_(lead, result) {
  if (!WHATSAPP_WEBHOOK_URL) return;
  try {
    UrlFetchApp.fetch(WHATSAPP_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        leadId: result.leadId,
        name: lead.fullName,
        phone: lead.phone,
        eventType: lead.eventType,
        duplicate: result.duplicateStatus
      }),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log('WhatsApp notification failed: ' + err.message);
  }
}
