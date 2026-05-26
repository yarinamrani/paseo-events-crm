/**
 * Paseo Leads CRM v2 — Web App endpoint
 *
 * POST leads from Make.com or any external source.
 * GET returns health check.
 */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (CONFIG.webhookToken && body.token !== CONFIG.webhookToken) {
      throw new Error('Unauthorized');
    }

    var notes = body.notes || '';
    var emailSubject = body.emailSubject || body.email_subject || '';
    var emailReceivedAt = body.emailReceivedAt || body.email_received_at || '';
    if (emailSubject && !notes) notes = 'נושא: ' + emailSubject;

    var rawPayload = body.rawPayload || body.raw || '';
    if (emailSubject || emailReceivedAt) {
      rawPayload = JSON.stringify({
        emailSubject: emailSubject,
        emailReceivedAt: emailReceivedAt,
        body: rawPayload
      });
    }

    var result = addLead({
      source:     body.source     || 'manual',
      fullName:   body.fullName   || body.name || '',
      phone:      body.phone      || '',
      email:      body.email      || '',
      eventDate:  body.eventDate  || body.event_date || '',
      eventType:  body.eventType  || body.event_type || '',
      numGuests:  body.numGuests  || body.num_guests || '',
      notes:      notes,
      owner:      body.owner      || '',
      rawPayload: rawPayload
    });

    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'ok',
        leadId: result.leadId,
        row: result.row,
        duplicateStatus: result.duplicateStatus,
        originalLeadId: result.originalLeadId
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: err.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Paseo Leads CRM v2 — פעיל'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
