/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Paseo Leads CRM — Test Suite
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Run these functions manually from the Apps Script editor to verify
 *  that the CRM is working correctly BEFORE connecting real sources.
 *
 *  Recommended order:
 *    1. testAddLead_basic()
 *    2. testAddLead_duplicate()
 *    3. testAddLead_emptyPhone()
 *    4. testAddLead_emailSource()
 *    5. testDoPost_simulated()
 *    6. testNormalizePhone()
 *
 *  After running tests, open the Master Leads tab and verify:
 *    - Rows were created with correct Lead IDs
 *    - Normalized Phone column is populated
 *    - Duplicate row is marked "duplicate" with orange highlight
 *    - Status is "New" for unique, "Not relevant" for duplicate
 *    - Dashboard counters updated
 *
 *  To clean up test data, run:  cleanupTestLeads()
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Test 1: Basic lead insertion ───────────────────────────────────────────

function testAddLead_basic() {
  var result = addLead({
    source:    'manual',
    fullName:  'TEST — דני כהן',
    phone:     '050-1234567',
    email:     'dani@example.com',
    eventDate: '2026-07-15',
    eventType: 'יום הולדת',
    numGuests: 40,
    notes:     'TEST LEAD — delete after testing',
    owner:     'יריב'
  });

  Logger.log('=== testAddLead_basic ===');
  Logger.log('Lead ID:    ' + result.leadId);
  Logger.log('Row:        ' + result.row);
  Logger.log('Dup status: ' + result.duplicateStatus);
  Logger.log('Expected:   unique');
  Logger.log(result.duplicateStatus === 'unique' ? 'PASS ✓' : 'FAIL ✗');
}

// ─── Test 2: Duplicate detection ────────────────────────────────────────────

function testAddLead_duplicate() {
  // This lead has the same phone as test 1 but in a different format.
  // It should be detected as a duplicate.
  var result = addLead({
    source:    'hostess_form',
    fullName:  'TEST — דני כ.',
    phone:     '0501234567',       // same number, no dash
    eventType: 'יום הולדת',
    notes:     'TEST DUPLICATE — delete after testing',
    owner:     'מארחת'
  });

  Logger.log('=== testAddLead_duplicate ===');
  Logger.log('Lead ID:         ' + result.leadId);
  Logger.log('Dup status:      ' + result.duplicateStatus);
  Logger.log('Original Lead:   ' + result.originalLeadId);
  Logger.log('Expected dup:    duplicate');
  Logger.log(result.duplicateStatus === 'duplicate' ? 'PASS ✓' : 'FAIL ✗');
  Logger.log(result.originalLeadId ? 'Original ID found ✓' : 'Original ID missing ✗');
}

// ─── Test 3: Empty phone (should not crash, should not match) ───────────────

function testAddLead_emptyPhone() {
  var result = addLead({
    source:    'call_event_email',
    fullName:  'TEST — ליד ללא טלפון',
    phone:     '',
    notes:     'TEST — raw email body here, phone missing',
    rawPayload: '<html>Email body from Call Event</html>',
    emailSubject: 'New lead from Call Event',
    emailReceivedAt: '2026-04-15 09:30'
  });

  Logger.log('=== testAddLead_emptyPhone ===');
  Logger.log('Lead ID:    ' + result.leadId);
  Logger.log('Dup status: ' + result.duplicateStatus);
  Logger.log('Expected:   unique (empty phone never matches)');
  Logger.log(result.duplicateStatus === 'unique' ? 'PASS ✓' : 'FAIL ✗');
}

// ─── Test 4: Email source lead with full metadata ───────────────────────────

