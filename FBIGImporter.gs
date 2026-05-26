/**
 * Paseo Leads CRM v2 — ייבוא לידים מפייסבוק ואינסטגרם
 *
 * סורק את הטאבים הקיימים של FB/IG ומעתיק לידים חדשים לטאב לידים.
 * מייבא רק לידים מ-20.5.2026 והלאה.
 *
 * ──────────────────────────────────────
 * הגדרה — עדכן את השמות והעמודות למטה
 * ──────────────────────────────────────
 * 1. שנה את FB_TAB_NAME ו-IG_TAB_NAME לשמות הטאבים שלך
 * 2. שנה את מיפוי העמודות (A=1, B=2, C=3...)
 * 3. הרץ importFBIGLeads() לייבוא ראשוני
 * 4. הרץ setupFBIGImporter() לייבוא אוטומטי כל 15 דקות
 */

// ─── הגדרות — שנה כאן ──────────────────────────────────────────────────────

var FB_TAB_NAME = 'Facebook Leads';   // ← שנה לשם הטאב שלך
var IG_TAB_NAME = 'Instagram Leads';  // ← שנה לשם הטאב שלך

// מיפוי עמודות: איזו עמודה (מספר) מכילה כל שדה.
// שים 0 אם השדה לא קיים בטאב הזה.
// תסתכל על שורת הכותרות בכל טאב.

var FB_COLUMNS = {
  fullName:  2,   // ← עמודה עם שם
  phone:     3,   // ← עמודה עם טלפון
  email:     4,   // ← עמודה עם אימייל
  eventDate: 0,
  eventType: 0,
  numGuests: 0,
  notes:     0,
  timestamp: 1    // ← עמודה עם תאריך כניסה
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

// ─── ייבוא ──────────────────────────────────────────────────────────────────

function importFBIGLeads() {
  var fb = importFromRawTab_(FB_TAB_NAME, 'facebook', FB_COLUMNS);
  var ig = importFromRawTab_(IG_TAB_NAME, 'instagram', IG_COLUMNS);
  var total = fb + ig;

  Logger.log('ייבוא הושלם: ' + fb + ' FB + ' + ig + ' IG = ' + total + ' לידים חדשים');

  if (total > 0) {
    SpreadsheetApp.getUi().alert(
      'ייבוא הושלם ✓\n\n' +
      fb + ' לידים מפייסבוק\n' +
      ig + ' לידים מאינסטגרם\n' +
      total + ' סה"כ לידים חדשים'
    );
  } else {
    SpreadsheetApp.getUi().alert('אין לידים חדשים לייבוא.');
  }
}

function importFromRawTab_(tabName, source, colMap) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rawSheet = ss.getSheetByName(tabName);
  if (!rawSheet) {
    Logger.log('טאב "' + tabName + '" לא נמצא — מדלג');
    return 0;
  }

  var masterSheet = ss.getSheetByName(CONFIG.masterTab);
  if (!masterSheet) {
    Logger.log('טאב לידים לא נמצא');
    return 0;
  }

  var rawData = rawSheet.getDataRange().getValues();
  if (rawData.length <= 1) return 0;

  // טלפונים קיימים לבדיקת כפילויות — עמודה Q
  var masterLastRow = masterSheet.getLastRow();
  var existingPhones = {};
  if (masterLastRow > 1) {
    var phones = masterSheet.getRange('Q2:Q' + masterLastRow).getValues();
    phones.forEach(function(row) {
      if (row[0]) existingPhones[String(row[0])] = true;
    });
  }

  var importedKey = 'imported_' + source;
  var props = PropertiesService.getScriptProperties();
  var importedRows = {};
  try {
    var stored = props.getProperty(importedKey);
    if (stored) importedRows = JSON.parse(stored);
  } catch(e) {}

  var cutoff = CONFIG.cutoffDate;
  var count = 0;

  for (var i = 1; i < rawData.length; i++) {
    var row = rawData[i];
    var rowKey = String(i) + '_' + String(row[0]);

    if (importedRows[rowKey]) continue;

    // בדיקת תאריך — רק מ-20.5.2026
    if (colMap.timestamp) {
      var ts = row[colMap.timestamp - 1];
      if (ts) {
        var rowDate = new Date(ts);
        if (!isNaN(rowDate.getTime()) && rowDate < cutoff) {
          importedRows[rowKey] = 'before_cutoff';
          continue;
        }
      }
    }

    var phone = colMap.phone ? String(row[colMap.phone - 1] || '') : '';
    var normalizedPhone = NORMALIZE_PHONE(phone);

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
      notes:      notes || ('ליד מ-' + mapSource_(source)),
      rawPayload: JSON.stringify(row)
    });

    importedRows[rowKey] = result.leadId;
    if (normalizedPhone) existingPhones[normalizedPhone] = true;
    count++;
  }

  props.setProperty(importedKey, JSON.stringify(importedRows));
  return count;
}

// ─── ייבוא אוטומטי כל 15 דקות ──────────────────────────────────────────────

function setupFBIGImporter() {
  removeFBIGImporter();
  ScriptApp.newTrigger('importFBIGLeads')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('מייבא FB/IG הותקן — רץ כל 15 דקות.');
  SpreadsheetApp.getUi().alert(
    'מייבא FB/IG פעיל ✓\n\n' +
    'בודק את טאבי פייסבוק ואינסטגרם כל 15 דקות\n' +
    'ומייבא לידים חדשים לטאב לידים.\n' +
    'מייבא רק מ-20.5.2026 והלאה.\n\n' +
    'לעצירה: הרץ removeFBIGImporter()'
  );
}

function removeFBIGImporter() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'importFBIGLeads') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

// ─── איפוס מעקב (לייבוא מחדש) ──────────────────────────────────────────────

function resetFBIGImportTracking() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('imported_facebook');
  props.deleteProperty('imported_instagram');
  Logger.log('מעקב ייבוא אופס. ההרצה הבאה תייבא הכל מחדש.');
  SpreadsheetApp.getUi().alert('מעקב ייבוא אופס.\nהרץ importFBIGLeads() לייבוא מחדש.');
}
