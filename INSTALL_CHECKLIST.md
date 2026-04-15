# Installation & Testing Checklist

Use this to install, test, and validate the CRM on a **copy** of the production sheet before going live.

---

## Step 0: Work on a copy first

1. Open the production Paseo sheet.
2. **File → Make a copy** → name it `Paseo Leads CRM — TEST`.
3. Do everything below on the copy. Only move to the real sheet after all tests pass.

---

## Step 1: Add script files

1. Open the test copy.
2. **Extensions → Apps Script**.
3. Delete any existing code in `Code.gs`.
4. Paste the contents of these files (create new script files with `+` → Script):

| Script file name | Source file |
|------------------|------------|
| `Code` | `Code.gs` |
| `WebApp` | `WebApp.gs` |
| `FormHandler` | `FormHandler.gs` |
| `TestSuite` | `TestSuite.gs` |

5. **Save** (Ctrl+S / Cmd+S).

---

## Step 2: Run setup

1. In the function dropdown (top bar), select **`setupCRM`**.
2. Click **▶ Run**.
3. When prompted, click **Review Permissions → Allow**.
4. Wait for the popup: "Paseo CRM setup complete ✓".

**Verify:**
- [ ] "Master Leads" tab exists with 21 column headers (A–U)
- [ ] "Activities" tab exists with 6 column headers
- [ ] "Settings" tab exists with Sources, Statuses, Event Types, Owners lists
- [ ] "Dashboard" tab exists with status/source counters (all showing 0)
- [ ] Existing FB/IG raw tabs are untouched
- [ ] Column D (Source) has a dropdown when you click a cell in row 2
- [ ] Column M (Status) has a dropdown
- [ ] Column J (Event Type) has a dropdown
- [ ] Column N (Owner) has a dropdown
- [ ] Column Q (Duplicate Status) has a dropdown
- [ ] Row 1 is frozen (scrolling keeps headers visible)
- [ ] Auto-filter arrows appear on the header row

---

## Step 3: Run tests

Run each test function from the Apps Script editor (select in dropdown → ▶ Run).
Check results in **View → Logs** (or Ctrl+Enter in the new editor).

| # | Function | What it tests | Expected log output |
|---|----------|---------------|---------------------|
| 1 | `testAddLead_basic` | Basic lead insertion | `PASS ✓`, status = `unique` |
| 2 | `testAddLead_duplicate` | Same phone, different format | `PASS ✓`, status = `duplicate`, Original ID found |
| 3 | `testAddLead_emptyPhone` | Lead with no phone | `PASS ✓`, status = `unique` |
| 4 | `testAddLead_emailSource` | Email source with all fields | `PASS ✓`, status = `unique` |
| 5 | `testDoPost_simulated` | Simulated Make.com POST | `PASS ✓`, status = `ok`, Lead ID present |
| 6 | `testNormalizePhone` | 10 phone format conversions | `ALL PASS ✓` |

**After tests, verify in the sheet:**
- [ ] Master Leads has 5 new rows (tests 1–5)
- [ ] Test 1: Status = "New", Duplicate Status = "unique", Normalized Phone = "+972501234567"
- [ ] Test 2: Status = "Not relevant", Duplicate Status = "duplicate", orange highlight, Original Lead ID points to test 1
- [ ] Test 3: Status = "New", Phone and Normalized Phone are empty
- [ ] Test 4: Email column populated, Source Email Subject populated
- [ ] Test 5: Source = "call_event_email", all fields populated
- [ ] Dashboard counters reflect the test data
- [ ] Conditional formatting: test 1 row is green (New), test 2 row is orange (duplicate)

**Clean up:** Run `cleanupTestLeads` to remove all test rows.

---

## Step 4: Deploy Web App (for Make.com)

1. **Deploy → New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Click **Deploy** → copy the URL.

**Test the deployment:**
- Open the URL in a browser → should show: `{"status":"ok","message":"Paseo Leads CRM web app is running..."}`

**Test with curl (optional):**
```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "call_event_email",
    "fullName": "CURL TEST — משה",
    "phone": "050-9999999",
    "notes": "TEST — curl test lead"
  }'
```

Expected response:
```json
{
  "status": "ok",
  "leadId": "PSO-20260415-NNNN",
  "row": ...,
  "duplicateStatus": "unique",
  "originalLeadId": ""
}
```

---

## Step 5: Create the Google Form

Create a new Google Form with these **exact field names** (they must match `FormHandler.gs`):

