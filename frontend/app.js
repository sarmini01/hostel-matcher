// ============================================================
// app.js — RoomieMatch Frontend
// ============================================================

// ── API Base URL ────────────────────────────────────────────
// ALWAYS use the absolute URL pointing to the Express server.
// The Express server serves this frontend at http://localhost:5000
// so both the page and the API are on the same origin.
// Do NOT change this unless you deploy to a different host.
const API_BASE = "http://localhost:5000/api";

// ── App State ─────────────────────────────────────────────
let currentUser = null;
let authToken   = null;
let allUsers    = [];
let connections = new Set();

// ── Interest options ───────────────────────────────────────
const INTERESTS = [
  "Music","Movies","Reading","Gaming","Cooking","Fitness",
  "Yoga","Travel","Art","Coding","Cricket","Football",
  "Photography","Chess","Nature","Drama","Dancing","Cycling",
];

// ════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  authToken = localStorage.getItem("rm_token");
  const saved = localStorage.getItem("rm_user");

  if (authToken && saved) {
    try {
      currentUser = JSON.parse(saved);
      fetchProfile()
        .then(() => showPage("page-dashboard"))
        .catch(() => logout());
    } catch (e) {
      logout();
    }
  } else {
    showPage("page-splash");
  }

  buildInterestGrid("interestsGrid", []);
  buildInterestGrid("editInterestsGrid", []);

  const bioEl = document.getElementById("rBio");
  if (bioEl) bioEl.addEventListener("input", updateCharCount);

  document.addEventListener("click", function(e) {
    if (!e.target.closest(".nav-actions")) {
      const dd = document.getElementById("navDropdown");
      if (dd) dd.classList.add("hidden");
    }
  });

  checkDbStatus();
});

// ════════════════════════════════════════════════════════════
//  PAGE ROUTING
// ════════════════════════════════════════════════════════════
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(function(p) {
    p.classList.remove("active");
  });
  const page = document.getElementById(pageId);
  if (page) page.classList.add("active");
  window.scrollTo(0, 0);

  if (pageId === "page-dashboard") {
    populateDashboard();
    loadUsers();
    checkDbStatus();
  }
}

// ════════════════════════════════════════════════════════════
//  DB STATUS
// ════════════════════════════════════════════════════════════
async function checkDbStatus() {
  const dot  = document.getElementById("dbDot");
  const text = document.getElementById("dbStatusText");
  if (!dot || !text) return;
  try {
    const res  = await fetch(API_BASE + "/health");
    const data = await res.json();
    if (data.status === "ok") {
      dot.className    = "db-dot connected";
      text.textContent = "MongoDB Connected";
    } else {
      dot.className    = "db-dot disconnected";
      text.textContent = "MongoDB Disconnected";
    }
  } catch (e) {
    dot.className    = "db-dot disconnected";
    text.textContent = "Server Offline";
  }
}

// ════════════════════════════════════════════════════════════
//  LOGIN
// ════════════════════════════════════════════════════════════
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errBox   = document.getElementById("loginError");
  const btn      = document.getElementById("loginBtn");

  hideError(errBox);
  setLoading(btn, true);

  try {
    const data = await apiFetch("POST", "/login", { email, password });
    if (!data.success) throw new Error(data.message);

    authToken   = data.token;
    currentUser = data.user;
    localStorage.setItem("rm_token", authToken);
    localStorage.setItem("rm_user",  JSON.stringify(currentUser));

    await fetchProfile();
    showPage("page-dashboard");
    showToast("Welcome back, " + currentUser.name + "!");
  } catch (err) {
    showError(errBox, err.message);
  } finally {
    setLoading(btn, false);
  }
}

// ════════════════════════════════════════════════════════════
//  REGISTER
// ════════════════════════════════════════════════════════════
let regStep = 1;

function nextStep(n) {
  if (n > regStep) {
    if (regStep === 1 && !validateStep1()) return;
    if (regStep === 2 && !validateStep2()) return;
  }
  document.getElementById("step" + regStep).classList.remove("active");
  document.getElementById("step" + n).classList.add("active");
  for (var i = 1; i <= 3; i++) {
    var dot = document.getElementById("sdot" + i);
    dot.classList.remove("active", "done");
    if (i < n) dot.classList.add("done");
    if (i === n) dot.classList.add("active");
  }
  regStep = n;
}