function testAddLead_emailSource() {
  var result = addLead({
    source:          'paseo_website_email',
    fullName:        'TEST — שרה לוי',
    phone:           '+972-52-9876543',
    email:           'sarah@example.com',
    eventDate:       '2026-08-20',
    eventType:       'חתונה',
    numGuests:       120,
    notes:           'TEST — wants outdoor seating',
    rawPayload:      'Subject: New inquiry\n\nName: שרה לוי\nPhone: 052-9876543',
    emailSubject:    'New inquiry from paseo.co.il',
    emailReceivedAt: '2026-04-14 16:45'
  });

  Logger.log('=== testAddLead_emailSource ===');
  Logger.log('Lead ID:    ' + result.leadId);
  Logger.log('Row:        ' + result.row);
  Logger.log('Dup status: ' + result.duplicateStatus);
  Logger.log('Expected:   unique');
  Logger.log(result.duplicateStatus === 'unique' ? 'PASS ✓' : 'FAIL ✗');
}

// ─── Test 5: Simulate doPost (Make.com webhook) ────────────────────────────

function testDoPost_simulated() {
  // Simulate the event object that GAS passes to doPost()
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
        notes:           'TEST — corporate event',
        rawPayload:      'From: callevent@example.com\nBody: ...',
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
  Logger.log('Response: ' + JSON.stringify(body, null, 2));
  Logger.log('Status:   ' + body.status);
  Logger.log(body.status === 'ok' ? 'PASS ✓' : 'FAIL ✗');
  Logger.log(body.leadId ? 'Lead ID: ' + body.leadId + ' ✓' : 'No Lead ID ✗');
}

// ─── Test 6: Phone normalization (unit test, no sheet writes) ───────────────

function testNormalizePhone() {
  Logger.log('=== testNormalizePhone ===');

  var cases = [
    { input: '050-1234567',      expected: '+972501234567' },
    { input: '0501234567',       expected: '+972501234567' },
    { input: '+972501234567',    expected: '+972501234567' },
    { input: '972501234567',     expected: '+972501234567' },
    { input: '(050) 123-4567',   expected: '+972501234567' },
    { input: '050.123.4567',     expected: '+972501234567' },
    { input: '+972 (0)50-1234567', expected: '+972501234567' },
    { input: '501234567',        expected: '+972501234567' },
    { input: '00972501234567',   expected: '+972501234567' },
    { input: '9720501234567',    expected: '+972501234567' },
    { input: '',                 expected: '' },
    { input: null,               expected: '' },
    { input: '03-9876543',       expected: '+97239876543' },
    { input: '+1-555-123-4567',  expected: '+15551234567' }  // non-Israeli, returned as-is after stripping
  ];

  var passed = 0;
  var failed = 0;

  cases.forEach(function(tc) {
    var actual = NORMALIZE_PHONE(tc.input);
    if (actual === tc.expected) {
      passed++;
    } else {
      failed++;
      Logger.log('FAIL: input="' + tc.input + '" expected="' + tc.expected + '" got="' + actual + '"');
    }
  });

  Logger.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  Logger.log(failed === 0 ? 'ALL PASS ✓' : 'SOME FAILED ✗');
}

// ─── Cleanup: remove test data ─────────────────────────────────────────────

/**
 * Deletes all rows in Master Leads where Notes starts with "TEST".
 * Run this after testing to clean up.
 */
function cleanupTestLeads() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Master Leads');
  if (!sheet) {
    Logger.log('Master Leads tab not found.');
    return;
  }

  var data = sheet.getDataRange().getValues();
  var notesCol = 11; // column L (0-indexed), Notes
  var deleted = 0;

  // Delete from bottom to top to avoid row index shifting
  for (var i = data.length - 1; i >= 1; i--) {
    var notes = String(data[i][notesCol]);
    if (notes.indexOf('TEST') === 0 || notes.indexOf('TEST —') >= 0) {
      sheet.deleteRow(i + 1); // +1 because data array is 0-indexed, rows are 1-indexed
      deleted++;
    }
  }

  Logger.log('Cleaned up ' + deleted + ' test rows.');
  SpreadsheetApp.getUi().alert('Removed ' + deleted + ' test rows from Master Leads.');
}
