// =====================================================================
// 1. CONFIGURATION
// Paste your API Gateway Invoke URL here (no slash at the end).
// =====================================================================
const API_BASE_URL = "https://3nuac0f5cl.execute-api.us-east-1.amazonaws.com/prod";

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
  
  // Attach Cognito Token if logged in
  if (idToken) {
    options.headers["Authorization"] = idToken;
  }
  
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
    
    // Reset appointment form toggle state
    document.getElementById("bookAppointmentForm").style.display = "none";
    document.getElementById("showBookApptBtn").style.display = "inline-block";
    
    const apptsList = document.getElementById("appointmentsList");
    apptsList.innerHTML = "<li>Loading appointments...</li>";
    try {
      const appointments = await callApi("GET", `${endpoint(id)}/appointments`);
      if (appointments.length === 0) {
        apptsList.innerHTML = "<li style='color: var(--muted);'>No appointments scheduled.</li>";
      } else {
        apptsList.innerHTML = "";
        for (const apt of appointments) {
          const li = document.createElement("li");
          li.style.marginBottom = "8px";
          li.style.padding = "10px";
          li.style.background = "var(--bg)";
          li.style.borderRadius = "6px";
          li.style.display = "flex";
          li.style.justifyContent = "space-between";
          li.style.alignItems = "center";
          
          const textDiv = document.createElement("div");
          textDiv.innerHTML = `<strong>${apt.appointmentDate}</strong> <br/> ${apt.reason || "General appointment"}`;
          
          const delBtn = document.createElement("button");
          delBtn.textContent = "Cancel";
          delBtn.className = "danger";
          delBtn.style.padding = "6px 12px";
          delBtn.style.fontSize = "0.85rem";
          
          delBtn.addEventListener("click", async () => {
              if (!confirm(`Cancel appointment on ${apt.appointmentDate}?`)) return;
              withBusy(delBtn, async () => {
                  await callApi("DELETE", `${endpoint(id)}/appointments/${encodeURIComponent(apt.appointmentDate)}`);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  showMessage(`Appointment on ${apt.appointmentDate} canceled.`);
                  li.remove();
                  if (apptsList.children.length === 0) {
                     apptsList.innerHTML = "<li style='color: var(--muted);'>No appointments scheduled.</li>";
                  }
              });
          });
          
          li.appendChild(textDiv);
          li.appendChild(delBtn);
          apptsList.appendChild(li);
        }
      }
    } catch (err) {
      apptsList.innerHTML = "<li style='color: var(--danger);'>Could not load appointments.</li>";
    }
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
// BOOK APPOINTMENT (POST /patients/{id}/appointments)
// =====================================================================
document.getElementById("showBookApptBtn").addEventListener("click", () => {
  document.getElementById("bookAppointmentForm").style.display = "flex";
  document.getElementById("showBookApptBtn").style.display = "none";
});

document.getElementById("bookAppointmentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  withBusy(event.submitter, async () => {
    const id = currentRecord[KEY_FIELD];
    const date = document.getElementById("new-appt-date").value;
    const reason = document.getElementById("new-appt-reason").value.trim();
    
    await callApi("POST", `${endpoint(id)}/appointments`, { appointmentDate: date, reason: reason });
    
    // Scroll to the top so the user can actually see the green success message!
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showMessage(`Appointment booked for ${date}.`);
    form.reset();
    
    // Hide form and show button again
    document.getElementById("bookAppointmentForm").style.display = "none";
    document.getElementById("showBookApptBtn").style.display = "inline-block";
    
    // Smoothly refresh just the appointments list without reloading the whole patient panel
    const apptsList = document.getElementById("appointmentsList");
    apptsList.innerHTML = "<li>Loading new appointment...</li>";
    try {
      const appointments = await callApi("GET", `${endpoint(id)}/appointments`);
      apptsList.innerHTML = "";
      for (const apt of appointments) {
        const li = document.createElement("li");
        li.style.marginBottom = "8px";
        li.style.padding = "10px";
        li.style.background = "var(--bg)";
        li.style.borderRadius = "6px";
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        
        const textDiv = document.createElement("div");
        textDiv.innerHTML = `<strong>${apt.appointmentDate}</strong> <br/> ${apt.reason || "General appointment"}`;
        
        const delBtn = document.createElement("button");
        delBtn.textContent = "Cancel";
        delBtn.className = "danger";
        delBtn.style.padding = "6px 12px";
        delBtn.style.fontSize = "0.85rem";
        
        delBtn.addEventListener("click", async () => {
            if (!confirm(`Cancel appointment on ${apt.appointmentDate}?`)) return;
            withBusy(delBtn, async () => {
                await callApi("DELETE", `${endpoint(id)}/appointments/${encodeURIComponent(apt.appointmentDate)}`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                showMessage(`Appointment on ${apt.appointmentDate} canceled.`);
                li.remove();
                if (apptsList.children.length === 0) {
                   apptsList.innerHTML = "<li style='color: var(--muted);'>No appointments scheduled.</li>";
                }
            });
        });
        
        li.appendChild(textDiv);
        li.appendChild(delBtn);
        apptsList.appendChild(li);
      }
    } catch (err) {
      apptsList.innerHTML = "<li style='color: var(--danger);'>Could not load appointments.</li>";
    }
  });
});

