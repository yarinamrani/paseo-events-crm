/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Paseo Leads CRM — Facebook / Instagram Lead Importer
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Scans the existing FB/IG raw data tabs and copies new leads
 *  into Master Leads. Keeps track of which rows were already imported
 *  so it never creates duplicates.
 *
 *  ────────────────────────────────────────────────────────
 *  SETUP
 *  ────────────────────────────────────────────────────────
 *  1. Update FB_TAB_NAME and IG_TAB_NAME below to match the exact
 *     names of your existing Facebook and Instagram raw data tabs.
 *
 *  2. Update the COLUMN_MAP for each source to match which column
 *     in the raw tab holds name, phone, email, etc.
 *     (Column numbers are 1-based: A=1, B=2, C=3, ...)
 *
 *  3. Run importFBIGLeads() once to import all existing leads.
 *
 *  4. Run setupFBIGImporter() to auto-import every 15 minutes.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Configuration — UPDATE THESE ───────────────────────────────────────────

// The exact tab names in your spreadsheet for the raw FB/IG data.
// Look at the bottom of your Google Sheet for the tab names.
var FB_TAB_NAME = 'Facebook Leads';   // ← change this to your actual tab name
var IG_TAB_NAME = 'Instagram Leads';  // ← change this to your actual tab name

// Column mapping: which column (1-based) in the raw tab holds each field.
// Set to 0 or null if the field doesn't exist in that tab.
// Look at the header row of each raw tab to figure out the mapping.
//
// Example: if column A=Timestamp, B=Name, C=Phone, D=Email
//          then fullName=2, phone=3, email=4

var FB_COLUMNS = {
  fullName:  2,   // ← which column has the contact name?
  phone:     3,   // ← which column has the phone number?
  email:     4,   // ← which column has the email?
  eventDate: 0,   // ← 0 means not available
  eventType: 0,
  numGuests: 0,
  notes:     0,
  timestamp: 1    // ← which column has the submission timestamp?
};

var IG_COLUMNS = {
  fullName:  2,
  phone:     3,
  email:     4,
  eventDate: 0,
  eventType: 0,
  numGuests: 0,
  notes:     0,
  timestamp: 1
};

// ─── Import function ────────────────────────────────────────────────────────

function importFBIGLeads() {
  var fb = importFromRawTab_(FB_TAB_NAME, 'facebook', FB_COLUMNS);
  var ig = importFromRawTab_(IG_TAB_NAME, 'instagram', IG_COLUMNS);

  var total = fb + ig;
  Logger.log('Import complete: ' + fb + ' FB + ' + ig + ' IG = ' + total + ' new leads');

  if (total > 0) {
    SpreadsheetApp.getUi().alert(
      'Import complete ✓\n\n' +
      fb + ' leads from Facebook\n' +
      ig + ' leads from Instagram\n' +
      total + ' total new leads added to Master Leads'
    );
  } else {
    SpreadsheetApp.getUi().alert('No new leads to import. All rows already in Master Leads.');
  }
}

function importFromRawTab_(tabName, source, colMap) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rawSheet = ss.getSheetByName(tabName);

  if (!rawSheet) {
    Logger.log('Tab "' + tabName + '" not found — skipping');
    return 0;
  }

  var masterSheet = ss.getSheetByName(CONFIG.masterTab);
  if (!masterSheet) {
    Logger.log('Master Leads tab not found');
    return 0;
  }

  var rawData = rawSheet.getDataRange().getValues();
  if (rawData.length <= 1) return 0; // only header or empty

  // Get existing normalized phones in Master Leads for dedup
  var masterLastRow = masterSheet.getLastRow();
  var existingPhones = {};
  if (masterLastRow > 1) {
    var phones = masterSheet.getRange('G2:G' + masterLastRow).getValues();
    phones.forEach(function(row) {
      if (row[0]) existingPhones[String(row[0])] = true;
    });
  }

  // Track which raw rows we already imported (by row content hash)
  var importedKey = 'imported_' + source;
  var props = PropertiesService.getScriptProperties();
  var importedRows = {};
  try {
    var stored = props.getProperty(importedKey);
    if (stored) importedRows = JSON.parse(stored);
  } catch(e) {}

  var count = 0;

  for (var i = 1; i < rawData.length; i++) { // skip header row
    var row = rawData[i];
    var rowKey = String(i) + '_' + String(row[0]); // row index + first column as key

    if (importedRows[rowKey]) continue; // already imported

    var phone = colMap.phone ? String(row[colMap.phone - 1] || '') : '';
    var normalizedPhone = NORMALIZE_PHONE(phone);

    // Skip if this phone already exists in Master Leads (dedup)
    if (normalizedPhone && existingPhones[normalizedPhone]) {
      importedRows[rowKey] = 'dup';
      continue;
    }

    var fullName  = colMap.fullName  ? String(row[colMap.fullName - 1]  || '') : '';
    var email     = colMap.email     ? String(row[colMap.email - 1]     || '') : '';
    var eventDate = colMap.eventDate ? String(row[colMap.eventDate - 1] || '') : '';
    var eventType = colMap.eventType ? String(row[colMap.eventType - 1] || '') : '';
    var numGuests = colMap.numGuests ? String(row[colMap.numGuests - 1] || '') : '';
    var notes     = colMap.notes     ? String(row[colMap.notes - 1]     || '') : '';
    var timestamp = colMap.timestamp ? String(row[colMap.timestamp - 1] || '') : '';

    // Skip rows that look empty (no name AND no phone)
    if (!fullName && !phone && !email) {
      importedRows[rowKey] = 'empty';
      continue;
    }

    var result = addLead({
      source:     source,
      fullName:   fullName,
      phone:      phone,
      email:      email,
      eventDate:  eventDate,
      eventType:  eventType,
      numGuests:  numGuests,
      notes:      notes || ('ליד מ-' + source),
      rawPayload: JSON.stringify(row)
    });

    importedRows[rowKey] = result.leadId;
    if (normalizedPhone) existingPhones[normalizedPhone] = true;
    count++;
  }

  // Save progress
  props.setProperty(importedKey, JSON.stringify(importedRows));
  return count;
}

// ─── Auto-import every 15 minutes ───────────────────────────────────────────

function setupFBIGImporter() {
  removeFBIGImporter();

  ScriptApp.newTrigger('importFBIGLeads')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('FB/IG importer installed — runs every 15 minutes.');
  SpreadsheetApp.getUi().alert(
    'FB/IG importer is now active ✓\n\n' +
    'It will check the raw Facebook and Instagram tabs every 15 minutes\n' +
    'and import new leads into Master Leads.\n\n' +
    'To stop: run removeFBIGImporter()'
  );
}

function removeFBIGImporter() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'importFBIGLeads') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

// ─── Reset import tracking (use if you need to re-import everything) ────────

function resetFBIGImportTracking() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('imported_facebook');
  props.deleteProperty('imported_instagram');
  Logger.log('Import tracking reset. Next run will re-import all rows.');
  SpreadsheetApp.getUi().alert('Import tracking reset.\nRun importFBIGLeads() to re-import all leads.');
}