function validateStep1() {
  var name     = document.getElementById("rName").value.trim();
  var age      = document.getElementById("rAge").value;
  var email    = document.getElementById("rEmail").value.trim();
  var password = document.getElementById("rPassword").value;
  var gender   = document.getElementById("rGender").value;
  if (!name)              { showToast("Please enter your full name", "error"); return false; }
  if (!age)               { showToast("Please enter your age", "error"); return false; }
  if (!email)             { showToast("Please enter your email", "error"); return false; }
  if (!password)          { showToast("Please enter a password", "error"); return false; }
  if (password.length<6)  { showToast("Password must be at least 6 characters", "error"); return false; }
  if (!gender)            { showToast("Please select your gender", "error"); return false; }
  return true;
}

function validateStep2() {
  var checks = [
    { id:"rSleep", label:"Sleep schedule" },
    { id:"rStudy", label:"Study time"     },
    { id:"rClean", label:"Cleanliness"    },
    { id:"rNoise", label:"Noise tolerance"},
  ];
  for (var i = 0; i < checks.length; i++) {
    if (!document.getElementById(checks[i].id).value) {
      showToast("Please select your " + checks[i].label, "error");
      return false;
    }
  }
  return true;
}

async function handleRegister(e) {
  e.preventDefault();
  var errBox = document.getElementById("registerError");
  var btn    = document.getElementById("registerBtn");

  var interests = Array.from(
    document.querySelectorAll("#interestsGrid .interest-chip.selected")
  ).map(function(c) { return c.dataset.val; });

  if (interests.length === 0) {
    showToast("Please select at least one interest", "error");
    return;
  }

  hideError(errBox);
  setLoading(btn, true);

  var payload = {
    name:        document.getElementById("rName").value.trim(),
    age:         parseInt(document.getElementById("rAge").value, 10),
    email:       document.getElementById("rEmail").value.trim().toLowerCase(),
    password:    document.getElementById("rPassword").value,
    gender:      document.getElementById("rGender").value,
    sleep:       document.getElementById("rSleep").value,
    cleanliness: document.getElementById("rClean").value,
    noise:       document.getElementById("rNoise").value,
    study:       document.getElementById("rStudy").value,
    interests:   interests,
    department:  document.getElementById("rDept").value.trim(),
    year:        document.getElementById("rYear").value,
    bio:         document.getElementById("rBio").value.trim(),
  };

  console.log("[register] Payload being sent to MongoDB:", payload);

  try {
    var data = await apiFetch("POST", "/register", payload);
    if (!data.success) throw new Error(data.message);

    authToken   = data.token;
    currentUser = data.user;
    localStorage.setItem("rm_token", authToken);
    localStorage.setItem("rm_user",  JSON.stringify(currentUser));

    await fetchProfile();
    showPage("page-dashboard");
    showToast("Account created! Welcome, " + currentUser.name + ".");
  } catch (err) {
    showError(errBox, err.message);
    setLoading(btn, false);
  }
}

// ════════════════════════════════════════════════════════════
//  FETCH PROFILE FROM DB
// ════════════════════════════════════════════════════════════
async function fetchProfile() {
  var data = await apiFetch("GET", "/me");
  if (data.success) {
    currentUser = data.user;
    connections = new Set(
      (currentUser.connections || []).map(function(c) { return c.toString(); })
    );
    localStorage.setItem("rm_user", JSON.stringify(currentUser));
    console.log("[fetchProfile] DB document:", currentUser);
  }
}

// ════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════
function populateDashboard() {
  if (!currentUser) return;
  var u  = currentUser;
  var hr = new Date().getHours();
  var greet = hr < 12 ? "Good Morning" : hr < 17 ? "Good Afternoon" : "Good Evening";

  setText("heroGreet", greet + ", " + u.name + "!");

  var initial = u.name ? u.name.charAt(0).toUpperCase() : "?";
  setText("navAvatarInitial",  initial);
  setText("dashAvatarInitial", initial);
  setText("dashName",   u.name);
  setText("dashDept",   buildDeptStr(u));
  setText("dashBio",    u.bio || "");
  setText("statAge",    u.age || "—");
  setText("statGender", u.gender || "—");
  setText("statConnections", (u.connections || []).length);
  setText("hSleep",  u.sleep       || "—");
  setText("hClean",  u.cleanliness || "—");
  setText("hNoise",  u.noise       || "—");
  setText("hStudy",  u.study       || "—");

  var tagsEl = document.getElementById("profileTags");
  if (tagsEl) {
    tagsEl.innerHTML = (u.interests || []).map(function(t) {
      return '<span class="tag">' + esc(t) + "</span>";
    }).join("");
  }
}

