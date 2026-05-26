/**
 * Paseo Leads CRM v2 — בדיקות
 *
 * הרץ כל פונקציה מתוך עורך Apps Script לבדוק שהמערכת עובדת.
 *
 * סדר מומלץ:
 *   1. testAddLead_basic()
 *   2. testAddLead_duplicate()
 *   3. testAddLead_emptyPhone()
 *   4. testAddLead_emailSource()
 *   5. testDoPost_simulated()
 *   6. testNormalizePhone()
 *
 * ניקוי: cleanupTestLeads()
 */

function testAddLead_basic() {
  var result = addLead({
    source:    'manual',
    fullName:  'TEST — דני כהן',
    phone:     '050-1234567',
    email:     'dani@example.com',
    eventDate: '2026-07-15',
    eventType: 'יום הולדת',
    numGuests: 40,
    notes:     'TEST — בדיקה בסיסית',
    owner:     'ירין'
  });

  Logger.log('=== testAddLead_basic ===');
  Logger.log('מזהה: ' + result.leadId);
  Logger.log('שורה: ' + result.row);
  Logger.log('כפילות: ' + result.duplicateStatus);
  Logger.log(result.duplicateStatus === 'ייחודי' ? 'PASS ✓' : 'FAIL ✗');
}

function testAddLead_duplicate() {
  var result = addLead({
    source:    'hostess_form',
    fullName:  'TEST — דני כ.',
    phone:     '0501234567',
    eventType: 'יום הולדת',
    notes:     'TEST — כפילות',
    owner:     'מארחת'
  });

  Logger.log('=== testAddLead_duplicate ===');
  Logger.log('מזהה: ' + result.leadId);
  Logger.log('כפילות: ' + result.duplicateStatus);
  Logger.log('ליד מקורי: ' + result.originalLeadId);
  Logger.log(result.duplicateStatus === 'כפול' ? 'PASS ✓' : 'FAIL ✗');
  Logger.log(result.originalLeadId ? 'ליד מקורי נמצא ✓' : 'ליד מקורי חסר ✗');
}

function testAddLead_emptyPhone() {
  var result = addLead({
    source:    'call_event_email',
    fullName:  'TEST — ליד ללא טלפון',
    phone:     '',
    notes:     'TEST — ללא טלפון',
    rawPayload: 'email body here'
  });

  Logger.log('=== testAddLead_emptyPhone ===');
  Logger.log('מזהה: ' + result.leadId);
  Logger.log('כפילות: ' + result.duplicateStatus);
  Logger.log(result.duplicateStatus === 'ייחודי' ? 'PASS ✓' : 'FAIL ✗');
}

function testAddLead_emailSource() {
  var result = addLead({
    source:    'paseo_website_email',
    fullName:  'TEST — שרה לוי',
    phone:     '+972-52-9876543',
    email:     'sarah@example.com',
    eventDate: '2026-08-20',
    eventType: 'חתונה',
    numGuests: 120,
    notes:     'TEST — ליד מאתר',
    rawPayload: 'Name: שרה לוי\nPhone: 052-9876543'
  });

  Logger.log('=== testAddLead_emailSource ===');
  Logger.log('מזהה: ' + result.leadId);
  Logger.log('שורה: ' + result.row);
  Logger.log('כפילות: ' + result.duplicateStatus);
  Logger.log(result.duplicateStatus === 'ייחודי' ? 'PASS ✓' : 'FAIL ✗');
}

function testDoPost_simulated() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        source:          'call_event_email',
        fullName:        'TEST — אבי ישראלי',
        phone:           '054-7771234',
        email:           '',
        eventDate:       '2026-09-01',
        eventType:       'אירוע חברה',
        numGuests:       60,
        notes:           'TEST — אירוע חברה',
        rawPayload:      'From: callevent@example.com',
        emailSubject:    'Lead: אבי ישראלי',
        emailReceivedAt: '2026-04-15 10:00',
        token:           CONFIG.webhookToken || ''
      }),
      type: 'application/json'
    }
  };

  var response = doPost(fakeEvent);
  var body = JSON.parse(response.getContent());

  Logger.log('=== testDoPost_simulated ===');
  Logger.log('תגובה: ' + JSON.stringify(body, null, 2));
  Logger.log(body.status === 'ok' ? 'PASS ✓' : 'FAIL ✗');
  Logger.log(body.leadId ? 'מזהה: ' + body.leadId + ' ✓' : 'ללא מזהה ✗');
}

function testNormalizePhone() {
  Logger.log('=== testNormalizePhone ===');

  var cases = [
    { input: '050-1234567',        expected: '+972501234567' },
    { input: '0501234567',         expected: '+972501234567' },
    { input: '+972501234567',      expected: '+972501234567' },
    { input: '972501234567',       expected: '+972501234567' },
    { input: '(050) 123-4567',     expected: '+972501234567' },
    { input: '050.123.4567',       expected: '+972501234567' },
    { input: '+972 (0)50-1234567', expected: '+972501234567' },
    { input: '501234567',          expected: '+972501234567' },
    { input: '00972501234567',     expected: '+972501234567' },
    { input: '9720501234567',      expected: '+972501234567' },
    { input: '',                   expected: '' },
    { input: null,                 expected: '' },
    { input: '03-9876543',        expected: '+97239876543' },
    { input: '+1-555-123-4567',   expected: '+15551234567' }
  ];

  var passed = 0, failed = 0;
  cases.forEach(function(tc) {
    var actual = NORMALIZE_PHONE(tc.input);
    if (actual === tc.expected) {
      passed++;
    } else {
      failed++;
      Logger.log('FAIL: "' + tc.input + '" → "' + actual + '" (צפוי: "' + tc.expected + '")');
    }
  });

  Logger.log(passed + ' עברו, ' + failed + ' נכשלו');
  Logger.log(failed === 0 ? 'ALL PASS ✓' : 'SOME FAILED ✗');
}

// ─── ניקוי בדיקות ───────────────────────────────────────────────────────────

function cleanupTestLeads() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.masterTab);
  if (!sheet) {
    Logger.log('טאב לידים לא נמצא.');
    return;
  }

  var data = sheet.getDataRange().getValues();
  var notesCol = 9; // עמודה J (הערות), אינדקס 0-based = 9
  var deleted = 0;

  for (var i = data.length - 1; i >= 1; i--) {
    var notes = String(data[i][notesCol]);
    if (notes.indexOf('TEST') === 0 || notes.indexOf('TEST —') >= 0) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }

  Logger.log('נוקו ' + deleted + ' שורות בדיקה.');
  SpreadsheetApp.getUi().alert('הוסרו ' + deleted + ' שורות בדיקה מטאב לידים.');
}
