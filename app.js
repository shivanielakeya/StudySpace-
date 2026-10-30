const STORAGE_KEY = "studyspace-data-v1";
const BASE_INTERVALS = [1, 3, 7, 15, 30];
const LEVELS = ["Need to Relearn", "Basic Understanding", "Understand Well", "Interview Ready"];
const STATUS_OPTIONS = ["Learning", "To review", "Completed"];
const DEFAULT_SUBJECTS = ["Python", "SQL", "Statistics", "Excel", "Power BI", "Machine Learning"];
let authUser = null;
let profile = null;
let authMode = (() => {
  const queryMode = new URLSearchParams(window.location.search).get("mode");
  if (queryMode === "invite" || queryMode === "recovery") return queryMode;
  const hashType = new URLSearchParams(window.location.hash.slice(1)).get("type");
  return hashType === "invite" || hashType === "recovery" ? hashType : "";
})();
let authNotice = "";
let accountLoading = false;
let accountLoaded = false;
let accountLoadVersion = 0;
let hasCloudData = false;
let persistenceBusy = false;
let legacyData = null;
let legacyDataError = "";
let legacyBackupDownloaded = false;
let legacyBackupConfirmed = false;
let legacyOverwriteConfirmed = false;
let migrationInProgress = false;
const iconPaths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-.1-.1-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z" transform="translate(-1 -1)"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  flame: '<path d="M12 22c4.4 0 7-3.1 7-7 0-3.2-2-5.4-4.2-7.4.2 2-1 3.2-2 3.8C12.8 7.4 10.1 4.8 7 3c.4 4.5-3 7-3 11.5C4 18.8 7.2 22 12 22Z"/><path d="M12 22c-2.2 0-3.5-1.6-3.5-3.4 0-1.6.9-2.4 1.9-3.6.5 1.3 1.6 1.7 2.5 1.9-.3-1.2.2-2 .9-2.8 1.4 1.4 2 2.6 2 4.2 0 2.1-1.6 3.7-3.8 3.7Z"/>',
};
const icon = (name, size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.sparkle}</svg>`;
const iso = (date = new Date()) => {
  const value = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  if (value) return value;
  const parsed = date instanceof Date ? date : new Date(date);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};
const shiftDate = (days, from = new Date()) => {
  const [year, month, day] = iso(from).split("-").map(Number);
  const date = new Date(year, month - 1, day + days, 12);
  return iso(date);
};
const todayISO = () => iso(new Date());
const dayLabel = (days) => `${days} ${days === 1 ? "day" : "days"}`;
const localDate = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};
const fmtDate = (date) => date ? localDate(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Not scheduled";
const dayDiff = (date) => {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Number.POSITIVE_INFINITY;
  const [year, month, day] = date.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = todayISO().split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86400000);
};
const isDateOnly = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const isSafeResourceUrl = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
function initialData() {
  return {
    topics: [],
    subjects: [...DEFAULT_SUBJECTS],
    intervals: [...BASE_INTERVALS],
    dark: false,
    activities: [],
    legacyImportCompletedAt: null,
  };
}
function detectLegacyData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    return validateImport(JSON.parse(saved));
  } catch (error) {
    legacyDataError = error.message || "Saved browser data could not be read.";
    return null;
  }
}
let data = initialData();
let route = "dashboard";
let selectedId = null;
let revisionQueue = [];
let revisionIndex = 0;
let chosenLevel = null;
let revisionNote = "";
let completionSummary = null;
let filters = { search: "", subject: "", status: "", level: "", revision: "", sort: "next" };
let roomTab = "All";
const app = document.querySelector("#app");

async function save() {
  if (persistenceBusy) return false;
  persistenceBusy = true;
  try {
    await StudySpaceData.save(data);
    hasCloudData = true;
    return true;
  } catch {
    toast("Your changes could not be saved. Check your connection and try again.");
    return false;
  } finally {
    persistenceBusy = false;
  }
}
function toast(message) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}
function initials(name, email = "") {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return String(email).slice(0, 2).toUpperCase() || "SS";
}
function avatarMarkup(sizeClass = "") {
  const image = profile?.avatar_url && isSafeResourceUrl(profile.avatar_url)
    ? `<img src="${esc(profile.avatar_url)}" alt="">`
    : esc(initials(profile?.full_name, authUser?.email));
  return `<span class="avatar ${sizeClass}">${image}</span>`;
}
function clearAuthModeFromUrl() {
  window.history.replaceState(null, "", window.location.pathname);
}
function renderAuth(message = authNotice, isError = Boolean(message)) {
  document.body.classList.remove("dark");
  const configured = StudySpaceSupabase.configured;
  if (!configured) isError = true;
  const isRecovery = authMode === "recovery";
  const isInvite = authMode === "invite";
  const isForgot = authMode === "forgot";
  const title = isInvite ? "Set up your account" : isRecovery ? "Choose a new password" : isForgot ? "Reset your password" : "Welcome back";
  const description = isInvite
    ? "Your invitation is ready. Set a password to finish joining StudySpace."
    : isRecovery
      ? "Choose a new password for your StudySpace account."
      : isForgot
        ? "We’ll send a secure password reset link to your email."
        : "Sign in to continue to your private study space.";
  let form = "";
  if (!configured) {
    message = "StudySpace needs a Supabase project URL and publishable key. Configure supabase-config.js, then reload this page.";
  } else if (isInvite && !authUser) {
    form = `<button class="btn btn-primary auth-submit" type="button" data-auth-mode="login">Back to sign in</button>`;
  } else if (isRecovery && !authUser) {
    form = `<p class="auth-invite-note">This password reset link is invalid or has expired. Request a new link to continue.</p>
      <button class="btn btn-primary auth-submit" type="button" data-auth-mode="forgot">Request another reset link</button>
      <button class="text-action auth-back" type="button" data-auth-mode="login">Back to sign in</button>`;
  } else if (isInvite) {
    form = `<form id="invite-form" class="auth-form">
      <label class="form-field"><span>Full name</span><input class="field-control" name="fullName" maxlength="100" autocomplete="name" required value="${esc(authUser?.user_metadata?.full_name || "")}"></label>
      <label class="form-field"><span>Email</span><input class="field-control" type="email" value="${esc(authUser?.email || "")}" disabled></label>
      <label class="form-field"><span>Password</span><input class="field-control" name="password" type="password" minlength="10" autocomplete="new-password" required></label>
      <label class="form-field"><span>Confirm password</span><input class="field-control" name="confirmPassword" type="password" minlength="10" autocomplete="new-password" required></label>
      <button class="btn btn-primary auth-submit" type="submit">Set password and continue</button>
    </form>`;
  } else if (isRecovery) {
    form = `<form id="recovery-form" class="auth-form">
      <label class="form-field"><span>New password</span><input class="field-control" name="password" type="password" minlength="10" autocomplete="new-password" required></label>
      <label class="form-field"><span>Confirm new password</span><input class="field-control" name="confirmPassword" type="password" minlength="10" autocomplete="new-password" required></label>
      <button class="btn btn-primary auth-submit" type="submit">Save new password</button>
    </form>`;
  } else if (isForgot) {
    form = `<form id="forgot-form" class="auth-form">
      <label class="form-field"><span>Email address</span><input class="field-control" name="email" type="email" autocomplete="email" required></label>
      <button class="btn btn-primary auth-submit" type="submit">Send reset link</button>
      <button class="text-action auth-back" type="button" data-auth-mode="login">Back to sign in</button>
    </form>`;
  } else {
    form = `<form id="login-form" class="auth-form">
      <label class="form-field"><span>Email address</span><input class="field-control" name="email" type="email" autocomplete="email" required></label>
      <label class="form-field"><span>Password</span><input class="field-control" name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn btn-primary auth-submit" type="submit">Sign in</button>
      <button class="text-action auth-back" type="button" data-auth-mode="forgot">Forgot password?</button>
      <p class="auth-invite-note">StudySpace is invite-only. Ask your administrator for an invitation; public registration is disabled.</p>
    </form>`;
  }
  app.innerHTML = `<main class="auth-shell"><section class="auth-card">
    <div class="auth-brand"><span class="brand-mark">${icon("book", 18)}</span><div><div class="brand-name">StudySpace</div><div class="brand-caption">your learning, in focus</div></div></div>
    <div class="auth-heading"><h1>${title}</h1><p>${description}</p></div>
    ${message ? `<div class="auth-message ${isError ? "auth-message-error" : "auth-message-success"}" role="${isError ? "alert" : "status"}" aria-live="polite">${esc(message)}</div>` : ""}
    ${configured ? form : ""}
  </section><p class="auth-footer">A calm space for focused learning.</p></main>`;
}
function renderAccountLoading() {
  app.innerHTML = `<main class="auth-shell"><section class="auth-card auth-loading"><div class="brand-mark">${icon("book", 18)}</div><h1>Loading your study space</h1><p>Connecting securely to your account…</p></section></main>`;
}
function renderAccountError(message) {
  accountLoading = false;
  accountLoaded = false;
  app.innerHTML = `<main class="auth-shell"><section class="auth-card"><div class="brand-mark">${icon("book", 18)}</div><h1>Couldn’t load your study space</h1><p class="auth-message auth-message-error" role="alert">${esc(message)}</p><button class="btn btn-primary auth-submit" data-action="retry-account">Try again</button><button class="text-action auth-back" data-action="logout">Sign out</button></section></main>`;
}
function authErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (message.includes("email not confirmed")) return "Confirm your invitation email before signing in.";
  if (message.includes("passwords do not match")) return "The passwords do not match.";
  if (message.includes("enter your full name")) return "Enter your full name to finish setting up the account.";
  if (message.includes("expired")) return "This password link has expired. Request a new link and try again.";
  if (message.includes("password should be")) return "Choose a password with at least 10 characters.";
  if (message.includes("rate limit")) return "Too many attempts. Wait a little and try again.";
  if (message.includes("fetch") || message.includes("network")) return "Could not reach Supabase. Check your connection and project configuration.";
  return "That request could not be completed. Check your details and try again.";
}
async function loadAccount(user) {
  if (accountLoading && authUser?.id === user.id) return;
  accountLoading = true;
  accountLoaded = false;
  authUser = user;
  const version = ++accountLoadVersion;
  renderAccountLoading();
  try {
    const result = await StudySpaceData.load(user.id);
    if (version !== accountLoadVersion) return;
    profile = result.profile;
    data = result.data;
    hasCloudData = result.hasCloudData;
    legacyDataError = "";
    legacyData = detectLegacyData();
    legacyBackupDownloaded = false;
    legacyBackupConfirmed = false;
    legacyOverwriteConfirmed = false;
    accountLoading = false;
    accountLoaded = true;
    authNotice = "";
    authMode = "";
    route = "dashboard";
    render();
  } catch {
    if (version !== accountLoadVersion) return;
    accountLoading = false;
    renderAccountError("Your account is signed in, but the study data could not be loaded. Check your connection and confirm the database migration has been run.");
  }
}
async function handleAuthState(event, session) {
  if (!session?.user) {
    accountLoadVersion += 1;
    accountLoading = false;
    accountLoaded = false;
    authUser = null;
    profile = null;
    hasCloudData = false;
    data = initialData();
    if (event === "PASSWORD_RECOVERY") authMode = "recovery";
    if (authMode !== "invite" && authMode !== "recovery" && authMode !== "forgot") authMode = "login";
    authNotice = authMode === "invite"
      ? "This invitation link is invalid or has expired. Ask the administrator to send a new one."
      : authMode === "recovery" ? "This password reset link is invalid or has expired." : "";
    renderAuth();
    return;
  }
  authUser = session.user;
  if (event === "PASSWORD_RECOVERY") authMode = "recovery";
  if (session.user.invited_at && session.user.user_metadata?.studyspace_password_setup !== true) authMode = "invite";
  if (authMode === "invite" || authMode === "recovery") {
    accountLoaded = false;
    renderAuth();
    return;
  }
  if (accountLoaded && profile?.id === session.user.id) return;
  await loadAccount(session.user);
}
async function initializeAuth() {
  if (!StudySpaceSupabase.configured) {
    authMode = "config";
    renderAuth();
    return;
  }
  StudySpaceAuth.onAuthStateChange((event, session) => {
    queueMicrotask(() => {
      handleAuthState(event, session).catch(() => renderAuth("Your sign-in state could not be refreshed. Reload the page and try again."));
    });
  });
  try {
    const session = await StudySpaceAuth.getSession();
    await handleAuthState("INITIAL_SESSION", session);
  } catch {
    renderAuth("Could not check your session. Check your connection and reload the page.");
  }
}
function levelClass(level) {
  return ({ "Interview Ready": "badge-ready", "Understand Well": "badge-well", "Basic Understanding": "badge-basic", "Need to Relearn": "badge-relearn" })[level] || "badge-basic";
}
function statusClass(status) {
  return ({ Learning: "badge-learning", "To review": "badge-review", Completed: "badge-complete" })[status] || "badge-learning";
}
function levelBadge(level) { return `<span class="badge ${levelClass(level)}">${esc(level || "Not rated")}</span>`; }
function statusBadge(status) { return `<span class="badge ${statusClass(status)}">${esc(status)}</span>`; }
function navButton(id, label, iconName, count = "") {
  const active = route === id || (id === "topics" && route === "detail");
  return `<button class="nav-link ${active ? "active" : ""}" data-route="${id}" aria-label="${label}"><span class="nav-icon">${icon(iconName)}</span><span class="nav-text">${label}</span>${count ? `<span class="nav-count">${count}</span>` : ""}</button>`;
}
function navMarkup(mobile = false) {
  const overdue = dueTopics().filter((topic) => dayDiff(topic.nextRevision) < 0).length;
  const items = [
    navButton("dashboard", "Dashboard", "grid"),
    navButton("topics", "My Topics", "book"),
    navButton("room", "Revision Room", "layers", overdue || ""),
    navButton("progress", "Progress", "chart"),
    navButton("settings", "Settings", "gear"),
  ];
  return mobile ? `<nav class="mobile-nav" aria-label="Mobile navigation">${items.join("")}</nav>` : `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">${icon("book", 18)}</div><div class="brand-copy"><div class="brand-name">StudySpace</div><div class="brand-caption">your learning, in focus</div></div></div>
    <div class="nav-label">Workspace</div><nav class="nav-group" aria-label="Main navigation">${items.slice(0, 3).join("")}</nav>
    <div class="nav-label" style="margin-top:24px">Insights</div><nav class="nav-group" aria-label="Insights navigation">${items.slice(3).join("")}</nav>
    <div class="sidebar-spacer"></div>
    <div class="streak-card"><div class="streak-head"><span>Learning streak</span>${icon("flame", 15)}</div><p><strong>4 days</strong> in a row. Small steps add up — keep going!</p></div>
    <button class="profile profile-link" data-route="settings" aria-label="Open account settings">${avatarMarkup()}<span class="profile-copy"><span class="profile-name">${esc(profile?.full_name || "Your profile")}</span><span class="profile-sub">${esc(authUser?.email || "")}</span></span></button>
  </aside>`;
}
function shell(content) {
  const title = ({ dashboard: "Dashboard", topics: "My Topics", detail: "Topic Details", room: "Revision Room", session: "Revision Session", settings: "Settings", progress: "Learning Progress" })[route] || "Dashboard";
  app.innerHTML = `<div class="app-shell ${data.dark ? "dark" : ""}">${navMarkup()}
    <div class="main-wrap">
      <header class="topbar"><div class="breadcrumbs">StudySpace <span style="color:#c1bdca"> / </span> <strong>${title}</strong></div>
        <div class="topbar-right"><span class="date-pill">${new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span><button class="icon-btn" data-action="theme" aria-label="Toggle theme">${icon(data.dark ? "sun" : "sparkle", 16)}</button><span class="account-email">${esc(authUser?.email || "")}</span>${avatarMarkup()}<button class="btn btn-secondary btn-logout" data-action="logout">Sign out</button></div>
      </header><main class="content">${content}</main>
    </div>${navMarkup(true)}</div>`;
}
function dueTopics() { return data.topics.filter((topic) => topic.nextRevision && topic.status !== "Completed" && dayDiff(topic.nextRevision) <= 0); }
function dueTodayTopics() { return dueTopics().filter((topic) => dayDiff(topic.nextRevision) === 0); }
function weakTopics() { return data.topics.filter((topic) => topic.level === "Need to Relearn" || topic.level === "Basic Understanding"); }
function schedulePriority(a, b) {
  const aDays = dayDiff(a.nextRevision);
  const bDays = dayDiff(b.nextRevision);
  const aGroup = aDays < 0 ? 0 : aDays === 0 ? 1 : 2;
  const bGroup = bDays < 0 ? 0 : bDays === 0 ? 1 : 2;
  return aGroup - bGroup || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || aDays - bDays;
}
function countByStatus(status) { return data.topics.filter((topic) => topic.status === status).length; }
function heading(title, description, actions = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
}
function statCard(label, value, iconName, color, hint = "") {
  return `<div class="card stat-card"><div class="stat-icon ${color}">${icon(iconName, 18)}</div><div><div class="stat-value">${value}</div><div class="stat-label">${label}</div>${hint ? `<div class="stat-hint">${hint}</div>` : ""}</div></div>`;
}
function topicRow(topic, button = true) {
  return `<div class="topic-row"><div class="subject-mark">${esc(topic.subject.slice(0, 2).toUpperCase())}</div><div class="topic-row-main"><div class="topic-row-title">${esc(topic.name)}</div><div class="topic-row-meta">${esc(topic.subject)} · ${levelBadge(topic.level)}</div></div>${button ? `<button class="text-action" data-action="start" data-id="${topic.id}">Revise</button>` : ""}</div>`;
}
function renderDashboard() {
  const total = data.topics.length;
  const completed = countByStatus("Completed");
  const learning = countByStatus("Learning");
  const todayDue = dueTodayTopics();
  const overdue = dueTopics().filter((topic) => dayDiff(topic.nextRevision) < 0);
  const improvement = weakTopics().length;
  const interviewReady = data.topics.filter((topic) => topic.level === "Interview Ready").length;
  const dueItems = [...overdue, ...todayDue].sort(schedulePriority);
  const focus = [...data.topics].filter((topic) => topic.status !== "Completed").sort((a, b) => {
    const aDue = a.nextRevision ? dayDiff(a.nextRevision) : 999999; const bDue = b.nextRevision ? dayDiff(b.nextRevision) : 999999;
    return schedulePriority(a, b) || aDue - bDue;
  })[0];
  const recent = [...data.activities].slice(-3).reverse();
  const firstName = (profile?.full_name || authUser?.email?.split("@")[0] || "there").trim().split(/\s+/)[0];
  shell(`${heading(`Good morning, ${esc(firstName)}`, "Ready to learn something new? Here’s your study space at a glance.", `<button class="btn btn-primary" data-action="add">${icon("plus", 15)} Quick Add Topic</button>`)}
    <section class="stats-grid">
      ${statCard("Total topics", total, "book", "", `${icon("arrow", 10)} Your knowledge library`)}
      ${statCard("Completed topics", completed, "check", "green", `${total ? Math.round(completed / total * 100) : 0}% of your collection`)}
      ${statCard("Currently learning", learning, "layers", "blue", `${data.topics.length - completed} in progress`)}
      ${statCard("Revisions due today", todayDue.length, "calendar", "orange", todayDue.length ? "Ready when you are" : "You're on track")}
      ${statCard("Overdue revisions", overdue.length, "clock", "red", overdue.length ? "Prioritized in your revision room" : "Nothing overdue")}
      ${statCard("Need improvement", improvement, "chart", "orange", "Build stronger recall")}
      ${statCard("Interview ready", interviewReady, "sparkle", "green", "Confident recall")}
    </section>
    <section class="dashboard-grid">
      <div class="stack">
        <div class="card focus-card">
          <div class="focus-top"><div><div class="eyebrow">Today's focus · a little progress goes a long way</div><h2>${focus ? esc(focus.name) : "You’ve covered everything!"}</h2><p>${focus ? `${esc(focus.subject)} · ${focus.nextRevision && dayDiff(focus.nextRevision) <= 0 ? (dayDiff(focus.nextRevision) < 0 ? "Overdue revision" : "Due for a review today") : "Continue building your understanding"}` : "Add a new topic to keep learning."}</p></div>
            ${focus ? `<button class="btn btn-primary" data-action="start" data-id="${focus.id}">Start revision ${icon("arrow", 13)}</button>` : ""}</div>
          <div class="focus-progress"><span style="width:${focus ? (focus.level === "Interview Ready" ? 100 : focus.level === "Understand Well" ? 72 : focus.level === "Basic Understanding" ? 42 : 18) : 0}%"></span></div>
          <div class="focus-foot"><span>${focus ? `${esc(focus.level)} · ${focus.revisionCount} ${focus.revisionCount === 1 ? "revision" : "revisions"} completed` : "You're all caught up"}</span><span>${focus?.nextRevision ? `Next review ${fmtDate(focus.nextRevision)}` : ""}</span></div>
        </div>
        <section class="card due-list"><div class="section-heading"><div><h2 class="section-title">Today's focus list</h2><span class="section-subtitle">${overdue.length ? `${overdue.length} overdue · prioritized first` : "Your revision plan for today"}</span></div><button class="text-action" data-route="room">View revision room ${icon("arrow", 11)}</button></div>
          ${dueItems.length ? dueItems.slice(0, 4).map((topic) => topicRow(topic)).join("") : `<div class="empty-state" style="padding:22px 10px"><h3>All caught up for today</h3><p>Enjoy the clear space, or revisit a topic to keep your momentum.</p></div>`}
        </section>
        <section class="card chart-card"><div class="section-heading"><div><h2 class="section-title">Weekly learning progress</h2><span class="section-subtitle">Revision sessions · last 7 days</span></div><span class="badge badge-learning">${weeklyRevisionCount()} sessions</span></div>${progressChart()}</section>
      </div>
      <div class="stack">
        <section class="card chart-card"><div class="section-heading"><div><h2 class="section-title">Your learning mix</h2><span class="section-subtitle">Progress by subject</span></div></div>${subjectBars()}</section>
        <section class="card activity-card"><div class="section-heading"><div><h2 class="section-title">Needs a little love</h2><span class="section-subtitle">${weakTopics().length} topics with room to grow</span></div></div>
          ${weakTopics().slice(0, 3).map((topic) => `<div class="activity-item"><span class="activity-dot" style="background:${topic.level === "Need to Relearn" ? "var(--red)" : "var(--orange)"}"></span><div><strong>${esc(topic.name)}</strong> · ${levelBadge(topic.level)}<time>${esc(topic.subject)} · review to strengthen recall</time></div></div>`).join("") || `<div class="activity-item">Looking good — no topics need extra attention.</div>`}
        </section>
        <section class="card activity-card"><div class="section-heading"><div><h2 class="section-title">Recent activity</h2><span class="section-subtitle">Your learning journey</span></div></div>
          ${recent.length ? recent.map((entry) => `<div class="activity-item"><span class="activity-dot"></span><div>${esc(entry.text)}<time>${fmtDate(entry.date)}</time></div></div>`).join("") : `<div class="activity-item">Your study milestones will show up here.</div>`}
        </section>
      </div>
    </section>`);
}
function progressChart() {
  const values = weeklyRevisionValues();
  const maximum = Math.max(1, ...values);
  const points = values.map((value, i) => `${36 + i * 92},${119 - (value / maximum) * 74}`).join(" ");
  const area = `36,119 ${points} 588,119`;
  return `<div class="chart-wrap"><svg viewBox="0 0 620 145" role="img" aria-label="Weekly learning trend"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#9479e8" stop-opacity=".2"/><stop offset="1" stop-color="#9479e8" stop-opacity="0"/></linearGradient></defs>
    ${[26,58,90,119].map((y) => `<line x1="34" y1="${y}" x2="594" y2="${y}" stroke="#f0edf5" stroke-dasharray="3 5"/>`).join("")}<polygon points="${area}" fill="url(#chartFill)"/><polyline points="${points}" fill="none" stroke="#8b6be3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${values.map((v, i) => `<circle cx="${36 + i * 92}" cy="${119 - (v / maximum) * 74}" r="3.5" fill="white" stroke="#8b6be3" stroke-width="2"/>`).join("")}
    ${weeklyRevisionDates().map((date, i) => `<text x="${36 + i * 92}" y="139" text-anchor="middle" fill="#aaa6b4" font-size="9">${date.toLocaleDateString(undefined, { weekday: "short" })}</text>`).join("")}</svg></div>`;
}
function weeklyRevisionDates() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
}
function weeklyRevisionValues() {
  const counts = new Map(weeklyRevisionDates().map((date) => [iso(date), 0]));
  data.topics.forEach((topic) => topic.history.forEach((entry) => {
    if (counts.has(entry.date)) counts.set(entry.date, counts.get(entry.date) + 1);
  }));
  return [...counts.values()];
}
function weeklyRevisionCount() {
  return weeklyRevisionValues().reduce((sum, count) => sum + count, 0);
}
function subjectBars() {
  return `<div class="subject-progress">${data.subjects.map((subject, index) => {
    const topics = data.topics.filter((topic) => topic.subject === subject);
    if (!topics.length) return "";
    const percent = Math.round(topics.filter((topic) => topic.level === "Understand Well" || topic.level === "Interview Ready").length / topics.length * 100);
    return `<div class="subject-line"><span>${esc(subject)}</span><div class="bar"><i style="width:${percent}%;opacity:${1 - index * .035}"></i></div><strong>${percent}%</strong></div>`;
  }).join("")}</div>`;
}
function filteredTopics() {
  return data.topics.filter((topic) => {
      const search = filters.search.trim().toLocaleLowerCase();
    const revision = !filters.revision || (filters.revision === "Due" && topic.nextRevision && dayDiff(topic.nextRevision) <= 0) || (filters.revision === "Upcoming" && topic.nextRevision && dayDiff(topic.nextRevision) > 0) || (filters.revision === "No date" && !topic.nextRevision);
    return (!search || `${topic.name} ${topic.subject}`.toLowerCase().includes(search)) && (!filters.subject || topic.subject === filters.subject) &&
      (!filters.status || topic.status === filters.status) && (!filters.level || topic.level === filters.level) && revision;
  });
}
function renderTopics() {
  const cards = filteredTopics();
  shell(`${heading("My Topics", "A growing library of the things you’re learning.", `<button class="btn btn-primary" data-action="add">${icon("plus", 15)} Add new topic</button>`)}
    <div class="card filter-bar">
      <div class="search-input" style="position:relative">${icon("search", 14)}<input class="field-control" style="width:100%;padding-left:34px" placeholder="Search topics..." value="${esc(filters.search)}" data-filter="search" aria-label="Search topics"></div>
      <select class="field-control" data-filter="subject" aria-label="Filter by subject"><option value="">All subjects</option>${data.subjects.map((subject) => `<option ${filters.subject === subject ? "selected" : ""}>${esc(subject)}</option>`).join("")}</select>
      <select class="field-control" data-filter="status" aria-label="Filter by learning status"><option value="">All statuses</option>${STATUS_OPTIONS.map((status) => `<option ${filters.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>
      <select class="field-control" data-filter="level" aria-label="Filter by understanding"><option value="">All understanding</option>${LEVELS.map((level) => `<option ${filters.level === level ? "selected" : ""}>${level}</option>`).join("")}</select>
      <select class="field-control" data-filter="revision" aria-label="Filter by revision status"><option value="">All revisions</option><option ${filters.revision === "Due" ? "selected" : ""}>Due</option><option ${filters.revision === "Upcoming" ? "selected" : ""}>Upcoming</option><option ${filters.revision === "No date" ? "selected" : ""}>No date</option></select>
      <select class="field-control" data-filter="sort" aria-label="Sort topics"><option value="next" ${filters.sort === "next" ? "selected" : ""}>Next revision</option><option value="name" ${filters.sort === "name" ? "selected" : ""}>Topic name</option><option value="recent" ${filters.sort === "recent" ? "selected" : ""}>Recently studied</option><option value="revisions" ${filters.sort === "revisions" ? "selected" : ""}>Revision count</option></select>
    </div>
    <div id="topic-results">${topicResultsMarkup(cards)}</div>`);
}
function topicResultsMarkup(cards) {
  const sorters = {
    next: (a, b) => (a.nextRevision || "9999").localeCompare(b.nextRevision || "9999"),
    name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    recent: (a, b) => (b.lastStudied || "").localeCompare(a.lastStudied || ""),
    revisions: (a, b) => b.revisionCount - a.revisionCount,
  };
  const sorted = [...cards].sort(sorters[filters.sort] || sorters.next);
  return `<div class="section-heading"><h2 class="section-title">${sorted.length} ${sorted.length === 1 ? "topic" : "topics"}</h2><span class="section-subtitle">Sorted by ${{ next: "next revision", name: "topic name", recent: "recently studied", revisions: "revision count" }[filters.sort] || "next revision"}</span></div>
    ${sorted.length ? `<section class="topic-grid">${sorted.map(topicCard).join("")}</section>` : `<div class="card empty-state">${icon("search",24)}<h3>No matching topics</h3><p>Try changing your filters or add a new topic.</p><button class="btn btn-primary" data-action="add">${icon("plus",14)} Add a topic</button></div>`}`;
}
function topicCard(topic) {
  const revisionText = topic.nextRevision ? (dayDiff(topic.nextRevision) < 0 ? `${Math.abs(dayDiff(topic.nextRevision))}d overdue` : dayDiff(topic.nextRevision) === 0 ? "Due today" : fmtDate(topic.nextRevision)) : "Not scheduled";
  return `<article class="card topic-card" data-action="detail" data-id="${topic.id}" tabindex="0" role="button" aria-label="Open ${esc(topic.name)}">
    <div class="topic-card-head">${statusBadge(topic.status)}<span class="section-subtitle">${icon("calendar",11)} ${revisionText}</span></div>
    <h3>${esc(topic.name)}</h3><div class="topic-card-subject">${esc(topic.subject)}</div>
    <div style="margin-top:10px">${levelBadge(topic.level)}</div>
    <div class="topic-card-metas"><div><div class="meta-label">Last studied</div><div class="meta-value">${fmtDate(topic.lastStudied)}</div></div><div><div class="meta-label">Next revision</div><div class="meta-value">${fmtDate(topic.nextRevision)}</div></div></div>
    <div class="topic-card-foot"><span class="section-subtitle">${topic.revisionCount} ${topic.revisionCount === 1 ? "revision" : "revisions"}</span><button class="text-action" data-action="detail" data-id="${topic.id}">View details ${icon("arrow",11)}</button></div>
  </article>`;
}
function renderRoom() {
  const allDue = data.topics.filter((topic) => topic.status !== "Completed" && topic.nextRevision);
  const upcoming = allDue.filter((topic) => dayDiff(topic.nextRevision) > 0).sort(schedulePriority);
  const overdue = allDue.filter((topic) => dayDiff(topic.nextRevision) < 0).sort(schedulePriority);
  const today = allDue.filter((topic) => dayDiff(topic.nextRevision) === 0).sort(schedulePriority);
  const completedToday = data.activities.filter((item) => item.type === "revision" && item.date === todayISO());
  const groups = { All: [...overdue, ...today, ...upcoming], Overdue: overdue, "Due Today": today, Upcoming: upcoming, "Completed Today": [] };
  const shown = roomTab === "Completed Today" ? [] : groups[roomTab];
  const tabs = ["All", "Overdue", "Due Today", "Upcoming", "Completed Today"];
  shell(`${heading("Revision Room", "A gentle nudge to strengthen what you already know.", `<span class="badge badge-learning">${allDue.length} to revisit</span>`)}
    <div class="card" style="padding:16px;margin-bottom:14px"><div class="section-heading"><div><h2 class="section-title">Your spaced repetition plan</h2><span class="section-subtitle">The gaps grow as your recall gets stronger.</span></div></div><div class="schedule-list">${data.intervals.map((days, i) => `<div class="schedule-step"><strong>${days}d</strong><span>Revision ${i + 1}</span></div>`).join("")}</div><div class="schedule-banner">${icon("sparkle",15)}<span>Weaker understanding means an earlier check-in. <strong>Need to Relearn</strong> and <strong>Basic Understanding</strong> topics are prioritized so you can build confidence at your own pace.</span></div></div>
    <div class="room-tabs">${tabs.map((tab) => `<button class="room-tab ${roomTab === tab ? "active" : ""}" data-tab="${tab}">${tab}${tab === "Overdue" ? ` · ${overdue.length}` : tab === "Due Today" ? ` · ${today.length}` : tab === "Upcoming" ? ` · ${upcoming.length}` : tab === "Completed Today" ? ` · ${completedToday.length}` : ""}</button>`).join("")}</div>
    ${roomTab === "Completed Today" ? (completedToday.length ? `<div class="room-list">${completedToday.map((item) => `<div class="card room-topic"><div class="subject-mark">${icon("check",15)}</div><div><h3>${esc(item.topicName)}</h3><p>${esc(item.text)} · ${fmtDate(item.date)}</p></div>${levelBadge(item.level)}</div>`).join("")}</div>` : `<div class="card empty-state"><h3>No revisions completed today yet</h3><p>Finish a quick session and it will appear here.</p></div>`) : shown.length ? `<div class="room-list">${shown.map(roomTopic).join("")}</div>` : `<div class="card empty-state"><div class="summary-check">${icon("check",24)}</div><h3>${roomTab === "Overdue" ? "Nothing overdue" : roomTab === "Due Today" ? "No revisions due today" : "Nothing on this list"}</h3><p>When a topic is ready to revisit, it’ll appear here.</p></div>`}`);
}
function roomTopic(topic) {
  const gap = dayDiff(topic.nextRevision);
  const when = gap < 0 ? `${Math.abs(gap)} ${Math.abs(gap) === 1 ? "day" : "days"} overdue` : gap === 0 ? "Due today" : `In ${gap} ${gap === 1 ? "day" : "days"}`;
  const weak = topic.level === "Need to Relearn" || topic.level === "Basic Understanding";
  return `<article class="card room-topic"><div class="subject-mark">${esc(topic.subject.slice(0,2).toUpperCase())}</div><div><h3>${esc(topic.name)}</h3><p>${esc(topic.subject)} · ${when}${weak ? " · Prioritized: reinforce recall" : ""}</p></div><div class="room-topic-actions">${levelBadge(topic.level)}<button class="btn btn-primary" data-action="start" data-id="${topic.id}">${icon("sparkle",13)} Revise</button></div></article>`;
}
function renderDetails() {
  const topic = data.topics.find((item) => item.id === selectedId);
  if (!topic) { route = "topics"; return renderTopics(); }
  const nextText = topic.nextRevision ? (dayDiff(topic.nextRevision) < 0 ? `${dayLabel(Math.abs(dayDiff(topic.nextRevision)))} overdue` : dayDiff(topic.nextRevision) === 0 ? "Due today" : `In ${dayLabel(dayDiff(topic.nextRevision))}`) : "No revision scheduled";
  shell(`${heading("Topic Details", `${esc(topic.subject)} · your personal learning notes`, `<button class="btn btn-secondary" data-route="topics">${icon("back",14)} All topics</button><button class="btn btn-primary" data-action="edit" data-id="${topic.id}">Edit topic</button>`)}
    <div class="detail-layout">
      <div class="stack">
        <section class="card detail-hero"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${statusBadge(topic.status)}${levelBadge(topic.level)}</div><h2>${esc(topic.name)}</h2><p>${esc(topic.description || "No description added yet.")}</p>
          <div class="detail-stats"><div class="detail-stat"><span>Last studied</span><strong>${fmtDate(topic.lastStudied)}</strong></div><div class="detail-stat"><span>Next revision · ${nextText}</span><strong>${fmtDate(topic.nextRevision)}</strong></div><div class="detail-stat"><span>Revisions completed</span><strong>${topic.revisionCount}</strong></div></div>
          <div style="display:flex;gap:8px;margin-top:17px;flex-wrap:wrap"><button class="btn btn-primary" data-action="start" data-id="${topic.id}">${icon("sparkle",14)} Start revision</button>${topic.resource ? `<a class="btn btn-secondary" href="${esc(topic.resource)}" target="_blank" rel="noopener noreferrer">Open learning resource ${icon("arrow",12)}</a>` : ""}<button class="btn btn-danger" data-action="delete" data-id="${topic.id}">Delete</button></div></section>
        <section class="card notes-card"><div class="section-heading"><h2 class="section-title">Personal notes</h2><button class="text-action" data-action="edit" data-id="${topic.id}">Edit notes</button></div><div class="notes-body">${esc(topic.notes || "No notes yet. Add something useful to remember.")}</div></section>
        <section class="card history-card"><div class="section-heading"><div><h2 class="section-title">Revision history</h2><span class="section-subtitle">${topic.history.length} sessions logged</span></div></div>
          ${topic.history.length ? `<div class="revision-history">${[...topic.history].reverse().map((entry, index) => `<div class="history-row"><div><strong>Revision ${topic.history.length - index}</strong><div style="margin-top:5px">${levelBadge(entry.level)} <span>${esc(entry.note || "")}</span></div></div><span>${fmtDate(entry.date)}</span></div>`).join("")}</div>` : `<div class="empty-state" style="padding:20px"><p>Your revision sessions will be saved here.</p></div>`}
        </section>
      </div>
      <div class="stack">
        <section class="card timeline-card"><div class="section-heading"><div><h2 class="section-title">Understanding journey</h2><span class="section-subtitle">Your confidence over time</span></div></div>
          ${topic.history.length ? `<div class="timeline">${topic.history.map((entry) => `<div class="timeline-item"><span class="timeline-point"></span><div><strong>${levelBadge(entry.level)}</strong><p>${fmtDate(entry.date)} · ${esc(entry.note || "Understanding updated")}</p></div></div>`).join("")}<div class="timeline-item"><span class="timeline-point"></span><div><strong>${levelBadge(topic.level)}</strong><p>Current understanding · today</p></div></div></div>` : `<div class="schedule-banner">${icon("chart",14)}<span>Complete your first revision to start a personal understanding timeline.</span></div>`}
        </section>
        <section class="card chart-card"><h2 class="section-title">Next revision</h2><div class="schedule-banner" style="margin-top:12px">${icon("calendar",15)}<span>${topic.nextRevision ? `Next check-in: <strong>${fmtDate(topic.nextRevision)}</strong>. ${esc(topic.level)} topics return sooner to support stronger recall.` : "This topic is marked complete. Start a revision any time to bring it back into your learning cycle."}</span></div><div style="margin-top:13px">${statusBadge(topic.status)} <span style="margin-left:5px">${levelBadge(topic.level)}</span></div></section>
      </div>
    </div>`);
}
function renderProgress() {
  const mastered = data.topics.filter((topic) => topic.level === "Interview Ready").length;
  shell(`${heading("Learning Progress", "A clear picture of what you’ve learned and where you’re growing.", `<button class="btn btn-secondary" data-action="export">${icon("arrow",13)} Export data</button>`)}
    <section class="stats-grid">${statCard("Topics in your library", data.topics.length, "book", "")}${statCard("Interview ready", mastered, "check", "green")}${statCard("Need improvement", weakTopics().length, "chart", "orange")}${statCard("Revisions completed", data.topics.reduce((sum, topic) => sum + topic.revisionCount, 0), "layers", "blue")}</section>
    <section class="settings-layout"><div class="card chart-card"><div class="section-heading"><div><h2 class="section-title">Understanding by subject</h2><span class="section-subtitle">Topics with strong or interview-ready recall</span></div></div>${subjectBars()}</div><div class="card activity-card"><div class="section-heading"><div><h2 class="section-title">Interview-ready topics</h2><span class="section-subtitle">You’ve built strong recall here</span></div></div>${data.topics.filter((topic) => topic.level === "Interview Ready").map((topic) => topicRow(topic, false)).join("") || `<div class="activity-item">Rate a revision as Interview Ready and it will appear here.</div>`}</div></section>
    <section class="card chart-card" style="margin-top:14px"><div class="section-heading"><div><h2 class="section-title">Topics needing improvement</h2><span class="section-subtitle">Revisit these with a little extra care</span></div></div><div class="topic-grid">${weakTopics().map(topicCard).join("") || `<div class="activity-item">You’re doing great — no topics need improvement right now.</div>`}</div></section>`);
}
function renderSettings() {
  shell(`${heading("Settings", "Make your study space work the way you do.")}
    <section class="settings-layout">
      <div class="card settings-card"><h2 class="section-title">Account</h2><p>Your StudySpace profile and sign-in details.</p>
        <form id="profile-form" class="form-grid">
          <div class="form-field full"><label for="profile-name">Full name</label><input id="profile-name" class="field-control" name="fullName" maxlength="100" required value="${esc(profile?.full_name || "")}"></div>
          <div class="form-field full"><label for="profile-email">Email</label><input id="profile-email" class="field-control" type="email" value="${esc(profile?.email || authUser?.email || "")}" disabled></div>
          <div class="form-field full"><label for="profile-avatar">Profile picture URL (optional)</label><input id="profile-avatar" class="field-control" name="avatarUrl" type="url" placeholder="https://..." value="${esc(profile?.avatar_url || "")}"></div>
          <div class="form-field full"><small class="section-subtitle">Account created ${profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}</small></div>
          <div class="form-field full"><button class="btn btn-primary" type="submit">Save profile</button></div>
        </form>
        <div class="setting-row"><div><strong>Password</strong><small>Send a password reset email to your account</small></div><button class="btn btn-secondary" data-action="send-reset">Reset password</button></div>
        <div class="setting-row"><div><strong>Session</strong><small>${esc(authUser?.email || "")}</small></div><button class="btn btn-secondary" data-action="logout">Sign out</button></div>
      </div>
      <div class="card settings-card"><h2 class="section-title">Appearance</h2><p>Set the tone for your next study session.</p><div class="setting-row"><div><strong>Dark mode</strong><small>Use a softer, darker workspace</small></div><button class="switch ${data.dark ? "on" : ""}" data-action="theme" role="switch" aria-checked="${data.dark}" aria-label="Toggle dark mode"></button></div></div>
      <div class="card settings-card"><h2 class="section-title">Revision intervals</h2><p>Default spacing for each review. We bring weaker topics back sooner.</p>${data.intervals.map((days, index) => `<div class="setting-row"><div><strong>Revision ${index + 1}</strong><small>${index === 0 ? "First review" : `After revision ${index}`} · ${dayLabel(days)}</small></div><label style="display:flex;align-items:center;gap:5px"><input class="field-control interval-input" style="width:62px;min-height:32px;text-align:center;padding:0 6px" type="number" min="1" max="365" value="${days}" data-interval="${index}" aria-label="Days until revision ${index + 1}"><span class="section-subtitle">days</span></label></div>`).join("")}</div>
      <div class="card settings-card"><h2 class="section-title">Manage subjects</h2><p>Keep your topic library organized around what you’re learning.</p><div class="subject-chips">${data.subjects.map((subject) => `<span class="subject-chip">${esc(subject)}<button data-action="remove-subject" data-subject="${esc(subject)}" aria-label="Remove ${esc(subject)}">×</button></span>`).join("")}</div><form class="inline-form" id="subject-form"><input class="field-control" name="subject" placeholder="New subject" maxlength="30" required aria-label="New subject"><button class="btn btn-primary">Add subject</button></form></div>
      <div class="card settings-card"><h2 class="section-title">Your data</h2><p>Your study data is stored in your private StudySpace account. Export a backup or restore a StudySpace JSON file.</p><div class="setting-row"><div><strong>Export topics</strong><small>Download your study data as JSON</small></div><button class="btn btn-secondary" data-action="export">Export</button></div><div class="setting-row"><div><strong>Import topics</strong><small>Replace your cloud data with a StudySpace JSON export</small></div><button class="btn btn-secondary" data-action="import">Choose file</button><input id="import-file" type="file" accept="application/json,.json" hidden></div></div>
      <div class="card settings-card migration-card"><h2 class="section-title">Import browser data</h2>
        ${data.legacyImportCompletedAt ? `<p class="migration-success">Your browser data was imported on ${new Date(data.legacyImportCompletedAt).toLocaleDateString()}. The original browser copy has not been deleted.</p>` : legacyDataError ? `<p class="migration-error">${esc(legacyDataError)} You can still use the export option above to download a copy of the original browser data.</p>` : legacyData ? `<p>We found ${legacyData.topics.length} topic${legacyData.topics.length === 1 ? "" : "s"} in this browser. Download a backup before importing. Your browser copy will remain untouched.</p>
          <div class="migration-actions"><button class="btn btn-secondary" data-action="export-legacy">Download browser backup</button><label class="migration-check"><input id="migration-backup-confirm" type="checkbox" ${legacyBackupConfirmed ? "checked" : ""} ${legacyBackupDownloaded ? "" : "disabled"}> I downloaded the backup</label></div>
          ${hasCloudData ? `<label class="migration-check migration-overwrite"><input id="migration-overwrite-confirm" type="checkbox" ${legacyOverwriteConfirmed ? "checked" : ""}> I understand this will replace all existing cloud study data</label>` : ""}
          <button class="btn btn-primary" data-action="migrate" ${legacyBackupDownloaded && legacyBackupConfirmed && (!hasCloudData || legacyOverwriteConfirmed) ? "" : "disabled"}>Import browser data to this account</button>` : `<p>No saved StudySpace browser data was found to import.</p>`}
      </div>
    </section>`);
}
function renderSession() {
  if (completionSummary) return renderSummary();
  const topic = data.topics.find((item) => item.id === revisionQueue[revisionIndex]);
  if (!topic) { route = "room"; return renderRoom(); }
  const percent = Math.round(revisionIndex / revisionQueue.length * 100);
  shell(`<div class="revision-view"><div class="revision-top"><button class="text-action" data-route="room">${icon("back",13)} Leave revision</button><span>Topic ${revisionIndex + 1} of ${revisionQueue.length}</span></div><div class="revision-progress"><span style="width:${percent}%"></span></div>
    <section class="card revision-panel"><div class="subject-mark">${esc(topic.subject.slice(0,2).toUpperCase())}</div><div style="margin-top:12px">${statusBadge(topic.status)} ${levelBadge(topic.level)}</div><h2>${esc(topic.name)}</h2><p>${esc(topic.subject)} · Last studied ${fmtDate(topic.lastStudied)}</p>
      <div class="revision-notes">${esc(topic.notes || "No saved notes for this topic yet. Use this session to recall what you know.")}</div>
      <div class="rating-title">How well do you understand this now?</div><div class="rating-grid">${LEVELS.map((level, index) => `<button class="rating-btn ${chosenLevel === level ? "selected" : ""}" data-level="${esc(level)}"><span>${["↻","◔","✓","✦"][index]}</span>${esc(level)}</button>`).join("")}</div>
      <div class="form-field" style="margin-top:14px"><label for="revision-note">Optional session note</label><textarea class="field-control notes-input" id="revision-note" placeholder="What clicked? What would you like to revisit?">${esc(revisionNote)}</textarea></div>
      <div class="revision-actions"><button class="btn btn-secondary" data-route="room">Save for later</button><button class="btn btn-primary" data-action="complete-revision" ${chosenLevel ? "" : "disabled"}>Complete revision ${icon("arrow",13)}</button></div>
    </section></div>`);
}
function renderSummary() {
  const topic = data.topics.find((item) => item.id === completionSummary.topicId);
  shell(`<div class="revision-view"><section class="card summary-panel"><div class="summary-check">${icon("check",27)}</div><div class="eyebrow">One more step forward</div><h2>Revision complete!</h2><p>${topic ? `You revisited ${esc(topic.name)} and updated your understanding.` : "Your revision has been saved."}</p>
    <div style="margin:15px 0">${levelBadge(completionSummary.level)}</div>
    <div class="next-review">${topic?.nextRevision ? `Your next revision is scheduled for <strong>${fmtDate(topic.nextRevision)}</strong> (${completionSummary.intervalDays}-day interval).` : "Your topic is complete. Revisit it anytime to keep your knowledge fresh."}</div>
    <button class="btn btn-primary" data-action="summary-done">Back to revision room ${icon("arrow",13)}</button> ${topic ? `<button class="btn btn-secondary" data-action="summary-detail" data-id="${esc(topic.id)}">View topic</button>` : ""}
  </section></div>`);
}
function modalForm(topic = null) {
  const editing = Boolean(topic);
  const level = topic?.level || "Basic Understanding";
  const status = topic?.status || "Learning";
  const subjectOptions = [...new Set([...data.subjects, ...(topic?.subject && !data.subjects.includes(topic.subject) ? [topic.subject] : [])])];
  const markup = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-content>
    <div class="modal-head"><div><h2 id="modal-title">${editing ? "Edit topic" : "Add a topic"}</h2><p>${editing ? "Keep your learning notes and schedule up to date." : "A new topic is the first step in your next learning streak."}</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close dialog">${icon("close",14)}</button></div>
    <form id="topic-form" data-id="${editing ? esc(topic.id) : ""}"><div class="form-grid">
      <div class="form-field full"><label for="topic-name">Topic name *</label><input id="topic-name" class="field-control" name="name" required maxlength="100" placeholder="e.g. SQL joins & aggregations" value="${esc(topic?.name || "")}"></div>
      <div class="form-field"><label for="topic-subject">Subject *</label><select class="field-control" id="topic-subject" name="subject" required><option value="">Choose subject</option>${subjectOptions.map((subject) => `<option ${topic?.subject === subject ? "selected" : ""}>${esc(subject)}</option>`).join("")}</select></div>
      <div class="form-field"><label for="topic-status">Learning status</label><select class="field-control" id="topic-status" name="status">${STATUS_OPTIONS.map((option) => `<option ${status === option ? "selected" : ""}>${option}</option>`).join("")}</select></div>
      <div class="form-field full"><label for="topic-description">Description</label><textarea class="field-control" id="topic-description" name="description" placeholder="What are you learning?">${esc(topic?.description || "")}</textarea></div>
      <div class="form-field"><label for="topic-level">Understanding level</label><select class="field-control" id="topic-level" name="level">${LEVELS.map((option) => `<option ${level === option ? "selected" : ""}>${option}</option>`).join("")}</select></div>
      <div class="form-field"><label for="topic-date">Study date</label><input class="field-control" id="topic-date" name="lastStudied" type="date" value="${esc(topic?.lastStudied || todayISO())}"></div>
      <div class="form-field full"><label for="topic-next-revision">Next revision date</label><input class="field-control" id="topic-next-revision" name="nextRevision" type="date" value="${esc(topic?.nextRevision || (!editing ? shiftDate(daysForNext({ revisionCount: 0 }, level), todayISO()) : ""))}"><small class="section-subtitle">Adjust this date any time; understanding sets the initial interval.</small></div>
      <div class="form-field full"><label for="topic-notes">Personal notes</label><textarea class="field-control notes-input" id="topic-notes" name="notes" placeholder="The ideas you want to remember...">${esc(topic?.notes || "")}</textarea></div>
      <div class="form-field full"><label for="topic-resource">Learning resource URL</label><input class="field-control" id="topic-resource" name="resource" type="url" placeholder="https://..." value="${esc(topic?.resource || "")}"></div>
    </div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary">${editing ? "Save changes" : "Add topic"}</button></div></form></section></div>`;
  app.insertAdjacentHTML("beforeend", markup);
  document.querySelector("#topic-name")?.focus();
}
function addActivity(text, topicName, level = "", type = "update") {
  data.activities.push({ text, topicName, level, date: todayISO(), type });
  if (data.activities.length > 30) data.activities = data.activities.slice(-30);
}
function daysForNext(topic, level) {
  const index = Math.min(Math.max(0, topic.revisionCount - 1), data.intervals.length - 1);
  let days = Number(data.intervals[index]) || 1;
  if (level === "Need to Relearn") days = 1;
  else if (level === "Basic Understanding") days = 3;
  else if (level === "Interview Ready") days = 30;
  return days;
}
function beginSession(topicId) {
  revisionQueue = [topicId];
  revisionIndex = 0;
  chosenLevel = null;
  revisionNote = "";
  completionSummary = null;
  route = "session";
  render();
}
function render() {
  if (!authUser) { renderAuth(); return; }
  if (accountLoading) { renderAccountLoading(); return; }
  if (!accountLoaded) { renderAccountError("Your account is not ready yet. Reload the page or sign in again."); return; }
  document.body.classList.toggle("dark", data.dark);
  if (route === "dashboard") renderDashboard();
  else if (route === "topics") renderTopics();
  else if (route === "detail") renderDetails();
  else if (route === "room") renderRoom();
  else if (route === "session") renderSession();
  else if (route === "settings") renderSettings();
  else if (route === "progress") renderProgress();
  else renderDashboard();
}
function setAuthFeedback(form, message, isError = true) {
  let feedback = form.querySelector(".auth-form-feedback");
  if (!feedback) {
    feedback = document.createElement("div");
    feedback.className = "auth-form-feedback";
    feedback.setAttribute("role", isError ? "alert" : "status");
    feedback.setAttribute("aria-live", "polite");
    form.prepend(feedback);
  }
  feedback.className = `auth-form-feedback ${isError ? "auth-message-error" : "auth-message-success"}`;
  feedback.textContent = message;
}
async function handleAuthFormSubmit(event) {
  const formElement = event.target;
  const form = new FormData(formElement);
  const button = formElement.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    if (formElement.id === "login-form") {
      await StudySpaceAuth.signIn(String(form.get("email")).trim(), String(form.get("password")));
      authNotice = "";
    } else if (formElement.id === "forgot-form") {
      await StudySpaceAuth.sendPasswordReset(String(form.get("email")).trim());
      authNotice = "If that address belongs to an invited account, a password reset link is on its way.";
      renderAuth(authNotice, false);
    } else if (formElement.id === "invite-form" || formElement.id === "recovery-form") {
      const password = String(form.get("password"));
      if (password.length < 10) throw new Error("Choose a password with at least 10 characters.");
      if (password !== String(form.get("confirmPassword"))) throw new Error("The passwords do not match.");
      const fullName = String(form.get("fullName") || "").trim();
      if (formElement.id === "invite-form" && !fullName) throw new Error("Enter your full name.");
      if (!authUser) throw new Error("This password link has expired. Request a new link and try again.");
      const user = await StudySpaceAuth.updatePassword(password, fullName);
      authUser = user;
      authMode = "";
      authNotice = "";
      clearAuthModeFromUrl();
      await loadAccount(user);
      if (formElement.id === "recovery-form") toast("Password updated.");
    }
  } catch (error) {
    setAuthFeedback(formElement, authErrorMessage(error));
    if (button) button.disabled = false;
  }
}
async function updateProfile(formElement) {
  const form = new FormData(formElement);
  const fullName = String(form.get("fullName") || "").trim();
  const avatarUrl = String(form.get("avatarUrl") || "").trim();
  if (!fullName || fullName.length > 100) { toast("Enter a name between 1 and 100 characters."); return; }
  if (!isSafeResourceUrl(avatarUrl)) { toast("Profile picture links must use http:// or https://."); return; }
  const button = formElement.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    profile = await StudySpaceAuth.updateProfile(authUser.id, { fullName, avatarUrl });
    renderSettings();
    toast("Profile updated.");
  } catch {
    toast("Your profile could not be saved. Check your connection and try again.");
    if (button) button.disabled = false;
  }
}
async function signOut() {
  try {
    await StudySpaceAuth.signOut();
  } catch {
    toast("Could not sign out. Check your connection and try again.");
  }
}
async function migrateLegacyData() {
  if (migrationInProgress || !legacyData || data.legacyImportCompletedAt || !legacyBackupDownloaded || !legacyBackupConfirmed) return;
  if (hasCloudData && !legacyOverwriteConfirmed) {
    toast("Confirm that replacing existing cloud data is what you want.");
    return;
  }
  if (hasCloudData && !window.confirm("This will replace all study data currently in your cloud account. Your downloaded browser backup will not be changed. Continue?")) return;
  migrationInProgress = true;
  const previous = data;
  data = { ...legacyData, legacyImportCompletedAt: new Date().toISOString() };
  if (!await save()) {
    data = previous;
    migrationInProgress = false;
    renderSettings();
    return;
  }
  legacyData = null;
  migrationInProgress = false;
  renderSettings();
  toast("Browser study data imported. The original LocalStorage copy remains in this browser.");
}
app.addEventListener("click", async (event) => {
  if (persistenceBusy) { toast("Your changes are still being saved."); return; }
  if (event.target.classList.contains("modal-backdrop")) { event.target.remove(); return; }
  const target = event.target.closest("[data-action],[data-route],[data-tab],[data-level],[data-auth-mode]");
  if (!target) {
    const card = event.target.closest(".topic-card");
    if (card) { selectedId = card.dataset.id; route = "detail"; render(); }
    return;
  }
  if (target.dataset.authMode) {
    authMode = target.dataset.authMode;
    authNotice = "";
    renderAuth();
    return;
  }
  if (target.dataset.route) { route = target.dataset.route; if (route === "detail") return; render(); return; }
  if (target.dataset.tab) { roomTab = target.dataset.tab; renderRoom(); return; }
  if (target.dataset.level) { chosenLevel = target.dataset.level; renderSession(); return; }
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (action === "theme") {
    const previous = data.dark;
    data.dark = !data.dark;
    if (!await save()) data.dark = previous;
    render();
  }
  else if (action === "logout") await signOut();
  else if (action === "retry-account") await loadAccount(authUser);
  else if (action === "add") modalForm();
  else if (action === "edit") { const topic = data.topics.find((item) => item.id === id); if (topic) modalForm(topic); }
  else if (action === "close-modal") document.querySelector(".modal-backdrop")?.remove();
  else if (action === "detail") { selectedId = id; route = "detail"; render(); }
  else if (action === "start") beginSession(id);
  else if (action === "delete") {
    if (window.confirm("Delete this topic and its revision history?")) {
      const previous = data.topics;
      data.topics = data.topics.filter((topic) => topic.id !== id);
      if (!await save()) { data.topics = previous; render(); return; }
      route = "topics"; render(); toast("Topic deleted.");
    }
  } else if (action === "complete-revision") await completeRevision();
  else if (action === "summary-done") { completionSummary = null; route = "room"; render(); }
  else if (action === "summary-detail") { selectedId = id; completionSummary = null; route = "detail"; render(); }
  else if (action === "export") exportData();
  else if (action === "export-legacy") {
    if (legacyData) {
      exportData(legacyData, `studyspace-browser-backup-${todayISO()}.json`);
      legacyBackupDownloaded = true;
      renderSettings();
    }
  }
  else if (action === "migrate") await migrateLegacyData();
  else if (action === "import") document.querySelector("#import-file")?.click();
  else if (action === "send-reset") {
    try {
      await StudySpaceAuth.sendPasswordReset(authUser.email);
      toast("If this address belongs to an invited account, a password reset link is on its way.");
    } catch { toast("Could not send the password reset email. Check your connection and try again."); }
  }
  else if (action === "remove-subject") await removeSubject(target.dataset.subject);
});
app.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.querySelector(".modal-backdrop")?.remove();
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".topic-card")) { event.preventDefault(); selectedId = event.target.dataset.id; route = "detail"; render(); }
});
app.addEventListener("input", (event) => {
  if (event.target.dataset.filter === "search") {
    filters.search = event.target.value;
    const results = document.querySelector("#topic-results");
    if (results) results.innerHTML = topicResultsMarkup(filteredTopics());
  } else if (event.target.id === "topic-next-revision") {
    event.target.dataset.userEdited = "true";
  } else if (event.target.id === "revision-note") revisionNote = event.target.value;
});
app.addEventListener("change", async (event) => {
  if (persistenceBusy) return;
  if (event.target.dataset.filter) { filters[event.target.dataset.filter] = event.target.value; renderTopics(); }
  if (event.target.id === "topic-date" || event.target.id === "topic-level") {
    const form = event.target.closest("#topic-form");
    const nextDate = form?.querySelector("#topic-next-revision");
    if (form && !form.dataset.id && nextDate?.dataset.userEdited !== "true") {
      const days = daysForNext({ revisionCount: 0 }, form.elements.level.value);
      nextDate.value = shiftDate(days, form.elements.lastStudied.value || todayISO());
    }
  }
  if (event.target.dataset.interval !== undefined) {
    const index = Number(event.target.dataset.interval);
    const value = Number(event.target.value);
    if (!Number.isInteger(value) || value < 1 || value > 365) { event.target.value = data.intervals[index]; toast("Choose an interval between 1 and 365 days."); return; }
    const previous = data.intervals[index];
    data.intervals[index] = value;
    if (!await save()) { data.intervals[index] = previous; renderSettings(); return; }
    renderSettings(); toast("Revision interval updated.");
  }
  if (event.target.id === "import-file") await importData(event.target.files?.[0]);
  if (event.target.id === "migration-backup-confirm") {
    legacyBackupConfirmed = event.target.checked;
    renderSettings();
  }
  if (event.target.id === "migration-overwrite-confirm") {
    legacyOverwriteConfirmed = event.target.checked;
    renderSettings();
  }
});
app.addEventListener("submit", async (event) => {
  if (persistenceBusy) { event.preventDefault(); toast("Your changes are still being saved."); return; }
  if (["login-form", "forgot-form", "invite-form", "recovery-form"].includes(event.target.id)) {
    event.preventDefault();
    await handleAuthFormSubmit(event);
    return;
  }
  if (event.target.id === "profile-form") {
    event.preventDefault();
    await updateProfile(event.target);
    return;
  }
  if (event.target.id === "topic-form") {
    event.preventDefault();
    const formElement = event.target;
    if (formElement.dataset.submitting === "true") return;
    formElement.dataset.submitting = "true";
    const submitButton = formElement.querySelector('button[type="submit"], .btn-primary');
    if (submitButton) submitButton.disabled = true;
    const form = new FormData(event.target);
    const id = event.target.dataset.id;
    const existing = data.topics.find((topic) => topic.id === id);
    const name = String(form.get("name")).trim();
    const subject = String(form.get("subject")).trim();
    if (!name || !subject) { toast("Add a topic name and subject."); formElement.dataset.submitting = "false"; if (submitButton) submitButton.disabled = false; return; }
    const duplicate = data.topics.find((topic) => topic.id !== id && topic.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase() && topic.subject.trim().toLocaleLowerCase() === subject.toLocaleLowerCase());
    if (duplicate) {
      toast(`“${duplicate.name}” already exists in ${duplicate.subject}.`);
      formElement.dataset.submitting = "false";
      if (submitButton) submitButton.disabled = false;
      return;
    }
    const studiedDate = String(form.get("lastStudied") || todayISO());
    const nextRevisionValue = String(form.get("nextRevision") || "");
    const resource = String(form.get("resource") || "").trim();
    if (!isDateOnly(studiedDate) || (nextRevisionValue && !isDateOnly(nextRevisionValue))) {
      toast("Enter valid study and revision dates.");
      formElement.dataset.submitting = "false";
      if (submitButton) submitButton.disabled = false;
      return;
    }
    if (!isSafeResourceUrl(resource)) {
      toast("Learning resource links must use http:// or https://.");
      formElement.dataset.submitting = "false";
      if (submitButton) submitButton.disabled = false;
      return;
    }
    const status = String(form.get("status"));
    const topic = {
      id: existing?.id || uid(), name, subject, description: String(form.get("description") || "").trim(),
      status, level: String(form.get("level")), lastStudied: studiedDate,
      notes: String(form.get("notes") || "").trim(), resource,
      revisionCount: existing?.revisionCount || 0, history: existing?.history || [],
      nextRevision: status === "Completed" ? null : nextRevisionValue || null,
    };
    const previousTopic = existing ? JSON.stringify(existing) : null;
    const previousTopics = data.topics.slice();
    const previousSubjects = data.subjects.slice();
    const previousActivities = data.activities.slice();
    if (existing) Object.assign(existing, topic);
    else { topic.lastStudied = topic.lastStudied || todayISO(); data.topics.unshift(topic); addActivity(`Added ${topic.name} to your study library`, topic.name); }
    if (!data.subjects.includes(subject)) data.subjects.push(subject);
    selectedId = topic.id;
    if (!existing) filters = { search: "", subject: "", status: "", level: "", revision: "", sort: "next" };
    const persisted = await save();
    if (!persisted) {
      data.topics = previousTopics;
      data.subjects = previousSubjects;
      data.activities = previousActivities;
      if (existing) Object.assign(existing, JSON.parse(previousTopic));
      formElement.dataset.submitting = "false";
      if (submitButton) submitButton.disabled = false;
      return;
    }
    document.querySelector(".modal-backdrop")?.remove(); route = existing ? "detail" : "topics"; render();
    if (persisted) toast(existing ? "Topic updated." : "Topic added.");
  }
  if (event.target.id === "subject-form") {
    event.preventDefault();
    const input = event.target.elements.subject;
    const name = input.value.trim();
    if (!name) return;
    if (data.subjects.some((subject) => subject.toLowerCase() === name.toLowerCase())) { toast("That subject already exists."); return; }
    data.subjects.push(name);
    if (!await save()) { data.subjects.pop(); return; }
    renderSettings(); toast("Subject added.");
  }
});
async function completeRevision() {
  if (!chosenLevel) { toast("Choose an understanding level to continue."); return; }
  const topic = data.topics.find((item) => item.id === revisionQueue[revisionIndex]);
  if (!topic) { toast("This topic could not be found."); return; }
  const previousTopic = JSON.stringify(topic);
  const previousActivities = data.activities.slice();
  topic.level = chosenLevel;
  topic.lastStudied = todayISO();
  topic.revisionCount += 1;
  topic.status = "Learning";
  const intervalDays = daysForNext(topic, chosenLevel);
  topic.nextRevision = shiftDate(intervalDays);
  topic.history.push({ date: todayISO(), level: chosenLevel, note: revisionNote.trim() || "Revision session completed." });
  addActivity(`Revised ${topic.name}`, topic.name, chosenLevel, "revision");
  if (!await save()) {
    Object.assign(topic, JSON.parse(previousTopic));
    data.activities = previousActivities;
    renderSession();
    return;
  }
  completionSummary = { topicId: topic.id, level: chosenLevel, intervalDays };
  renderSummary();
}
async function removeSubject(subject) {
  if (data.topics.some((topic) => topic.subject === subject)) { toast("Move or delete its topics before removing this subject."); return; }
  const previous = data.subjects.slice();
  data.subjects = data.subjects.filter((item) => item !== subject);
  if (!await save()) { data.subjects = previous; renderSettings(); return; }
  renderSettings(); toast("Subject removed.");
}
function exportData(snapshot = data, filename = `studyspace-${todayISO()}.json`) {
  try {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...snapshot }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(snapshot === legacyData ? "Browser backup downloaded." : "Study data exported.");
  } catch { toast("Could not export your data."); }
}
async function importData(file) {
  if (!file) return;
  try {
    const imported = validateImport(JSON.parse(await file.text()));
    if (!window.confirm("Importing this file will replace the study data in your cloud account. Export a backup first if you may need the current data. Continue?")) return;
    const previous = data;
    data = { ...imported, legacyImportCompletedAt: data.legacyImportCompletedAt };
    if (!await save()) { data = previous; return; }
    renderSettings(); toast("Study data imported.");
  } catch (error) {
    toast(error.message || "Could not read that file.");
  }
}
function validateImport(parsed) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.topics)) {
    throw new Error("This file is not a StudySpace export with a topic list.");
  }
  if (!Array.isArray(parsed.intervals) || parsed.intervals.length !== 5 || !parsed.intervals.every((days) => Number.isInteger(days) && days >= 1 && days <= 365)) {
    throw new Error("The export must contain five revision intervals between 1 and 365 days.");
  }
  if (!Array.isArray(parsed.subjects) || !parsed.subjects.every((subject) =>
    typeof subject === "string" && subject.trim() && subject.trim().length <= 30)) {
    throw new Error("The export contains an invalid subject list.");
  }
  if (parsed.dark !== undefined && typeof parsed.dark !== "boolean") {
    throw new Error("The export contains an invalid theme setting.");
  }
  const ids = new Set();
  const names = new Set();
  const topics = parsed.topics.map((topic, index) => {
    if (!topic || typeof topic !== "object" || typeof topic.id !== "string" || topic.id.length > 100 || !/^[a-zA-Z0-9._-]+$/.test(topic.id) ||
      typeof topic.name !== "string" || !topic.name.trim() || topic.name.trim().length > 100 ||
      typeof topic.subject !== "string" || !topic.subject.trim() || topic.subject.trim().length > 30) {
      throw new Error(`Topic ${index + 1} is missing a valid ID, name, or subject.`);
    }
    if (ids.has(topic.id)) throw new Error(`The export contains duplicate topic ID “${topic.id}”.`);
    const nameKey = `${topic.subject.trim().toLocaleLowerCase()}|${topic.name.trim().toLocaleLowerCase()}`;
    if (names.has(nameKey)) throw new Error(`The export contains duplicate topic “${topic.name}” in ${topic.subject}.`);
    if (!LEVELS.includes(topic.level) || !STATUS_OPTIONS.includes(topic.status)) throw new Error(`Topic “${topic.name}” has an invalid status or understanding level.`);
    if (!Number.isInteger(topic.revisionCount) || topic.revisionCount < 0) throw new Error(`Topic “${topic.name}” has an invalid revision count.`);
    if ((topic.description !== undefined && typeof topic.description !== "string") ||
      (topic.notes !== undefined && typeof topic.notes !== "string")) {
      throw new Error(`Topic “${topic.name}” has invalid notes or description.`);
    }
    if (topic.resource !== undefined && typeof topic.resource !== "string") throw new Error(`Topic “${topic.name}” has an invalid resource link.`);
    if (!isSafeResourceUrl(topic.resource || "")) throw new Error(`Topic “${topic.name}” has an unsafe resource link.`);
    if (!isDateOnly(topic.lastStudied) || (topic.nextRevision !== null && topic.nextRevision !== undefined && !isDateOnly(topic.nextRevision))) {
      throw new Error(`Topic “${topic.name}” has an invalid study or revision date.`);
    }
    if (topic.history !== undefined && (!Array.isArray(topic.history) || !topic.history.every((entry) =>
      entry && isDateOnly(entry.date) && LEVELS.includes(entry.level) && typeof entry.note === "string"))) {
      throw new Error(`Topic “${topic.name}” has invalid revision history.`);
    }
    ids.add(topic.id);
    names.add(nameKey);
    return {
      id: topic.id, name: topic.name.trim(), subject: topic.subject.trim(),
      description: typeof topic.description === "string" ? topic.description : "",
      status: topic.status, level: topic.level, lastStudied: topic.lastStudied,
      nextRevision: topic.nextRevision || null,
      notes: typeof topic.notes === "string" ? topic.notes : "",
      resource: typeof topic.resource === "string" ? topic.resource : "",
      revisionCount: topic.revisionCount, history: (topic.history || []).map((entry) => ({ date: entry.date, level: entry.level, note: entry.note })),
    };
  });
  if (parsed.activities !== undefined && (!Array.isArray(parsed.activities) || !parsed.activities.every((item) =>
    item && typeof item.text === "string" && item.text.length <= 200 &&
    typeof item.topicName === "string" && item.topicName.length <= 100 && isDateOnly(item.date) &&
    (item.level === undefined || item.level === "" || LEVELS.includes(item.level)) &&
    (item.type === undefined || ["update", "revision"].includes(item.type))))) {
    throw new Error("The export contains invalid activity records.");
  }
  if (parsed.legacyImportCompletedAt !== undefined &&
    parsed.legacyImportCompletedAt !== null &&
    (typeof parsed.legacyImportCompletedAt !== "string" || Number.isNaN(Date.parse(parsed.legacyImportCompletedAt)))) {
    throw new Error("The export contains an invalid migration marker.");
  }
  const subjects = [];
  parsed.subjects.forEach((subject) => {
    const name = subject.trim();
    if (!subjects.some((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase())) subjects.push(name);
  });
  topics.forEach((topic) => {
    if (!subjects.some((item) => item.toLocaleLowerCase() === topic.subject.toLocaleLowerCase())) subjects.push(topic.subject);
  });
  return {
    topics, subjects, intervals: [...parsed.intervals], dark: parsed.dark === true,
    activities: (parsed.activities || []).slice(-30),
    legacyImportCompletedAt: parsed.legacyImportCompletedAt || null,
  };
}
initializeAuth();
