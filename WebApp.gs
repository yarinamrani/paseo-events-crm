/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Paseo Leads CRM — Web App endpoint for Make.com
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  This file turns the Apps Script into a web app that Make.com
 *  can POST leads to via an HTTP webhook.
 *
 *  ────────────────────────────────────────────────────────
 *  HOW TO DEPLOY
 *  ────────────────────────────────────────────────────────
 *  1. In the Apps Script editor → Deploy → New deployment.
 *  2. Type: "Web app".
 *  3. Execute as: "Me" (your Google account).
 *  4. Who has access: "Anyone" (so Make.com can reach it).
 *  5. Click Deploy → copy the URL.
 *  6. Paste the URL as the webhook target in your Make.com scenarios.
 *
 *  Every time you change this code you must create a NEW deployment
 *  (or update the existing one) for the changes to take effect.
 *
 *  ────────────────────────────────────────────────────────
 *  MAKE.COM SCENARIOS THAT USE THIS ENDPOINT
 *  ────────────────────────────────────────────────────────
 *  Scenario A — Call Event Email leads
 *  Scenario B — Paseo Website Email leads
 *  Scenario C — (optional) Facebook/Instagram re-route
 *
 *  All scenarios POST the same JSON schema to this endpoint.
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * Handles incoming POST requests from Make.com.
 *
 * Expected JSON body:
 * {
 *   "source":           "call_event_email" | "paseo_website_email" | ...,
 *   "fullName":         "שם מלא",
 *   "phone":            "050-1234567",
 *   "email":            "example@mail.com",       // optional
 *   "eventDate":        "2025-06-15",              // optional, YYYY-MM-DD
 *   "eventType":        "חתונה",                   // optional
 *   "numGuests":        80,                        // optional
 *   "notes":            "free text",               // optional
 *   "owner":            "מנהל אירועים",            // optional
 *   "rawPayload":       "full email body or JSON", // optional
 *   "emailSubject":     "New lead from...",         // optional
 *   "emailReceivedAt":  "2025-05-01 14:30"         // optional
 * }
 *
 * Returns JSON:
 * {
 *   "status":           "ok",
 *   "leadId":           "PSO-20250501-0012",
 *   "row":              13,
 *   "duplicateStatus":  "unique" | "duplicate",
 *   "originalLeadId":   "" | "PSO-..."
 * }
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    var result = addLead({
      source:          body.source           || 'manual',
      fullName:        body.fullName         || body.name || '',
      phone:           body.phone            || '',
      email:           body.email            || '',
      eventDate:       body.eventDate        || body.event_date || '',
      eventType:       body.eventType        || body.event_type || '',
      numGuests:       body.numGuests        || body.num_guests || '',
      notes:           body.notes            || '',
      owner:           body.owner            || '',
      rawPayload:      body.rawPayload       || body.raw || JSON.stringify(body),
      emailSubject:    body.emailSubject     || body.email_subject || '',
      emailReceivedAt: body.emailReceivedAt  || body.email_received_at || ''
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

/**
 * Simple GET handler — useful for testing the deployment URL in a browser.
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Paseo Leads CRM web app is running. Send POST requests to add leads.'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
