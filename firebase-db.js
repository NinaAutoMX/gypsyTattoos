// ─────────────────────────────────────────────────────────────
//  firebase-db.js  –  Gypsy Tattoo shared database layer
//
//  Uses the Firebase CDN compat SDK (no build step needed).
//  Admin writes here → all visitors read the same data instantly.
//
//  HOW TO CONFIGURE:
//  1. Replace the values in FIREBASE_CONFIG below with your real
//     Firebase project credentials (see setup guide).
// ─────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDMWL6ug4-YOXxb9Ir7__eX_yovm64rsh8",
  authDomain:        "gypsytattoo-78690.firebaseapp.com",
  projectId:         "gypsytattoo-78690",
  storageBucket:     "gypsytattoo-78690.firebasestorage.app",
  messagingSenderId: "579547714873",
  appId:             "1:579547714873:web:ebed9234d4cae2351484e8",
};

// ── Load Firebase compat SDK from CDN ────────────────────────
(function loadFirebase() {
  const scripts = [
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js",
  ];
  scripts.forEach((src) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false; // keep load order
    document.head.appendChild(s);
  });
})();

// ── Internal state ────────────────────────────────────────────
let _db = null;

function _getDB() {
  if (_db) return _db;
  if (typeof firebase === "undefined") throw new Error("Firebase SDK not loaded.");
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  _db = firebase.firestore();
  return _db;
}

// Waits up to 4 seconds for the CDN scripts to finish loading
function _waitForSDK(attempts = 0) {
  return new Promise((resolve, reject) => {
    if (typeof firebase !== "undefined" && firebase.firestore) {
      resolve();
      return;
    }
    if (attempts > 40) {
      reject(new Error("Firebase SDK failed to load after 4 seconds."));
      return;
    }
    setTimeout(() => _waitForSDK(attempts + 1).then(resolve).catch(reject), 100);
  });
}

// ── Public API ────────────────────────────────────────────────
const DB_COLLECTION = "gypsyData";

/**
 * Read one key from Firestore. Falls back to localStorage if offline.
 * @param {string} key
 * @returns {Promise<any>}
 */
async function getData(key) {
  try {
    await _waitForSDK();
    const db = _getDB();
    const doc = await db.collection(DB_COLLECTION).doc(key).get();
    if (doc.exists) {
      const val = doc.data().value;
      localStorage.setItem(key, JSON.stringify(val)); // keep cache fresh
      return val;
    }
    // Document doesn't exist yet — return local cache or empty array
    const local = localStorage.getItem(key);
    return local ? JSON.parse(local) : [];
  } catch (err) {
    console.warn("[firebase-db] getData fallback to localStorage:", err);
    const local = localStorage.getItem(key);
    return local ? JSON.parse(local) : [];
  }
}

/**
 * Write one key to Firestore AND localStorage.
 * @param {string} key
 * @param {any} val
 */
async function setData(key, val) {
  // Write locally first for instant feedback
  localStorage.setItem(key, JSON.stringify(val));
  try {
    await _waitForSDK();
    const db = _getDB();
    await db.collection(DB_COLLECTION).doc(key).set({ value: val });
  } catch (err) {
    console.error("[firebase-db] setData error:", err);
    throw err; // re-throw so admin can show a toast
  }
}

/**
 * Load multiple keys in parallel from Firestore.
 * Populates localStorage as a side-effect, then returns all values.
 * @param {string[]} keys
 * @returns {Promise<Object>}
 */
async function getAllData(keys) {
  const results = {};
  await Promise.all(
    keys.map(async (key) => {
      results[key] = await getData(key);
    })
  );
  return results;
}