| # | Question text (exact) | Field type | Required |
|---|----------------------|------------|----------|
| 1 | **שם מלא** | Short answer | Yes |
| 2 | **טלפון** | Short answer | Yes |
| 3 | **תאריך אירוע** | Date | No |
| 4 | **סוג אירוע** | Dropdown | No |
| 5 | **כמות אורחים** | Short answer | No |
| 6 | **הערות** | Paragraph | No |
| 7 | **מי קיבל/ה את השיחה** | Dropdown | No |

**Dropdown values for "סוג אירוע":**
```
יום הולדת
בר/בת מצווה
חתונה
אירוע חברה
ברית/הברית
שבת חתן
אירוע פרטי
ישיבת צוות
אחר
```

**Dropdown values for "מי קיבל/ה את השיחה":**
```
יריב
מארחת
מנהל אירועים
```

### Link form to the spreadsheet:
1. In the form: **Responses → Link to spreadsheet → Select existing** → choose the test copy.
2. This creates a "Form Responses 1" tab (leave it as raw data).

### Set up the trigger:
1. In the spreadsheet: **Extensions → Apps Script → Triggers** (clock icon on left).
2. **Add Trigger**:
   - Function: **`onHostessFormSubmit`**
   - Deployment: **Head**
   - Event source: **From spreadsheet**
   - Event type: **On form submit**
3. Save → authorize if prompted.

### Test the form:
1. Submit a test response through the form.
2. Check Master Leads — a new row should appear with Source = "hostess_form".
3. Clean up the test row manually or with `cleanupTestLeads` (if notes contain "TEST").

> **Critical:** The question text in the form MUST exactly match what `FormHandler.gs` uses in the `grab()` calls. If you rename a question, update `FormHandler.gs` to match.

---

## Step 6: Make.com test payload

Use this JSON payload when setting up Make.com **HTTP → Make a Request** modules:

### Call Event email scenario
```json
{
  "source": "call_event_email",
  "fullName": "ישראל ישראלי",
  "phone": "054-1112222",
  "email": "israel@example.com",
  "eventDate": "2026-06-15",
  "eventType": "אירוע חברה",
  "numGuests": 50,
  "notes": "Wants private room",
  "rawPayload": "From: notifications@callevent.co.il\nSubject: New lead\n\nName: ישראל ישראלי\nPhone: 054-1112222",
  "emailSubject": "New lead from Call Event",
  "emailReceivedAt": "2026-04-15 11:30"
}
```

### Paseo website email scenario
```json
{
  "source": "paseo_website_email",
  "fullName": "רחל גולן",
  "phone": "052-3334444",
  "email": "rachel@example.com",
  "eventDate": "2026-08-20",
  "eventType": "חתונה",
  "numGuests": 100,
  "notes": "Outdoor terrace preferred",
  "rawPayload": "Contact form submission from paseo.co.il",
  "emailSubject": "פנייה חדשה מהאתר",
  "emailReceivedAt": "2026-04-15 14:00"
}
```

### Fallback (unparseable email)
```json
{
  "source": "call_event_email",
  "fullName": "",
  "phone": "",
  "notes": "ליד מ-Call Event — לטפל ידנית",
  "rawPayload": "The full raw email body goes here...",
  "emailSubject": "Fwd: event inquiry",
  "emailReceivedAt": "2026-04-15 09:00"
}
```

---

## Step 7: Go live

Once all tests pass on the copy:

1. Repeat steps 1–5 on the **real** Paseo spreadsheet.
2. Do NOT run `testAddLead_*` on the real sheet (or run `cleanupTestLeads` immediately after).
3. Connect Make.com scenarios to the real web app URL.
4. Share the Google Form link with the hostess.

---

## Rollback steps

If `setupCRM()` creates something wrong or you need to undo:

### Undo specific tabs
Right-click the tab → **Delete** for any of:
- Master Leads
- Activities
- Settings
- Dashboard

Then fix the issue in the script and run `setupCRM()` again. It re-creates tabs from scratch (calls `sheet.clear()` on each).

### Undo web app deployment
**Extensions → Apps Script → Deploy → Manage deployments → Archive** the deployment. This disables the URL immediately.

### Undo Google Form trigger
**Extensions → Apps Script → Triggers** → click the three dots on the trigger → **Delete trigger**.

### Full rollback
1. Delete the four tabs (Master Leads, Activities, Settings, Dashboard).
2. Delete the "Form Responses" tab if one was created.
3. Archive any web app deployments.
4. Delete all triggers.
5. In Apps Script: delete `Code.gs`, `WebApp.gs`, `FormHandler.gs`, `TestSuite.gs` content.
6. The spreadsheet is back to its original state. Existing FB/IG tabs and Make.com scenarios were never modified.

### Important
`setupCRM()` **never touches existing tabs**. It only creates new ones. Your existing Facebook/Instagram raw data tabs are safe — even if setup fails, they remain unchanged.