function buildDeptStr(u) {
  var parts = [];
  if (u.department) parts.push(u.department);
  if (u.year)       parts.push(u.year);
  return parts.length ? parts.join(" - ") : "Hostel Member";
}

async function loadUsers() {
  try {
    var data = await apiFetch("GET", "/users");
    if (!data.success) return;
    allUsers = data.users;
    console.log("[loadUsers] Users from DB:", allUsers);
    var cnt = document.getElementById("userCount");
    if (cnt) cnt.textContent = allUsers.length + " member" + (allUsers.length !== 1 ? "s" : "");
    renderUsersGrid(allUsers);
  } catch (err) {
    console.error("[loadUsers]", err.message);
  }
}

function renderUsersGrid(users) {
  var grid = document.getElementById("usersGrid");
  if (!grid) return;
  if (!users.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;padding:2rem;text-align:center">No other users yet.</p>';
    return;
  }
  grid.innerHTML = users.map(function(u) {
    var initial  = u.name ? u.name.charAt(0).toUpperCase() : "?";
    var dept     = buildDeptStr(u);
    var habits   = "Sleep: " + (u.sleep||"?") + "  |  Clean: " + (u.cleanliness||"?") + "  |  Noise: " + (u.noise||"?") + "  |  Study: " + (u.study||"?");
    var tagHtml  = (u.interests||[]).slice(0,4).map(function(i) {
      return '<span class="user-card-tag">' + esc(i) + "</span>";
    }).join("");
    return '<div class="user-card">' +
      '<div class="user-card-top">' +
        '<div class="user-mini-avatar">' + initial + "</div>" +
        '<div>' +
          '<div class="user-card-name">' + esc(u.name) + "</div>" +
          '<div class="user-card-sub">' + esc(dept) + " | Age " + u.age + "</div>" +
        "</div>" +
      "</div>" +
      '<div class="user-card-habits">' + esc(habits) + "</div>" +
      '<div class="user-card-tags">' + tagHtml + "</div>" +
    "</div>";
  }).join("");
}

// ════════════════════════════════════════════════════════════
//  MATCHES
// ════════════════════════════════════════════════════════════
async function findMatches() {
  if (!currentUser) return;
  showPage("page-matches");
  await loadMatchResults();
}

async function loadMatchResults() {
  var dept   = (document.getElementById("filterDept")   || {}).value || "all";
  var year   = (document.getElementById("filterYear")   || {}).value || "all";
  var gender = (document.getElementById("filterGender") || {}).value || "all";
  var userId = currentUser._id || currentUser.id;
  var qs     = "department=" + dept + "&year=" + year + "&gender=" + gender;

  try {
    var data = await apiFetch("GET", "/matches/" + userId + "?" + qs);
    if (!data.success) throw new Error(data.message);
    console.log("[matches] Results:", data.matches);
    renderMatchCards(data.matches);
  } catch (err) {
    showToast("Could not load matches: " + err.message, "error");
  }
}

function applyFilters() { loadMatchResults(); }

