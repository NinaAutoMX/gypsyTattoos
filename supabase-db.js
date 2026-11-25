// ─────────────────────────────────────────────────────────────
//  supabase-db.js – Gypsy Tattoo shared database layer
//
//  Supabase   → data (markets, events, pricing, calendar, bookings) + admin login
//  Cloudinary → image files
//
//  The anon key below is MEANT to be public. Security comes from the
//  Row Level Security rules in supabase-schema.sql, not from hiding it.
//  NEVER put the "service_role" key in this file.
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL      = "https://YOUR-PROJECT-ID.supabase.co"; // ← Project Settings → API
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";                // ← "anon public" key

const CLOUDINARY_CLOUD_NAME    = "dhvdekbua";
const CLOUDINARY_UPLOAD_PRESET = "gypsytattoo";

// ── Escape text before putting it into innerHTML ─────────────
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ── Client ───────────────────────────────────────────────────
let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (typeof supabase === "undefined") throw new Error("Supabase SDK not loaded.");
  if (SUPABASE_URL.includes("YOUR-PROJECT")) throw new Error("Supabase not configured in supabase-db.js");
  _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}

// ── Key/value data (same API the pages already use) ──────────
async function getData(key) {
  try {
    const { data, error } = await sb().from("site_data").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    if (data) {
      localStorage.setItem(key, JSON.stringify(data.value));
      return data.value;
    }
    const local = localStorage.getItem(key);
    return local ? JSON.parse(local) : [];
  } catch (err) {
    console.warn("[db] getData fallback to localStorage:", err);
    const local = localStorage.getItem(key);
    return local ? JSON.parse(local) : [];
  }
}

// Only works when signed in as the owner (enforced by the database).
async function setData(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
  const { error } = await sb().from("site_data").upsert({ key, value: val, updated_at: new Date().toISOString() });
  if (error) { console.error("[db] setData error:", error); throw error; }
}

async function getAllData(keys) {
  const results = {};
  await Promise.all(keys.map(async (k) => { results[k] = await getData(k); }));
  return results;
}

// ── Admin login (Supabase Auth) ──────────────────────────────
async function adminSignIn(email, password) {
  const { data, error } = await sb().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
async function adminSignOut() { await sb().auth.signOut(); }
async function adminSession() {
  const { data } = await sb().auth.getSession();
  return data.session;
}

// ── Booking requests ─────────────────────────────────────────
// Anyone can INSERT a request; only the owner can read/update/delete.
async function submitBookingRequest(req) {
  const { error } = await sb().from("booking_requests").insert(req);
  if (error) throw error;
}
async function getBookingRequests() {
  const { data, error } = await sb().from("booking_requests").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function updateBookingRequest(id, patch) {
  const { error } = await sb().from("booking_requests").update(patch).eq("id", id);
  if (error) throw error;
}
async function deleteBookingRequest(id) {
  const { error } = await sb().from("booking_requests").delete().eq("id", id);
  if (error) throw error;
}

// ── Cloudinary image upload (unchanged) ──────────────────────
async function uploadImage(file, folder, onProgress) {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image is larger than 10 MB.");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "gypsytattoo/" + folder);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    }
    xhr.onload = () => {
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText).secure_url);
      else reject(new Error("Cloudinary upload failed: " + xhr.responseText));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(formData);
  });
}
async function deleteImage() { return Promise.resolve(); }
