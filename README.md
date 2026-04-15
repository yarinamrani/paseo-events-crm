# Paseo Leads CRM — Google Sheets (Phase 1)

A simple, practical CRM built on Google Sheets for **Paseo restaurant** event leads.

This system adds a CRM layer on top of the existing Google Sheet that already receives Facebook and Instagram leads via Make.com. It does **not** replace what already works — it organizes everything into one central tab.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXISTING (don't touch)                        │
│                                                                 │
│  Facebook Leads ──► Make.com ──► FB raw tab in Google Sheet     │
│  Instagram Leads ─► Make.com ──► IG raw tab in Google Sheet     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                    NEW (Phase 1)                                 │
│                                                                 │
│  Call Event emails ──► Make.com ──► WebApp.gs ──┐               │
│  Website emails ─────► Make.com ──► WebApp.gs ──┤               │
│  Hostess phone leads ► Google Form ► trigger ───┤               │
│  Manual entry ──────────────────────────────────┤               │
│                                                 ▼               │
│                                          ┌─────────────┐        │
│                                          │ Master Leads │        │
│                                          │    (CRM)     │        │
│                                          └─────────────┘        │
│                                                                 │
│  FB/IG raw tabs ──► Make.com new step ──► Master Leads (later)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tab Structure

| Tab | Purpose | Who uses it |
|-----|---------|-------------|
| **Master Leads** | Central CRM — all leads, statuses, follow-ups | Team daily |
| **Activities** | Log of calls, messages, meetings per lead | Team daily |
| **Settings** | Dropdown values (sources, statuses, event types, owners) | Admin only |
| **Dashboard** | Live counters and KPIs | Manager |
| *(existing FB tab)* | Raw Facebook lead data from Make.com — **do not edit** | Automated |
| *(existing IG tab)* | Raw Instagram lead data from Make.com — **do not edit** | Automated |
| *(Form Responses)* | Raw Google Form responses — **do not edit** | Automated |

---

## Master Leads — Column Reference

| # | Column | Col Letter | Type | Notes |
|---|--------|-----------|------|-------|
| 1 | Lead ID | A | Auto | Format: `PSO-YYYYMMDD-NNNN` |
| 2 | Created At | B | DateTime | Auto-set on creation |
| 3 | Updated At | C | DateTime | Auto-set, update manually when status changes |
| 4 | Source | D | Dropdown | `facebook`, `instagram`, `call_event_email`, `paseo_website_email`, `hostess_form`, `manual` |
| 5 | Full Name | E | Text | Contact name |
| 6 | Phone | F | Text | Raw phone as received |
| 7 | Normalized Phone | G | Formula/Text | `+972XXXXXXXXX` format — used for deduplication |
| 8 | Email | H | Text | Contact email if available |
| 9 | Event Date | I | Date | Requested event date |
| 10 | Event Type | J | Dropdown | See list below |
| 11 | Number of Guests | K | Number | |
| 12 | Notes | L | Text | Free text |
| 13 | Status | M | Dropdown | See list below |
| 14 | Owner | N | Dropdown | Who handles this lead |
| 15 | Last Contact Date | O | Date | Last time someone contacted the lead |
| 16 | Next Follow-up Date | P | Date | When to follow up next |
| 17 | Duplicate Status | Q | Auto/Dropdown | `unique` or `duplicate` |
| 18 | Original Lead ID | R | Auto/Text | If duplicate, points to original lead |
| 19 | Raw Source Data | S | Text | Full email body / raw JSON from source |
| 20 | Source Email Subject | T | Text | Email subject line (for email sources) |
| 21 | Source Email Received At | U | DateTime | When the source email arrived |

---

## Dropdown Values

### Source (column D)
| Value | Meaning |
|-------|---------|
| `facebook` | Facebook lead ad |
| `instagram` | Instagram lead ad |
| `call_event_email` | Lead from Call Event platform (arrives by email) |
| `paseo_website_email` | Lead from Paseo.co.il website (arrives by email) |
| `hostess_form` | Hostess entered via Google Form |
| `manual` | Manually typed into the sheet |

### Status (column M)
| Value | Meaning | Color |
|-------|---------|-------|
| `New` | Not yet contacted | 🟢 Light green row |
| `Contacted` | First contact made | — |
| `Waiting for answer` | Waiting for client reply | — |
| `Booked` | Event confirmed | 🔵 Light blue row |
| `Not relevant` | Lead disqualified | — |
| `Lost` | Lead did not convert | — |

### Event Type (column J)
| Value |
|-------|
| יום הולדת |
| בר/בת מצווה |
| חתונה |
| אירוע חברה |
| ברית/הברית |
| שבת חתן |
| אירוע פרטי |
| ישיבת צוות |
| אחר |

### Owner (column N)
| Value |
|-------|
| יריב |
| מארחת |
| מנהל אירועים |

> To add/change dropdown values, edit the **Settings** tab and re-run `setupCRM()`, or manually update the data validation ranges.

---

## Formulas

### Phone Normalization (column G)

For manually entered rows, use this formula in column G:

```
=NORMALIZE_PHONE(F2)
```

The custom function `NORMALIZE_PHONE()` converts any Israeli phone format to `+972XXXXXXXXX` (drops the leading 0):
- `050-1234567` → `+972501234567`
- `0501234567` → `+972501234567`
- `972501234567` → `+972501234567`
- `+972501234567` → `+972501234567` (no change)

### Duplicate Check (column Q)

For manually entered rows:

```
=CHECK_DUPLICATE(G2, ROW())
```

Returns `"duplicate"` if the same normalized phone exists in an earlier row, `"unique"` otherwise.

### Find Original Lead ID (column R)

```
=FIND_ORIGINAL_LEAD(G2, ROW())
```

If duplicate, returns the Lead ID of the first matching row.

> **Note:** For leads added via Make.com or the Google Form, columns G, Q, and R are filled automatically by the script. Formulas are only needed for rows entered manually.

---

## Conditional Formatting Rules

These are set up automatically by `setupCRM()`:

| Rule | Condition | Format |
|------|-----------|--------|
| New leads | Status = `New` | Light green background |
| Overdue follow-ups | Next Follow-up < today AND status is not Booked/Not relevant/Lost | Light red background |
| Duplicates | Duplicate Status = `duplicate` | Light orange background |
| Booked | Status = `Booked` | Light blue background |

---

## Google Form for the Hostess

Create a Google Form with these fields:

| # | Question | Type | Required | Notes |
|---|----------|------|----------|-------|
| 1 | שם מלא | Short answer | Yes | |
| 2 | טלפון | Short answer | Yes | Add validation: "Contains" a number |
| 3 | תאריך אירוע | Date | No | |
| 4 | סוג אירוע | Dropdown | No | Values: יום הולדת, בר/בת מצווה, חתונה, אירוע חברה, ברית/הברית, שבת חתן, אירוע פרטי, ישיבת צוות, אחר |
| 5 | כמות אורחים | Short answer | No | Add validation: Number |
| 6 | הערות | Paragraph | No | |
| 7 | מי קיבל/ה את השיחה | Dropdown | No | Values: יריב, מארחת, מנהל אירועים |

### Setup steps:

1. Create the form at [forms.google.com](https://forms.google.com).
2. Go to **Responses** → **Link to spreadsheet** → **Select existing spreadsheet** → choose the Paseo CRM sheet.
3. This creates a "Form Responses" tab (raw data — don't work in it).
4. In the CRM spreadsheet: **Extensions → Apps Script → Triggers → Add Trigger**:
   - Function: `onHostessFormSubmit`
   - Event source: From spreadsheet
   - Event type: On form submit
5. Done — every form submission now creates a row in Master Leads automatically.

### Hostess workflow:

> **Instead of sending details to the WhatsApp group, open the form, fill in the fields, and submit.**
> The CRM does the rest. WhatsApp notifications can be added later (see FormHandler.gs).

---

## Make.com Scenarios

### Existing: Facebook & Instagram leads

These already work. **Do not change them** for now.

**Phase 1 approach:** Keep FB/IG leads writing to their existing raw tabs. Later (Phase 2), add a second step to each existing scenario that also POSTs the lead to the WebApp.gs endpoint so it appears in Master Leads.

**Phase 2 approach (when ready):** Add a new module at the end of each existing FB/IG Make.com scenario:
- **HTTP → Make a request**
- Method: POST
- URL: `(your Apps Script web app URL)`
- Body type: JSON
- Body:
```json
{
  "source": "facebook",
  "fullName": "{{name}}",
  "phone": "{{phone}}",
  "email": "{{email}}",
  "eventDate": "",
  "eventType": "",
  "numGuests": "",
  "notes": "{{ad_name}} — {{form_name}}",
  "rawPayload": "{{_raw}}"
}
```

---

### NEW Scenario A: Call Event Email Leads

```
Trigger:  Gmail → Watch Emails
          Label/filter: the Call Event mailbox or label
          ↓
Step 1:   Text Parser → Match Pattern (optional)
          Try to extract name, phone, date, guests from the email body.
          If the email format is consistent, use regex.
          If not, skip this step and pass the raw body.
          ↓
Step 2:   HTTP → Make a Request (POST)
          URL: (your Apps Script web app URL)
          Body (JSON):
          {
            "source": "call_event_email",
            "fullName": "{{parsed_name or ''}}",
            "phone": "{{parsed_phone or ''}}",
            "email": "{{from_email}}",
            "eventDate": "{{parsed_date or ''}}",
            "numGuests": "{{parsed_guests or ''}}",
            "notes": "{{parsed_notes or ''}}",
            "rawPayload": "{{email_body_text}}",
            "emailSubject": "{{subject}}",
            "emailReceivedAt": "{{date}}"
          }
```

**Fallback if parsing is unreliable:** Send the full email body as `rawPayload` and leave `fullName`, `phone`, etc. empty. The team manually fills in the details in Master Leads. This is practical and avoids broken automations from email format changes.

```json
{
  "source": "call_event_email",
  "fullName": "",
  "phone": "",
  "notes": "ליד מ-Call Event — לטפל ידנית",
  "rawPayload": "{{email_body_text}}",
  "emailSubject": "{{subject}}",
  "emailReceivedAt": "{{date}}"
}
```

---

### NEW Scenario B: Paseo Website Email Leads

Same structure as Scenario A, but with a different trigger:

```
Trigger:  Gmail → Watch Emails
          Label/filter: the Paseo.co.il website mailbox or label
          ↓
Step 1:   Text Parser → Match Pattern (optional)
          ↓
Step 2:   HTTP → Make a Request (POST)
          URL: (your Apps Script web app URL)
          Body (JSON):
          {
            "source": "paseo_website_email",
            "fullName": "{{parsed_name or ''}}",
            "phone": "{{parsed_phone or ''}}",
            "email": "{{parsed_email or from_email}}",
            "eventDate": "{{parsed_date or ''}}",
            "numGuests": "{{parsed_guests or ''}}",
            "notes": "{{parsed_notes or ''}}",
            "rawPayload": "{{email_body_text}}",
            "emailSubject": "{{subject}}",
            "emailReceivedAt": "{{date}}"
          }
```

**Same fallback applies:** If the email format is inconsistent, send the raw body and let the team clean up.

---

### Parsing tip for both email sources

If the emails have a consistent structure (e.g., "Name: ...\nPhone: ...\nDate: ..."), use Make.com's **Text Parser → Match Pattern** module with a regex like:

```
שם[:\s]*(.+?)[\n\r]
טלפון[:\s]*([\d\-\+\s]+)[\n\r]
תאריך[:\s]*(.+?)[\n\r]
```

If the format varies, **don't fight it**. Use the raw-payload fallback. You can always improve parsing later once you've seen enough email samples.

---

## Deduplication Logic

Deduplication is based on **normalized phone number** (column G):

1. Every incoming lead's phone is normalized to `+972XXXXXXXXX`.
2. The `addLead()` function scans existing rows in Master Leads for a match.
3. If a match is found:
   - Duplicate Status → `duplicate`
   - Original Lead ID → the Lead ID of the first matching row
   - Status → `Not relevant` (auto-set, team can override)
4. If no match → `unique`, Status → `New`.

For manually entered rows, use the formula `=CHECK_DUPLICATE(G2, ROW())` in column Q.

---

## Daily Workflow for the Restaurant Team

### Morning routine (5 minutes)

1. Open the **Master Leads** tab.
2. Filter by **Status = New** — these are leads that arrived overnight.
3. For each new lead:
   - If raw data needs cleanup (email leads): fill in Name, Phone, Event Date from the Raw Source Data column.
   - Assign an **Owner**.
   - Set **Next Follow-up Date** to today.
   - Change Status to **Contacted** after first contact.
4. Check the **Dashboard** tab for overdue follow-ups count.

### During the day

5. When the hostess receives a phone lead → fill out the **Google Form** (not WhatsApp).
6. When you contact a lead → update **Last Contact Date** and **Next Follow-up Date**.
7. When a lead books → change Status to **Booked**.
8. When a lead is lost → change Status to **Lost** or **Not relevant**.

### End of day (2 minutes)

9. Filter by **Next Follow-up Date = tomorrow** — prepare for tomorrow's calls.
10. Glance at the Dashboard for the day's numbers.

### Weekly (manager)

11. Review the Dashboard: booking rate, leads by source, open leads count.
12. Check for old leads stuck in "Waiting for answer" > 7 days.

---

## Installation Guide (Step by Step)

### 1. Open the existing Paseo spreadsheet

Go to the spreadsheet where FB/IG leads already arrive.

### 2. Open Apps Script

**Extensions → Apps Script**

### 3. Add the script files

Delete the default empty `Code.gs` content. Then:

- In `Code.gs`, paste the contents of `Code.gs` from this repository.
- Click `+` → Script → name it `WebApp` → paste `WebApp.gs`.
- Click `+` → Script → name it `FormHandler` → paste `FormHandler.gs`.

### 4. Run the setup

- In the function dropdown (top bar), select `setupCRM`.
- Click the ▶ Run button.
- Authorize when prompted (review permissions → allow).
- Wait for the "CRM setup complete" popup.

### 5. Deploy the Web App (for Make.com)

- **Deploy → New deployment**
- Type: Web app
- Execute as: Me
- Who has access: Anyone
- Click **Deploy** → copy the URL.
- Save this URL — you'll paste it into Make.com scenarios.

### 6. Create the Google Form

Follow the instructions in the "Google Form for the Hostess" section above.

### 7. Set up Make.com email scenarios

Create Scenarios A and B as described above.

---

## Migration Notes (for the future)

This Google Sheets CRM is designed to be easy to migrate to Airtable, HubSpot, or another tool:

| Aspect | Migration-ready design |
|--------|----------------------|
| **Lead ID format** | `PSO-YYYYMMDD-NNNN` — unique, portable, can be imported as-is |
| **Normalized phone** | Standard `+972` format — universal key for dedup |
| **Statuses** | Simple English values — map directly to any CRM pipeline |
| **Sources** | Consistent snake_case keys — easy to map |
| **Raw payload** | Original data preserved — nothing is lost |
| **Make.com** | Scenarios POST to a URL — just change the URL to the new CRM's API |
| **Google Form** | Can be replaced with the new CRM's form, or kept with a new webhook target |

### Migration steps (when the time comes)

1. Export Master Leads as CSV.
2. Import into the new CRM, mapping columns.
3. Update Make.com scenario URLs to point to the new CRM's API.
4. Update the Google Form trigger to write to the new CRM.
5. Keep the Google Sheet as a read-only archive.

---

## File Reference

| File | Purpose |
|------|---------|
| `Code.gs` | Main setup script: creates tabs, columns, dropdowns, formatting, dashboard. Contains `addLead()`, `NORMALIZE_PHONE()`, `CHECK_DUPLICATE()`, `FIND_ORIGINAL_LEAD()`. |
| `WebApp.gs` | Web app with `doPost()` — endpoint for Make.com to send leads via HTTP. |
| `FormHandler.gs` | `onHostessFormSubmit()` — trigger that processes Google Form responses and writes to Master Leads. Optional WhatsApp notification. |
| `README.md` | This file — full blueprint and documentation. |

---

## What to automate now vs. later

### Now (Phase 1)
- ✅ Master Leads tab structure with dropdowns and formatting
- ✅ Google Form for hostess leads → auto-insert into Master Leads
- ✅ Make.com scenario for Call Event emails → Master Leads
- ✅ Make.com scenario for Website emails → Master Leads
- ✅ Duplicate detection by phone number
- ✅ Dashboard with live counters

### Later (Phase 2)
- ⬜ Add FB/IG leads to Master Leads (add a POST step to existing Make.com scenarios)
- ⬜ WhatsApp notifications for new leads (via Make.com webhook from FormHandler.gs)
- ⬜ Auto-reminder for overdue follow-ups (time-driven trigger in Apps Script)
- ⬜ Email parsing improvement (once you have email samples, refine regex in Make.com)
- ⬜ Team performance tracking in Dashboard (leads per owner, response time)
- ⬜ Migration to Airtable/HubSpot if volume grows beyond ~200 leads/month