function renderMatchCards(matches) {
  var grid = document.getElementById("matchesGrid");
  var noEl = document.getElementById("noMatches");
  if (!grid) return;
  grid.innerHTML = "";

  if (!matches || !matches.length) {
    if (noEl) noEl.classList.remove("hidden");
    return;
  }
  if (noEl) noEl.classList.add("hidden");

  matches.forEach(function(m, idx) {
    var u      = m.user;
    var pct    = m.compatibility;
    var common = m.commonInterests || [];
    var isBest = idx === 0;
    var isConn = connections.has((u._id || "").toString());
    var initial= u.name ? u.name.charAt(0).toUpperCase() : "?";

    var commonHtml = common.length
      ? '<div><div class="ci-label">Common Interests (' + common.length + ')</div>' +
        '<div class="ci-tags">' + common.map(function(i) {
          return '<span class="ci-tag">' + esc(i) + "</span>";
        }).join("") + "</div></div>"
      : '<p style="font-size:.78rem;color:var(--text-muted)">No common interests.</p>';

    var bioHtml = u.bio
      ? '<p style="font-size:.8rem;color:var(--text-secondary);font-style:italic">"' + esc(u.bio) + '"</p>'
      : "";

    var card = document.createElement("div");
    card.className = "match-card" + (isBest ? " best" : "");
    card.style.animationDelay = (idx * 0.12) + "s";

    card.innerHTML =
      '<div class="match-card-header">' +
        (isBest ? '<span class="best-label">Best Match</span>' : "") +
        '<div class="match-avatar">' + initial + "</div>" +
        '<div class="match-info">' +
          '<h3>' + esc(u.name) + "</h3>" +
          '<div class="match-sub">' + esc(buildDeptStr(u)) + "</div>" +
          '<div class="match-sub">Age ' + u.age + " | " + esc(u.gender) + "</div>" +
        "</div>" +
      "</div>" +
      '<div class="match-card-body">' +
        '<div>' +
          '<div class="compat-label"><span>Compatibility</span>' +
          '<span class="compat-pct">' + pct + '%</span></div>' +
          '<div class="compat-bar"><div class="compat-fill" id="bar_' + u._id + '" style="width:0%"></div></div>' +
        "</div>" +
        commonHtml +
        '<div><div class="ci-label">Habits</div>' +
        '<div class="match-habits">' +
          '<div class="mh-row"><b>Sleep: </b>'  + esc(u.sleep||"N/A")       + "</div>" +
          '<div class="mh-row"><b>Clean: </b>'  + esc(u.cleanliness||"N/A") + "</div>" +
          '<div class="mh-row"><b>Noise: </b>'  + esc(u.noise||"N/A")       + "</div>" +
          '<div class="mh-row"><b>Study: </b>'  + esc(u.study||"N/A")       + "</div>" +
        "</div></div>" +
        bioHtml +
        '<button class="connect-btn' + (isConn ? " connected" : "") + '" ' +
          'id="cbtn_' + u._id + '" ' +
          'onclick="handleConnect(\'' + u._id + '\', this)">' +
          (isConn ? "Connected" : "Connect") +
        "</button>" +
      "</div>";

    grid.appendChild(card);
    setTimeout(function() {
      var bar = document.getElementById("bar_" + u._id);
      if (bar) bar.style.width = pct + "%";
    }, 100 + idx * 120);
  });
}