// =====================================================================
// WARD DASHBOARD (GET /wards/{ward}/patients)
// =====================================================================
document.getElementById("wardForm").addEventListener("submit", (event) => {
  event.preventDefault();
  withBusy(event.submitter, async () => {
    const ward = document.getElementById("searchWard").value;
    const url = `${API_BASE_URL}/wards/${encodeURIComponent(ward)}/patients`;
    
    document.getElementById("wardResults").innerHTML = "<p>Loading patients...</p>";
    
    try {
      const patients = await callApi("GET", url);
      const resultsDiv = document.getElementById("wardResults");
      
      if (patients.length === 0) {
        resultsDiv.innerHTML = `<p style='color: var(--muted);'>No patients currently in ${ward}.</p>`;
      } else {
        let html = `<ul style='list-style-type: none; padding: 0;'>`;
        for (const p of patients) {
          html += `<li style='padding: 12px; border-bottom: 1px solid var(--line); margin-bottom: 8px; background: var(--bg); border-radius: 6px;'>
                     <strong>${p.patientId}</strong>: ${p.firstName} ${p.lastName} <br/>
                     <small style='color: var(--muted);'>Status: ${p.status} | Diagnosis: ${p.primaryDiagnosis}</small>
                   </li>`;
        }
        html += `</ul>`;
        resultsDiv.innerHTML = html;
      }
    } catch (err) {
      document.getElementById("wardResults").innerHTML = `<p style='color: var(--danger);'>Error: ${err.message}</p>`;
    }
  });
});

// =====================================================================
// 8. START-UP CHECK
// =====================================================================
if (API_BASE_URL.includes("YOUR-API-ID")) {
  showMessage("Set API_BASE_URL at the top of app.js to your API Gateway Invoke URL.", "error");
}

// =====================================================================
// 9. COGNITO AUTHENTICATION
// =====================================================================
const COGNITO_DOMAIN = "https://us-east-1zwwgmz239.auth.us-east-1.amazoncognito.com";
const CLIENT_ID = "34gi60mb92uausj83u89j7pqof";
const REDIRECT_URI = "https://d1w9ujpst900kk.cloudfront.net";
const LOGIN_URL = `${COGNITO_DOMAIN}/login?client_id=${CLIENT_ID}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

let idToken = localStorage.getItem("idToken");

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (Math.floor(Date.now() / 1000) >= payload.exp);
  } catch (e) {
    return true;
  }
}

async function handleAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  if (code) {
    // Exchange the authorization code for tokens
    const tokenUrl = `${COGNITO_DOMAIN}/oauth2/token`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code: code,
      redirect_uri: REDIRECT_URI
    });
    
    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      });
      const data = await response.json();
      if (data.id_token) {
        idToken = data.id_token;
        localStorage.setItem("idToken", idToken);
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      console.error("Error exchanging token", e);
    }
  }

  // Check if token is valid or expired
  if (idToken && isTokenExpired(idToken)) {
    localStorage.removeItem("idToken");
    idToken = null;
  }
  
  const authContainer = document.getElementById("authContainer");
  const mainApp = document.getElementById("mainApp");
  const loggedOutContainer = document.getElementById("loggedOutContainer");
  const mainHeader = document.getElementById("mainHeader");

  const LOGOUT_URL = `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${encodeURIComponent(REDIRECT_URI)}`;

  if (idToken) {
    // Logged In State
    if (authContainer) authContainer.innerHTML = `<button id="logoutBtn" class="secondary" style="margin:0;">Sign out</button>`;
    if (mainApp) mainApp.style.display = "block";
    if (mainHeader) mainHeader.style.display = "block";
    if (loggedOutContainer) loggedOutContainer.style.display = "none";
    
    document.getElementById("logoutBtn").addEventListener("click", () => {
      localStorage.removeItem("idToken");
      idToken = null;
      window.location.replace(LOGOUT_URL);
    });
  } else {
    // Logged Out State
    if (mainApp) mainApp.style.display = "none";
    if (mainHeader) mainHeader.style.display = "none";
    if (loggedOutContainer) {
      loggedOutContainer.style.display = "flex";
      document.getElementById("splashLoginBtn").addEventListener("click", () => {
        window.location.href = LOGIN_URL;
      });
    }
  }
}

// Call on startup
handleAuth();
