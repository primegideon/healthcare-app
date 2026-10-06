// =====================================================================
// 1. CONFIGURATION
// Paste your API Gateway Invoke URL here (no slash at the end).
// =====================================================================
const API_BASE_URL = "https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod";

// Track settings: this block is the ONLY part of app.js that differs
// between the Healthcare, Finance and HR versions of the project.
const RESOURCE = "patients";        // API path: /patients
const KEY_FIELD = "patientId";     // DynamoDB partition key
const ENTITY = "Patient";
const FIELDS = [
  { id: "firstName", label: "First name", type: "text" },
  { id: "lastName", label: "Last name", type: "text" },
  { id: "dateOfBirth", label: "Date of birth", type: "date" },
  { id: "bloodType", label: "Blood type", type: "select" },
  { id: "primaryDiagnosis", label: "Primary diagnosis", type: "text" },
  { id: "attendingPhysician", label: "Attending physician", type: "text" },
  { id: "ward", label: "Ward", type: "select" },
  { id: "admissionDate", label: "Admission date", type: "date" },
  { id: "status", label: "Status", type: "select" },
  { id: "weightKg", label: "Weight (kg)", type: "number", unit: "kg" },
];

// =====================================================================
// 2. HELPERS
// =====================================================================
let currentRecord = null;

function endpoint(id) {
  const base = `${API_BASE_URL}/${RESOURCE}`;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

// One function for every API call. Throws an Error with the API's message
// so every caller can show it to the user.
async function callApi(method, url, body) {
  const options = { method, headers: { "Content-Type": "application/json" } };
  if (body) options.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    throw new Error("Could not reach the API. Check API_BASE_URL in app.js and that CORS is enabled and deployed.");
  }
  let data = {};
  try { data = await response.json(); } catch (ignored) { /* empty body */ }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }
  return data;
}

// Reads the form inputs whose ids start with a prefix ("new-" or "edit-").
function readForm(prefix) {
  const record = {};
  for (const field of FIELDS) {
    const input = document.getElementById(prefix + field.id);
    const raw = input ? input.value.trim() : "";
    if (raw === "") continue;
    record[field.id] = field.type === "number" ? Number(raw) : raw;
  }
  return record;
}

function formatValue(field, value, record) {
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "number") {
    const number = Number(value).toLocaleString(undefined, {
      minimumFractionDigits: field.unit ? 1 : 2,
      maximumFractionDigits: 2,
    });
    if (field.unit) return `${number} ${field.unit}`;
    const currency = field.currency || (field.currencyField && record[field.currencyField]);
    return currency ? `${currency} ${number}` : number;
  }
  return String(value);
}

function showMessage(text, type = "success") {
  const box = document.createElement("div");
  box.className = `message ${type}`;
  box.textContent = text;          // textContent, never innerHTML: blocks script injection
  const holder = document.getElementById("messages");
  holder.prepend(box);
  setTimeout(() => box.remove(), 6000);
}

// Disables a button while a request runs so it can't be clicked twice.
async function withBusy(button, task) {
  button.disabled = true;
  try { await task(); }
  catch (error) { showMessage(error.message, "error"); }
  finally { button.disabled = false; }
}

// =====================================================================
// 3. SHOW A RECORD
// =====================================================================
function showRecord(record) {
  currentRecord = record;
  const list = document.getElementById("details");
  list.replaceChildren();

  const rows = [{ id: KEY_FIELD, label: "ID" }, ...FIELDS,
                { id: "createdAt", label: "Created" }, { id: "updatedAt", label: "Last updated" }];
  for (const field of rows) {
    if (record[field.id] === undefined) continue;
    const dt = document.createElement("dt");
    dt.textContent = field.label;
    const dd = document.createElement("dd");
    dd.textContent = formatValue(field, record[field.id], record);
    list.append(dt, dd);
  }

  document.getElementById("detailsTitle").textContent =
    `${record.firstName || ""} ${record.lastName || ""} (${record[KEY_FIELD]})`;
  document.getElementById("editForm").hidden = true;
  document.getElementById("details").hidden = false;
  document.getElementById("detailsPanel").hidden = false;
}

// =====================================================================
// 4. CREATE (POST /patients)
// =====================================================================
document.getElementById("createForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  withBusy(event.submitter, async () => {
    const record = readForm("new-");
    record[KEY_FIELD] = document.getElementById("new-" + KEY_FIELD).value.trim().toUpperCase();
    await callApi("POST", endpoint(), record);
    showMessage(`${ENTITY} ${record[KEY_FIELD]} added.`);
    form.reset();
  });
});

// =====================================================================
// 5. READ (GET /patients/{id})
// =====================================================================
document.getElementById("searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  withBusy(event.submitter, async () => {
    const id = document.getElementById("searchId").value.trim().toUpperCase();
    document.getElementById("detailsPanel").hidden = true;
    const record = await callApi("GET", endpoint(id));
    showRecord(record);
  });
});

// =====================================================================
// 6. UPDATE (PUT /patients/{id})
// =====================================================================
document.getElementById("editButton").addEventListener("click", () => {
  for (const field of FIELDS) {
    const input = document.getElementById("edit-" + field.id);
    if (input) input.value = currentRecord[field.id] ?? "";
  }
  document.getElementById("details").hidden = true;
  document.getElementById("editForm").hidden = false;
});

document.getElementById("cancelEdit").addEventListener("click", () => showRecord(currentRecord));

document.getElementById("editForm").addEventListener("submit", (event) => {
  event.preventDefault();
  withBusy(event.submitter, async () => {
    const id = currentRecord[KEY_FIELD];
    const result = await callApi("PUT", endpoint(id), readForm("edit-"));
    showRecord(result.record);
    showMessage(`${ENTITY} ${id} updated.`);
  });
});

// =====================================================================
// 7. DELETE (DELETE /patients/{id})
// =====================================================================
document.getElementById("deleteButton").addEventListener("click", (event) => {
  const id = currentRecord[KEY_FIELD];
  if (!confirm(`Delete ${ENTITY.toLowerCase()} ${id}? This cannot be undone.`)) return;
  withBusy(event.currentTarget, async () => {
    await callApi("DELETE", endpoint(id));
    document.getElementById("detailsPanel").hidden = true;
    currentRecord = null;
    showMessage(`${ENTITY} ${id} deleted.`);
  });
});

// =====================================================================
// 8. START-UP CHECK
// =====================================================================
if (API_BASE_URL.includes("YOUR-API-ID")) {
  showMessage("Set API_BASE_URL at the top of app.js to your API Gateway Invoke URL.", "error");
}