// ════════════════════════════════════════════════════════════
//  CONNECT
// ════════════════════════════════════════════════════════════
async function handleConnect(targetId, btn) {
  try {
    var data = await apiFetch("POST", "/connect/" + targetId, {});
    if (!data.success) throw new Error(data.message);
    if (data.connected) {
      connections.add(targetId);
      btn.textContent = "Connected";
      btn.classList.add("connected");
    } else {
      connections.delete(targetId);
      btn.textContent = "Connect";
      btn.classList.remove("connected");
    }
    showToast(data.message);
    await fetchProfile();
    setText("statConnections", (currentUser.connections || []).length);
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

// ════════════════════════════════════════════════════════════
//  EDIT PROFILE
// ════════════════════════════════════════════════════════════
function showEditProfile() {
  if (!currentUser) return;
  var u = currentUser;
  setVal("eName", u.name        || "");
  setVal("eAge",  u.age         || "");
  setVal("eDept", u.department  || "");
  setVal("eYear", u.year        || "");
  setVal("eBio",  u.bio         || "");
  preSelectToggle("etgSleep",  u.sleep,       "eSleep");
  preSelectToggle("etgClean",  u.cleanliness, "eClean");
  preSelectToggle("etgNoise",  u.noise,       "eNoise");
  preSelectToggle("etgStudy",  u.study,       "eStudy");
  buildInterestGrid("editInterestsGrid", u.interests || []);
  document.getElementById("editModal").classList.remove("hidden");
  document.getElementById("navDropdown").classList.add("hidden");
}

function hideEditProfile() {
  document.getElementById("editModal").classList.add("hidden");
}

async function saveProfile() {
  var errBox = document.getElementById("editError");
  hideError(errBox);
  var interests = Array.from(
    document.querySelectorAll("#editInterestsGrid .interest-chip.selected")
  ).map(function(c) { return c.dataset.val; });

  var payload = {
    name:        document.getElementById("eName").value.trim(),
    age:         parseInt(document.getElementById("eAge").value, 10),
    department:  document.getElementById("eDept").value.trim(),
    year:        document.getElementById("eYear").value,
    bio:         document.getElementById("eBio").value.trim(),
    sleep:       document.getElementById("eSleep").value,
    cleanliness: document.getElementById("eClean").value,
    noise:       document.getElementById("eNoise").value,
    study:       document.getElementById("eStudy").value,
    interests:   interests,
  };

  try {
    var data = await apiFetch("PUT", "/profile", payload);
    if (!data.success) throw new Error(data.message);
    currentUser = data.user;
    localStorage.setItem("rm_user", JSON.stringify(currentUser));
    hideEditProfile();
    populateDashboard();
    showToast("Profile saved to MongoDB.");
  } catch (err) {
    showError(errBox, err.message || "Update failed.");
  }
}

// ════════════════════════════════════════════════════════════
//  LOGOUT
// ════════════════════════════════════════════════════════════
function logout() {
  localStorage.removeItem("rm_token");
  localStorage.removeItem("rm_user");
  authToken   = null;
  currentUser = null;
  allUsers    = [];
  connections = new Set();
  showPage("page-splash");
  showToast("Logged out.");
}

// ════════════════════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════════════════════
function selectToggle(groupId, btn, hiddenId) {
  document.querySelectorAll("#" + groupId + " .toggle-btn").forEach(function(b) {
    b.classList.remove("selected");
  });
  btn.classList.add("selected");
  document.getElementById(hiddenId).value = btn.dataset.val;
}

function preSelectToggle(groupId, value, hiddenId) {
  document.querySelectorAll("#" + groupId + " .toggle-btn").forEach(function(b) {
    b.classList.remove("selected");
    if (b.dataset.val === value) {
      b.classList.add("selected");
      document.getElementById(hiddenId).value = value;
    }
  });
}

function togglePass(inputId, btn) {
  var input = document.getElementById(inputId);
  if (input.type === "password") { input.type = "text"; btn.textContent = "Hide"; }
  else                           { input.type = "password"; btn.textContent = "Show"; }
}

function toggleDropdown() {
  document.getElementById("navDropdown").classList.toggle("hidden");
}

function updateCharCount() {
  var bioEl = document.getElementById("rBio");
  var cntEl = document.getElementById("bioCharCount");
  if (bioEl && cntEl) cntEl.textContent = bioEl.value.length;
}

function buildInterestGrid(containerId, selectedList) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var sel = new Set(selectedList);
  container.innerHTML = INTERESTS.map(function(interest) {
    var isSelected = sel.has(interest);
    return '<span class="interest-chip' + (isSelected ? " selected" : "") + '" ' +
           'data-val="' + interest + '" onclick="toggleInterest(this)">' +
           esc(interest) + "</span>";
  }).join("");
}

function toggleInterest(chip) { chip.classList.toggle("selected"); }

function setLoading(btn, loading) {
  btn.disabled = loading;
  var t = btn.querySelector(".btn-text");
  var l = btn.querySelector(".btn-loader");
  if (t) t.classList.toggle("hidden", loading);
  if (l) l.classList.toggle("hidden", !loading);
}

function showError(el, msg) { if (el) { el.textContent = msg; el.classList.remove("hidden"); } }
function hideError(el)      { if (el) el.classList.add("hidden"); }

var _toastTimer = null;
function showToast(msg, type) {
  var el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className   = "toast" + (type ? " " + type : "");
  el.classList.remove("hidden");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { el.classList.add("hidden"); }, 3500);
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = (val !== null && val !== undefined) ? val : "";
}
function setVal(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = (val !== null && val !== undefined) ? val : "";
}
function esc(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ════════════════════════════════════════════════════════════
//  SINGLE API FETCH FUNCTION
//  One function handles ALL requests.
//  Clear error messages for every failure type.
// ════════════════════════════════════════════════════════════
async function apiFetch(method, path, body) {
  var url = API_BASE + path;

  var options = {
    method:  method,
    headers: { "Content-Type": "application/json" },
  };

  // Attach JWT token if we have one
  if (authToken) {
    options.headers["Authorization"] = "Bearer " + authToken;
  }

  // Attach body for POST/PUT
  if (body !== undefined && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  var res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    // fetch() itself threw — server is not running or unreachable
    console.error("[apiFetch] Network error on " + method + " " + url, networkErr);
    throw new Error(
      "Cannot reach the server at " + API_BASE + ". " +
      "Make sure you started the backend with: cd backend && node server.js"
    );
  }

  var data;
  try {
    data = await res.json();
  } catch (parseErr) {
    throw new Error("Server returned invalid response (HTTP " + res.status + ")");
  }

  // For auth errors throw with server message
  if (res.status === 401) {
    throw new Error(data.message || "Not authenticated. Please log in again.");
  }

  return data;
}
