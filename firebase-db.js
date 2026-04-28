// ─────────────────────────────────────────────────────────────
//  firebase-db.js  –  Gypsy Tattoo shared database layer
//
//  Firestore  → stores all data (markets, events, pricing, image URLs)
//  Cloudinary → stores the actual image files (free, no billing needed)
//
//  SETUP:
//  1. Sign up free at cloudinary.com
//  2. Copy your Cloud name from the Dashboard → paste below
//  3. Go to Settings → Upload → Add upload preset
//     Set Signing mode = Unsigned, name it "gypsytattoo" → Save
// ─────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDMWL6ug4-YOXxb9Ir7__eX_yovm64rsh8",
  authDomain:        "gypsytattoo-78690.firebaseapp.com",
  projectId:         "gypsytattoo-78690",
  storageBucket:     "gypsytattoo-78690.firebasestorage.app",
  messagingSenderId: "579547714873",
  appId:             "1:579547714873:web:ebed9234d4cae2351484e8",
};

// ── Cloudinary config ─────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME    = "dhvdekbua"; // ← paste your cloud name here
const CLOUDINARY_UPLOAD_PRESET = "gypsytattoo";     // ← must match your preset name

// ── Load Firebase compat SDK from CDN ────────────────────────
(function loadFirebase() {
  const scripts = [
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js",
  ];
  scripts.forEach((src) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
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

// ── Cloudinary image upload ───────────────────────────────────

/**
 * Upload a File to Cloudinary (free, no billing required).
 * Returns the secure public URL of the uploaded image.
 *
 * @param {File}     file       — raw File from <input type="file">
 * @param {string}   folder     — "portfolio" or "flash"
 * @param {function} onProgress — optional callback(percent 0–100)
 * @returns {Promise<string>}   secure image URL
 */
async function uploadImage(file, folder, onProgress) {
  if (CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME") {
    throw new Error("Cloudinary not configured — please set CLOUDINARY_CLOUD_NAME in firebase-db.js");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "gypsytattoo/" + folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url);
      } else {
        reject(new Error("Cloudinary upload failed: " + xhr.responseText));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(formData);
  });
}

/**
 * Cloudinary deletion from the browser requires a secret key so we skip it.
 * The URL is removed from Firestore so the image won't show — the file stays
 * on Cloudinary but the free tier has 25GB so this is fine in practice.
 */
async function deleteImage(url) {
  return Promise.resolve();
}

// ── Public Firestore API ──────────────────────────────────────
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
      localStorage.setItem(key, JSON.stringify(val));
      return val;
    }
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
  localStorage.setItem(key, JSON.stringify(val));
  try {
    await _waitForSDK();
    const db = _getDB();
    await db.collection(DB_COLLECTION).doc(key).set({ value: val });
  } catch (err) {
    console.error("[firebase-db] setData error:", err);
    throw err;
  }
}

/**
 * Load multiple keys in parallel from Firestore.
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
