import { useState, useCallback, useMemo, useRef, useEffect, createContext, useContext } from "react";

// ============================================================
// FIREBASE — Phase 4 Auth + Firestore
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const fbAuth = getAuth(firebaseApp);
const fbDb = getFirestore(firebaseApp);

// ── Role system ──
const ROLES = { ADMIN: 1, PARTNER: 2, PLANNER: 3, FAMILY: 4, READONLY: 5 };
const ROLE_NAMES = { 1: "Admin", 2: "Partner", 3: "Planner", 4: "Family", 5: "Read Only" };
const ROLE_COLORS = { 1: "#C41230", 2: "#B8871E", 3: "#5C6B3E", 4: "#1D5FA6", 5: "#6C6C70" };

const MODULE_ACCESS = {
  dashboard: [1,2,3,4,5], groups: [1,2,3,4], guests: [1,2,3,4],
  rsvp: [1,2,3], events: [1,2,3,4,5], activities: [1,2,3,4,5],
  tasks: [1,2,3], budget: [1,2], vendors: [1,2,3],
  timeline: [1,2,3,4,5], travel: [1,2,3], import: [1,2,3],
  ai: [1,2,3], comms: [1,2,3], settings: [1],
};

const EDIT_ACCESS = {
  guests: [1,2,3], groups: [1,2,3], tasks: [1,2,3],
  budget: [1,2], vendors: [1,2], travel: [1,2,3], import: [1,2,3],
};

const canAccess = (role, module) => MODULE_ACCESS[module]?.includes(role) ?? false;
const canEdit = (role, module) => EDIT_ACCESS[module]?.includes(role) ?? false;

// ── Auth Context ──
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

// ── Firestore helpers ──
const saveToFirestore = async (collectionName, id, data) => {
  try {
    // Strip non-serializable data (functions, undefined)
    const clean = JSON.parse(JSON.stringify(data));
    await setDoc(doc(fbDb, collectionName, id), clean, { merge: true });
  } catch (e) { console.warn("Firestore save error:", e); }
};

const subscribeCollection = (collectionName, callback) => {
  return onSnapshot(collection(fbDb, collectionName), snap => {
    const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    callback(data);
  }, err => console.warn("Firestore subscribe error:", err));
};

const seedCollection = async (collectionName, items) => {
  try {
    const snap = await getDoc(doc(fbDb, "_meta", collectionName));
    if (snap.exists()) return; // Already seeded
    const batch = writeBatch(fbDb);
    items.forEach(item => {
      batch.set(doc(fbDb, collectionName, item.id), item);
    });
    await batch.commit();
    await setDoc(doc(fbDb, "_meta", collectionName), { seeded: true });
  } catch (e) { console.warn("Seed error:", e); }
};

// ── Login Screen ──
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setError(""); setLoading(true);
    try {
      await signInWithEmailAndPassword(fbAuth, email, password);
    } catch (err) {
      setError(err.code === "auth/invalid-credential" ? "Invalid email or password" : "Login failed. Try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1C1C1E", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "0.02em", marginBottom: 8 }}>
            <span style={{ color: "#C41230" }}>SIRA</span>
            <span style={{ color: "#fff" }}>LEON</span>
            <span style={{ color: "#2D6DB5" }}>WEDDING</span>
            <span style={{ color: "#fff" }}>H</span>
            <span style={{ color: "#C41230" }}>Q</span>
          </div>
          <div style={{ fontSize: 13, color: "#AEAEB2" }}>Bangkok Wedding · 18 September 2026</div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: "0 0 24px", textAlign: "center" }}>Sign In</h2>
          {error && <div style={{ background: "rgba(196,18,48,0.15)", border: "1px solid rgba(196,18,48,0.4)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ff6b6b" }}>{error}</div>}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#AEAEB2", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Email</div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" autoComplete="email"
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "#fff", outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#AEAEB2", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Password</div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password"
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "#fff", outline: "none", fontFamily: "inherit" }} />
          </div>
          <button onClick={handleLogin} disabled={loading || !email || !password}
            style={{ width: "100%", background: loading ? "rgba(196,18,48,0.5)" : "#C41230", color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#AEAEB2" }}>Contact Leon for access</div>
      </div>
    </div>
  );
};

// ============================================================
// DESIGN TOKENS — Tuscan Morning × Ferrari Paddock
// ============================================================
// ============================================================
// GEMINI API — centralised helper
// Key stored in localStorage under "gemini_api_key"
// Set it once in Settings — all AI features use it automatically
// ============================================================
const getGeminiKey = () => localStorage.getItem("gemini_api_key") || "";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = (key) => `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

// Convert Anthropic-style messages to Gemini format
const toGeminiMessages = (messages, systemPrompt) => {
  const contents = [];
  if (systemPrompt) {
    // Gemini uses systemInstruction separately
  }
  messages.forEach(m => {
    if (Array.isArray(m.content)) {
      // Multi-modal (image + text)
      const parts = m.content.map(c => {
        if (c.type === "image") return { inlineData: { mimeType: c.source.media_type, data: c.source.data } };
        if (c.type === "text") return { text: c.text };
        return null;
      }).filter(Boolean);
      contents.push({ role: m.role === "assistant" ? "model" : "user", parts });
    } else {
      contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] });
    }
  });
  return contents;
};

const callGemini = async ({ messages, system, maxTokens = 1500, imageBase64 = null, imageType = null, textPrompt = null }) => {
  const key = getGeminiKey();
  if (!key) throw new Error("NO_KEY");

  let contents;

  // Simple single-turn with optional image
  if (textPrompt !== null) {
    const parts = [];
    if (imageBase64) parts.push({ inlineData: { mimeType: imageType || "image/jpeg", data: imageBase64 } });
    parts.push({ text: textPrompt });
    contents = [{ role: "user", parts }];
  } else {
    contents = toGeminiMessages(messages, system);
  }

  const body = {
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 }
  };

  const res = await fetch(GEMINI_URL(key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  return text;
};

const T = {
  cream: "#FAFAF7",
  linen: "#F2EDE4",
  linenDark: "#E8E0D2",
  rosso: "#C41230",
  rossoDark: "#9E0E26",
  rossoLight: "#F5E6EA",
  gold: "#B8871E",
  goldLight: "#F7F0E0",
  olive: "#5C6B3E",
  oliveLight: "#EDF0E7",
  carbon: "#1C1C1E",
  asphalt: "#3A3A3C",
  slate: "#6C6C70",
  mist: "#AEAEB2",
  white: "#FFFFFF",
  success: "#3A7D44",
  successLight: "#E8F5EA",
  warning: "#C8841A",
  warningLight: "#FDF3E3",
  danger: "#C41230",
  dangerLight: "#F5E6EA",
  info: "#1D5FA6",
  infoLight: "#E6EEF8",
};

// ============================================================
// SEED DATA
// ============================================================
const SEED_GUESTS = [
  // Immediate Family - Groom
  { id: "g001", firstName: "Margaret", lastName: "Chen", side: "Groom", category: "Immediate Family", group: "Immediate Family", relationship: "Mother", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "Vegetarian", hotel: "Mandarin Oriental", notes: "" },
  { id: "g002", firstName: "David", lastName: "Chen", side: "Groom", category: "Immediate Family", group: "Immediate Family", relationship: "Father", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Mandarin Oriental", notes: "" },
  { id: "g003", firstName: "James", lastName: "Chen", side: "Groom", category: "Immediate Family", group: "Immediate Family", relationship: "Brother", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Mandarin Oriental", notes: "" },
  { id: "g004", firstName: "Sophie", lastName: "Lee", side: "Groom", category: "Immediate Family", group: "Immediate Family", relationship: "Brother's Partner", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "Gluten Free", hotel: "Mandarin Oriental", notes: "" },
  { id: "g005", firstName: "Emily", lastName: "Chen", side: "Groom", category: "Immediate Family", group: "Immediate Family", relationship: "Sister", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g006", firstName: "Liam", lastName: "Chen", side: "Groom", category: "Immediate Family", group: "Immediate Family", relationship: "Nephew", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  // Extended Family - Dad Side
  { id: "g007", firstName: "Robert", lastName: "Chen", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Uncle", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Sukhothai", notes: "" },
  { id: "g008", firstName: "Linda", lastName: "Chen", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Aunt", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "Vegetarian", hotel: "Sukhothai", notes: "" },
  { id: "g009", firstName: "Michael", lastName: "Tan", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Uncle", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g010", firstName: "Helen", lastName: "Tan", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Aunt", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g011", firstName: "William", lastName: "Chen", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Uncle", rsvp: "Maybe", ceremonyRsvp: "Maybe", lunchRsvp: "Maybe", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "" },
  { id: "g012", firstName: "Nancy", lastName: "Chen", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Aunt", rsvp: "Maybe", ceremonyRsvp: "Maybe", lunchRsvp: "Maybe", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "" },
  { id: "g013", firstName: "George", lastName: "Wong", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Uncle", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g014", firstName: "Patricia", lastName: "Wong", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Aunt", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g015", firstName: "Thomas", lastName: "Lim", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Uncle", rsvp: "Declined", ceremonyRsvp: "Declined", lunchRsvp: "Declined", travelLikelihood: "Unlikely", dietary: "", hotel: "", notes: "Cannot travel" },
  { id: "g016", firstName: "Barbara", lastName: "Lim", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Aunt", rsvp: "Declined", ceremonyRsvp: "Declined", lunchRsvp: "Declined", travelLikelihood: "Unlikely", dietary: "", hotel: "", notes: "Cannot travel" },
  { id: "g017", firstName: "Charles", lastName: "Ng", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Uncle", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g018", firstName: "Dorothy", lastName: "Ng", side: "Groom", category: "Extended Family", group: "Dad Side", relationship: "Aunt", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  // Cousins
  { id: "g019", firstName: "Kevin", lastName: "Chen", side: "Groom", category: "Cousins", group: "Cousins", relationship: "Cousin", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Capella", notes: "" },
  { id: "g020", firstName: "Karen", lastName: "Chen", side: "Groom", category: "Cousins", group: "Cousins", relationship: "Cousin", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Capella", notes: "" },
  { id: "g021", firstName: "Daniel", lastName: "Wong", side: "Groom", category: "Cousins", group: "Cousins", relationship: "Cousin", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g022", firstName: "Lisa", lastName: "Tan", side: "Groom", category: "Cousins", group: "Cousins", relationship: "Cousin", rsvp: "Maybe", ceremonyRsvp: "Maybe", lunchRsvp: "Maybe", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "" },
  { id: "g023", firstName: "Jason", lastName: "Lim", side: "Groom", category: "Cousins", group: "Cousins", relationship: "Cousin", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g024", firstName: "Michelle", lastName: "Ng", side: "Groom", category: "Cousins", group: "Cousins", relationship: "Cousin", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g025", firstName: "Ryan", lastName: "Ong", side: "Groom", category: "Cousins", group: "Cousins", relationship: "Cousin", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "" },
  { id: "g026", firstName: "Stephanie", lastName: "Koh", side: "Groom", category: "Cousins", group: "Cousins", relationship: "Cousin", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "Vegan", hotel: "", notes: "" },
  { id: "g027", firstName: "Brandon", lastName: "Yeo", side: "Groom", category: "Cousins", group: "Cousins", relationship: "Cousin", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g028", firstName: "Chloe", lastName: "Tay", side: "Groom", category: "Cousins", group: "Cousins", relationship: "Cousin", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "" },
  // Wedding Party
  { id: "g029", firstName: "Marcus", lastName: "Hall", side: "Groom", category: "Wedding Party", group: "Wedding Party", relationship: "Best Man", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Capella", notes: "Best Man speech" },
  { id: "g030", firstName: "Sarah", lastName: "Hall", side: "Groom", category: "Wedding Party", group: "Wedding Party", relationship: "Best Man's Spouse", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "Vegetarian", hotel: "Capella", notes: "" },
  { id: "g031", firstName: "Alex", lastName: "Rivera", side: "Groom", category: "Wedding Party", group: "Wedding Party", relationship: "Groomsman", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Capella", notes: "" },
  { id: "g032", firstName: "Nina", lastName: "Rivera", side: "Groom", category: "Wedding Party", group: "Wedding Party", relationship: "Groomsman's Spouse", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Capella", notes: "" },
  { id: "g033", firstName: "Tom", lastName: "Bradley", side: "Groom", category: "Wedding Party", group: "Wedding Party", relationship: "Groomsman", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Capella", notes: "" },
  { id: "g034", firstName: "Claire", lastName: "Bradley", side: "Groom", category: "Wedding Party", group: "Wedding Party", relationship: "Groomsman's Spouse", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "Gluten Free", hotel: "Capella", notes: "" },
  { id: "g035", firstName: "Jake", lastName: "Morrison", side: "Groom", category: "Wedding Party", group: "Wedding Party", relationship: "Groomsman", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g036", firstName: "Amy", lastName: "Morrison", side: "Groom", category: "Wedding Party", group: "Wedding Party", relationship: "Groomsman's Spouse", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g037", firstName: "Chris", lastName: "Patel", side: "Groom", category: "Wedding Party", group: "Wedding Party", relationship: "Groomsman", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Capella", notes: "" },
  { id: "g038", firstName: "Priya", lastName: "Patel", side: "Groom", category: "Wedding Party", group: "Wedding Party", relationship: "Groomsman's Spouse", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "Vegetarian", hotel: "Capella", notes: "" },
  // Karate Core
  { id: "g039", firstName: "Sensei", lastName: "Yamamoto", side: "Groom", category: "Friends", group: "Karate Core", relationship: "Karate Sensei", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g040", firstName: "Ken", lastName: "Watanabe", side: "Groom", category: "Friends", group: "Karate Core", relationship: "Dojo Friend", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g041", firstName: "Hiroshi", lastName: "Tanaka", side: "Groom", category: "Friends", group: "Karate Core", relationship: "Dojo Friend", rsvp: "Maybe", ceremonyRsvp: "Maybe", lunchRsvp: "Maybe", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "" },
  { id: "g042", firstName: "Yuki", lastName: "Sato", side: "Groom", category: "Friends", group: "Karate Core", relationship: "Dojo Friend", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  // Muay Thai Friends
  { id: "g043", firstName: "Arjun", lastName: "Singh", side: "Groom", category: "Friends", group: "Muay Thai Friends", relationship: "Gym Friend", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "", notes: "" },
  { id: "g044", firstName: "Dmitri", lastName: "Volkov", side: "Groom", category: "Friends", group: "Muay Thai Friends", relationship: "Gym Friend", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "g045", firstName: "Marco", lastName: "Rossi", side: "Groom", category: "Friends", group: "Muay Thai Friends", relationship: "Gym Friend", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "" },
  // Close Friends
  { id: "g046", firstName: "Lucas", lastName: "Bennett", side: "Groom", category: "Friends", group: "Close Friends", relationship: "Close Friend", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Capella", notes: "" },
  { id: "g047", firstName: "Olivia", lastName: "Carter", side: "Groom", category: "Friends", group: "Close Friends", relationship: "Close Friend", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "Vegan", hotel: "", notes: "" },
  { id: "g048", firstName: "Noah", lastName: "Davies", side: "Groom", category: "Friends", group: "Close Friends", relationship: "Close Friend", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  // Bride Side - Immediate Family
  { id: "b001", firstName: "Grace", lastName: "Santos", side: "Bride", category: "Immediate Family", group: "Immediate Family", relationship: "Mother", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Mandarin Oriental", notes: "" },
  { id: "b002", firstName: "Antonio", lastName: "Santos", side: "Bride", category: "Immediate Family", group: "Immediate Family", relationship: "Father", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Mandarin Oriental", notes: "" },
  { id: "b003", firstName: "Isabella", lastName: "Santos", side: "Bride", category: "Immediate Family", group: "Immediate Family", relationship: "Sister", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Mandarin Oriental", notes: "" },
  { id: "b004", firstName: "Rafael", lastName: "Santos", side: "Bride", category: "Immediate Family", group: "Immediate Family", relationship: "Brother", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  // Bride Extended Family
  { id: "b005", firstName: "Carmen", lastName: "Reyes", side: "Bride", category: "Extended Family", group: "Mum Side", relationship: "Aunt", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Sukhothai", notes: "" },
  { id: "b006", firstName: "Luis", lastName: "Reyes", side: "Bride", category: "Extended Family", group: "Mum Side", relationship: "Uncle", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Sukhothai", notes: "" },
  { id: "b007", firstName: "Maria", lastName: "Garcia", side: "Bride", category: "Extended Family", group: "Mum Side", relationship: "Aunt", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "Vegetarian", hotel: "", notes: "" },
  { id: "b008", firstName: "Carlos", lastName: "Garcia", side: "Bride", category: "Extended Family", group: "Mum Side", relationship: "Uncle", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "b009", firstName: "Ana", lastName: "Lopez", side: "Bride", category: "Extended Family", group: "Mum Side", relationship: "Aunt", rsvp: "Maybe", ceremonyRsvp: "Maybe", lunchRsvp: "Maybe", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "" },
  { id: "b010", firstName: "Jose", lastName: "Lopez", side: "Bride", category: "Extended Family", group: "Mum Side", relationship: "Uncle", rsvp: "Maybe", ceremonyRsvp: "Maybe", lunchRsvp: "Maybe", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "" },
  // Bride Friends
  { id: "b011", firstName: "Sofia", lastName: "Kim", side: "Bride", category: "Friends", group: "Close Friends", relationship: "Best Friend", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Capella", notes: "" },
  { id: "b012", firstName: "Emma", lastName: "Johnson", side: "Bride", category: "Friends", group: "Close Friends", relationship: "Close Friend", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "Gluten Free", hotel: "Capella", notes: "" },
  { id: "b013", firstName: "Ava", lastName: "Wilson", side: "Bride", category: "Friends", group: "Close Friends", relationship: "Close Friend", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "b014", firstName: "Mia", lastName: "Taylor", side: "Bride", category: "Friends", group: "Close Friends", relationship: "Close Friend", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  // We Are Majulah
  { id: "b015", firstName: "Farah", lastName: "Abdullah", side: "Groom", category: "Friends", group: "We Are Majulah", relationship: "Community", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "Halal", hotel: "", notes: "" },
  { id: "b016", firstName: "Amir", lastName: "Hassan", side: "Groom", category: "Friends", group: "We Are Majulah", relationship: "Community", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Maybe", dietary: "Halal", hotel: "", notes: "" },
  { id: "b017", firstName: "Priscilla", lastName: "Tan", side: "Groom", category: "Friends", group: "We Are Majulah", relationship: "Community", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "", notes: "" },
  // Storyteller
  { id: "b018", firstName: "Zara", lastName: "Ahmed", side: "Groom", category: "Friends", group: "Storyteller", relationship: "Colleague", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", travelLikelihood: "Likely", dietary: "", hotel: "", notes: "" },
  { id: "b019", firstName: "Ethan", lastName: "Brooks", side: "Groom", category: "Friends", group: "Storyteller", relationship: "Colleague", rsvp: "Maybe", ceremonyRsvp: "Maybe", lunchRsvp: "Maybe", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "" },
  // VIPs
  { id: "b020", firstName: "Richard", lastName: "Lim", side: "Groom", category: "VIP", group: "VIPs", relationship: "Mentor", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "", hotel: "Mandarin Oriental", notes: "VIP treatment" },
  { id: "b021", firstName: "Christine", lastName: "Ho", side: "Bride", category: "VIP", group: "VIPs", relationship: "Godmother", rsvp: "Confirmed", ceremonyRsvp: "Confirmed", lunchRsvp: "Confirmed", travelLikelihood: "Certain", dietary: "Vegetarian", hotel: "Mandarin Oriental", notes: "VIP treatment" },
  // Buffer
  { id: "b022", firstName: "TBD", lastName: "Guest 01", side: "Groom", category: "Buffer", group: "Buffer", relationship: "TBD", rsvp: "Not Invited", ceremonyRsvp: "Not Invited", lunchRsvp: "Not Invited", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "Buffer slot" },
  { id: "b023", firstName: "TBD", lastName: "Guest 02", side: "Bride", category: "Buffer", group: "Buffer", relationship: "TBD", rsvp: "Not Invited", ceremonyRsvp: "Not Invited", lunchRsvp: "Not Invited", travelLikelihood: "Maybe", dietary: "", hotel: "", notes: "Buffer slot" },
];

const SEED_TASKS = [
  { id: "t001", ref: "T-001", task: "Book Thai Ceremony Venue", category: "Venue", owner: "Groom", dueDate: "2026-07-01", priority: "Critical", status: "Done", notes: "Mandarin Oriental confirmed", budgetRef: "B-001" },
  { id: "t002", ref: "T-002", task: "Confirm Lunch Reception Catering", category: "Catering", owner: "Bride", dueDate: "2026-07-15", priority: "Critical", status: "In Progress", notes: "Tasting scheduled", budgetRef: "B-003" },
  { id: "t003", ref: "T-003", task: "Send Save the Dates", category: "Communications", owner: "Both", dueDate: "2026-06-20", priority: "High", status: "Done", notes: "Via WithJoy", budgetRef: "" },
  { id: "t004", ref: "T-004", task: "Finalise Guest List - Groom Side", category: "Guests", owner: "Groom", dueDate: "2026-07-01", priority: "High", status: "In Progress", notes: "150 allocation", budgetRef: "" },
  { id: "t005", ref: "T-005", task: "Book Hotel Room Block - Mandarin Oriental", category: "Accommodation", owner: "Groom", dueDate: "2026-07-10", priority: "High", status: "In Progress", notes: "30 rooms needed", budgetRef: "B-011" },
  { id: "t006", ref: "T-006", task: "Hire Wedding Photographer", category: "Vendors", owner: "Both", dueDate: "2026-06-30", priority: "Critical", status: "Done", notes: "Studio Siam confirmed", budgetRef: "B-005" },
  { id: "t007", ref: "T-007", task: "Book Videographer", category: "Vendors", owner: "Both", dueDate: "2026-07-01", priority: "High", status: "In Progress", notes: "Shortlist of 3", budgetRef: "B-006" },
  { id: "t008", ref: "T-008", task: "Order Wedding Cake", category: "Catering", owner: "Bride", dueDate: "2026-08-01", priority: "Medium", status: "Not Started", notes: "", budgetRef: "B-008" },
  { id: "t009", ref: "T-009", task: "Arrange Airport Transfers", category: "Travel", owner: "Groom", dueDate: "2026-08-15", priority: "High", status: "Not Started", notes: "International guests", budgetRef: "B-012" },
  { id: "t010", ref: "T-010", task: "Plan Welcome Dinner", category: "Events", owner: "Both", dueDate: "2026-07-20", priority: "Medium", status: "Not Started", notes: "", budgetRef: "B-015" },
  { id: "t011", ref: "T-011", task: "Confirm Muay Thai Session Venue", category: "Activities", owner: "Groom", dueDate: "2026-07-25", priority: "Medium", status: "In Progress", notes: "Fairtex or Lumpinee", budgetRef: "" },
  { id: "t012", ref: "T-012", task: "Design Wedding Invitation", category: "Communications", owner: "Bride", dueDate: "2026-06-25", priority: "High", status: "Done", notes: "", budgetRef: "B-014" },
  { id: "t013", ref: "T-013", task: "Book Florist", category: "Vendors", owner: "Bride", dueDate: "2026-07-05", priority: "High", status: "In Progress", notes: "Thai orchid arrangements", budgetRef: "B-007" },
  { id: "t014", ref: "T-014", task: "Arrange Bridal Hair & Makeup", category: "Vendors", owner: "Bride", dueDate: "2026-07-10", priority: "High", status: "Not Started", notes: "", budgetRef: "" },
  { id: "t015", ref: "T-015", task: "Plan Golf Day", category: "Activities", owner: "Groom", dueDate: "2026-08-01", priority: "Low", status: "Not Started", notes: "Thai Country Club or Royal Gems", budgetRef: "" },
];

const SEED_BUDGET = [
  { id: "bud001", ref: "B-001", item: "Thai Ceremony Venue", category: "Venue", vendor: "Mandarin Oriental", estimated: 15000, actual: 14500, depositPaid: true, fullyPaid: false, notes: "Deposit paid", taskRef: "T-001" },
  { id: "bud002", ref: "B-002", item: "Lunch Reception Venue", category: "Venue", vendor: "Mandarin Oriental", estimated: 25000, actual: 25000, depositPaid: true, fullyPaid: false, notes: "", taskRef: "" },
  { id: "bud003", ref: "B-003", item: "Catering - Ceremony", category: "Catering", vendor: "MO Catering", estimated: 8000, actual: 0, depositPaid: false, fullyPaid: false, notes: "Quote pending", taskRef: "T-002" },
  { id: "bud004", ref: "B-004", item: "Catering - Reception", category: "Catering", vendor: "MO Catering", estimated: 35000, actual: 0, depositPaid: false, fullyPaid: false, notes: "Per head TBC", taskRef: "" },
  { id: "bud005", ref: "B-005", item: "Photography", category: "Photography", vendor: "Studio Siam", estimated: 6000, actual: 5800, depositPaid: true, fullyPaid: false, notes: "10hr package", taskRef: "T-006" },
  { id: "bud006", ref: "B-006", item: "Videography", category: "Photography", vendor: "TBC", estimated: 4000, actual: 0, depositPaid: false, fullyPaid: false, notes: "Shortlisting", taskRef: "T-007" },
  { id: "bud007", ref: "B-007", item: "Flowers & Decoration", category: "Flowers", vendor: "Bangkok Blooms", estimated: 8000, actual: 0, depositPaid: false, fullyPaid: false, notes: "", taskRef: "T-013" },
  { id: "bud008", ref: "B-008", item: "Wedding Cake", category: "Catering", vendor: "TBC", estimated: 1200, actual: 0, depositPaid: false, fullyPaid: false, notes: "", taskRef: "T-008" },
  { id: "bud009", ref: "B-009", item: "Wedding Dress", category: "Attire", vendor: "Private Label", estimated: 5000, actual: 4800, depositPaid: true, fullyPaid: true, notes: "Paid in full", taskRef: "" },
  { id: "bud010", ref: "B-010", item: "Groom Suit", category: "Attire", vendor: "Sam's Tailor", estimated: 1500, actual: 1400, depositPaid: true, fullyPaid: true, notes: "Bespoke suit", taskRef: "" },
  { id: "bud011", ref: "B-011", item: "Hotel Block - Mandarin Oriental", category: "Accommodation", vendor: "Mandarin Oriental", estimated: 45000, actual: 0, depositPaid: false, fullyPaid: false, notes: "30 rooms × 3 nights", taskRef: "T-005" },
  { id: "bud012", ref: "B-012", item: "Transportation & Transfers", category: "Travel", vendor: "TBC", estimated: 5000, actual: 0, depositPaid: false, fullyPaid: false, notes: "", taskRef: "T-009" },
  { id: "bud013", ref: "B-013", item: "Entertainment - Reception", category: "Entertainment", vendor: "TBC", estimated: 3000, actual: 0, depositPaid: false, fullyPaid: false, notes: "Band or DJ", taskRef: "" },
  { id: "bud014", ref: "B-014", item: "Invitations & Stationery", category: "Stationery", vendor: "Print & Co", estimated: 800, actual: 750, depositPaid: true, fullyPaid: true, notes: "300 sets", taskRef: "T-012" },
  { id: "bud015", ref: "B-015", item: "Welcome Dinner", category: "Events", vendor: "TBC", estimated: 8000, actual: 0, depositPaid: false, fullyPaid: false, notes: "", taskRef: "T-010" },
];

const SEED_VENDORS = [
  { id: "v001", name: "Mandarin Oriental Bangkok", service: "Venue", contact: "Khun Siriporn", phone: "+66 2 659 9000", email: "events@mohg.com", cost: 40000, depositStatus: "Paid", paymentStatus: "Partial", contractStatus: "Signed", notes: "Primary venue" },
  { id: "v002", name: "Studio Siam", service: "Photography", contact: "Kai Pattanapong", phone: "+66 89 123 4567", email: "kai@studiosiam.com", cost: 5800, depositStatus: "Paid", paymentStatus: "Partial", contractStatus: "Signed", notes: "10hr coverage, 2 shooters" },
  { id: "v003", name: "Bangkok Blooms", service: "Florist", contact: "Nong Siriwan", phone: "+66 81 234 5678", email: "info@bangkokblooms.com", cost: 8000, depositStatus: "Pending", paymentStatus: "Unpaid", contractStatus: "Pending", notes: "Thai orchid specialist" },
  { id: "v004", name: "Sam's Tailor", service: "Attire", contact: "Sam Malhotra", phone: "+66 2 234 9368", email: "sam@samstailor.com", cost: 1400, depositStatus: "Paid", paymentStatus: "Paid", contractStatus: "Signed", notes: "Bespoke groom suit" },
  { id: "v005", name: "Print & Co Bangkok", service: "Stationery", contact: "Joy Pornpimol", phone: "+66 82 345 6789", email: "hello@printco.th", cost: 750, depositStatus: "Paid", paymentStatus: "Paid", contractStatus: "N/A", notes: "300 invitation sets" },
  { id: "v006", name: "Fairtex Gym", service: "Activities", contact: "Kru Somchai", phone: "+66 85 456 7890", email: "events@fairtex.com", cost: 2000, depositStatus: "Pending", paymentStatus: "Unpaid", contractStatus: "Pending", notes: "Muay Thai session venue" },
];

const SEED_ACTIVITIES = [
  { id: "a001", name: "Muay Thai Session", category: "Sport", date: "2026-09-17", capacity: 20, cost: 2000, rsvpRequired: true, description: "Group Muay Thai session at Fairtex Gym", assignedGroups: ["Muay Thai Friends", "Close Friends"], notes: "Morning session 9-11am" },
  { id: "a002", name: "Golf Day", category: "Sport", date: "2026-09-16", capacity: 16, cost: 3000, rsvpRequired: true, description: "Golf at Thai Country Club", assignedGroups: ["Wedding Party", "VIPs"], notes: "Shotgun start 7am" },
  { id: "a003", name: "Temple Visit", category: "Culture", date: "2026-09-16", capacity: 40, cost: 500, rsvpRequired: false, description: "Visit Wat Arun and Wat Pho", assignedGroups: ["Immediate Family", "Extended Family"], notes: "Morning, dress modestly" },
  { id: "a004", name: "Night Market Tour", category: "Culture", date: "2026-09-17", capacity: 50, cost: 0, rsvpRequired: false, description: "Chatuchak and Asiatique evening", assignedGroups: ["All"], notes: "Optional, self-organised" },
  { id: "a005", name: "Welcome Dinner", category: "Dining", date: "2026-09-17", capacity: 80, cost: 8000, rsvpRequired: true, description: "Welcome dinner for international guests", assignedGroups: ["Immediate Family", "Wedding Party", "VIPs"], notes: "Rooftop venue TBC" },
];

const SEED_TIMELINE = [
  { id: "tl001", date: "2026-09-17", time: "18:00", title: "Welcome Dinner", location: "TBC Rooftop Venue", owner: "Both", type: "Event", notes: "International guests" },
  { id: "tl002", date: "2026-09-18", time: "08:00", title: "Bridal Preparations Begin", location: "Mandarin Oriental Suite", owner: "Bride", type: "Preparation", notes: "" },
  { id: "tl003", date: "2026-09-18", time: "09:00", title: "Groom Preparations Begin", location: "Mandarin Oriental Suite", owner: "Groom", type: "Preparation", notes: "" },
  { id: "tl004", date: "2026-09-18", time: "10:00", title: "Thai Ceremony Begins", location: "Mandarin Oriental Ballroom", owner: "Both", type: "Ceremony", notes: "Guests seated 09:45" },
  { id: "tl005", date: "2026-09-18", time: "12:00", title: "Ceremony Ends", location: "Mandarin Oriental Ballroom", owner: "Both", type: "Ceremony", notes: "" },
  { id: "tl006", date: "2026-09-18", time: "12:30", title: "Photography Session", location: "Hotel Gardens", owner: "Both", type: "Photography", notes: "45 min couple shots" },
  { id: "tl007", date: "2026-09-18", time: "13:30", title: "Lunch Reception Begins", location: "Mandarin Oriental Ballroom", owner: "Both", type: "Reception", notes: "Guests move from garden" },
  { id: "tl008", date: "2026-09-18", time: "14:00", title: "Speeches", location: "Mandarin Oriental Ballroom", owner: "Both", type: "Reception", notes: "Best Man, Parents, Couple" },
  { id: "tl009", date: "2026-09-18", time: "15:00", title: "Cake Cutting", location: "Mandarin Oriental Ballroom", owner: "Both", type: "Reception", notes: "" },
  { id: "tl010", date: "2026-09-18", time: "16:00", title: "Lunch Reception Ends", location: "Mandarin Oriental Ballroom", owner: "Both", type: "Reception", notes: "" },
];

const SEED_HOTELS = [
  { id: "h001", guestId: "g001", guest: "Margaret Chen", hotel: "Mandarin Oriental", roomType: "Deluxe River View", checkIn: "2026-09-16", checkOut: "2026-09-20", flightNumber: "SQ461", arrival: "2026-09-16 14:30", departure: "2026-09-20 10:00", transferRequired: true, notes: "" },
  { id: "h002", guestId: "g002", guest: "David Chen", hotel: "Mandarin Oriental", roomType: "Deluxe River View", checkIn: "2026-09-16", checkOut: "2026-09-20", flightNumber: "SQ461", arrival: "2026-09-16 14:30", departure: "2026-09-20 10:00", transferRequired: true, notes: "" },
  { id: "h003", guestId: "g029", guest: "Marcus Hall", hotel: "Capella Bangkok", roomType: "River Pool Villa", checkIn: "2026-09-17", checkOut: "2026-09-20", flightNumber: "BA011", arrival: "2026-09-17 08:00", departure: "2026-09-20 14:00", transferRequired: true, notes: "Best Man" },
  { id: "h004", guestId: "b001", guest: "Grace Santos", hotel: "Mandarin Oriental", roomType: "Suite", checkIn: "2026-09-15", checkOut: "2026-09-21", flightNumber: "PR721", arrival: "2026-09-15 18:00", departure: "2026-09-21 09:00", transferRequired: true, notes: "Bride's mother" },
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
const RSVP_PROBS = { "Certain": 0.95, "Likely": 0.75, "Maybe": 0.45, "Unlikely": 0.15, "Not Invited": 0 };

function calcForecast(guests) {
  const active = guests.filter(g => g.rsvp !== "Not Invited");
  const confirmed = active.filter(g => g.rsvp === "Confirmed").length;
  const declined = active.filter(g => g.rsvp === "Declined").length;
  const pending = active.filter(g => g.rsvp === "Invited" || g.rsvp === "Maybe").length;
  const invited = active.length;
  const projected = active.reduce((sum, g) => {
    if (g.rsvp === "Confirmed") return sum + 1;
    if (g.rsvp === "Declined") return sum;
    return sum + (RSVP_PROBS[g.travelLikelihood] || 0.5);
  }, 0);
  return { invited, confirmed, declined, pending, projected: Math.round(projected) };
}

function daysUntil(dateStr) {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtCurrency(n) {
  return "$" + Number(n || 0).toLocaleString();
}

// ============================================================
// SHARED UI COMPONENTS
// ============================================================

const Badge = ({ label, color = "mist" }) => {
  const styles = {
    rosso: { bg: T.rossoLight, text: T.rosso, border: T.rosso },
    gold: { bg: T.goldLight, text: T.gold, border: T.gold },
    olive: { bg: T.oliveLight, text: T.olive, border: T.olive },
    success: { bg: T.successLight, text: T.success, border: T.success },
    warning: { bg: T.warningLight, text: T.warning, border: T.warning },
    danger: { bg: T.dangerLight, text: T.danger, border: T.danger },
    info: { bg: T.infoLight, text: T.info, border: T.info },
    mist: { bg: T.linen, text: T.slate, border: T.mist },
    carbon: { bg: T.asphalt, text: "#fff", border: T.asphalt },
  };
  const s = styles[color] || styles.mist;
  return (
    <span style={{
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      borderRadius: 4, padding: "1px 8px", fontSize: 11, fontWeight: 600,
      letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap"
    }}>{label}</span>
  );
};

const rsvpBadge = (status) => {
  const map = { "Confirmed": "success", "Declined": "danger", "Invited": "info", "Maybe": "warning", "Not Invited": "mist" };
  return <Badge label={status} color={map[status] || "mist"} />;
};

const priorityBadge = (p) => {
  const map = { "Critical": "danger", "High": "rosso", "Medium": "warning", "Low": "olive" };
  return <Badge label={p} color={map[p] || "mist"} />;
};

const statusBadge = (s) => {
  const map = { "Done": "success", "In Progress": "info", "Not Started": "mist", "Blocked": "danger", "Waiting": "warning" };
  return <Badge label={s} color={map[s] || "mist"} />;
};

const Card = ({ children, style = {}, className = "" }) => (
  <div style={{
    background: T.white, borderRadius: 12, border: `1px solid ${T.linenDark}`,
    boxShadow: `0 1px 4px rgba(28,28,30,0.06)`, padding: 20, ...style
  }} className={className}>{children}</div>
);

const StatCard = ({ label, value, sub, color = T.carbon, accent = false }) => (
  <Card style={{ padding: "16px 20px" }}>
    <div style={{ fontSize: 12, color: T.slate, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color: accent ? T.rosso : T.carbon, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: T.mist, marginTop: 4 }}>{sub}</div>}
  </Card>
);

const SectionHeader = ({ title, subtitle, action }) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: T.carbon, margin: 0, letterSpacing: "-0.3px" }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: T.slate, margin: "4px 0 0", lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

const Btn = ({ children, onClick, variant = "primary", small = false, disabled = false }) => {
  const variants = {
    primary: { bg: T.rosso, color: "#fff", border: T.rosso },
    secondary: { bg: T.white, color: T.carbon, border: T.linenDark },
    ghost: { bg: "transparent", color: T.rosso, border: "transparent" },
    gold: { bg: T.gold, color: "#fff", border: T.gold },
    olive: { bg: T.olive, color: "#fff", border: T.olive },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: v.bg, color: v.color, border: `1.5px solid ${v.border}`,
      borderRadius: 8, padding: small ? "5px 12px" : "9px 18px",
      fontSize: small ? 12 : 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1, letterSpacing: "0.01em", transition: "all 0.15s", whiteSpace: "nowrap"
    }}>{children}</button>
  );
};

const Input = ({ value, onChange, placeholder, style = {} }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{
      border: `1.5px solid ${T.linenDark}`, borderRadius: 8, padding: "8px 12px",
      fontSize: 14, color: T.carbon, background: T.white, outline: "none",
      width: "100%", boxSizing: "border-box", ...style
    }} />
);

const Select = ({ value, onChange, options, style = {} }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{
      border: `1.5px solid ${T.linenDark}`, borderRadius: 8, padding: "8px 12px",
      fontSize: 14, color: T.carbon, background: T.white, outline: "none",
      width: "100%", boxSizing: "border-box", ...style
    }}>
    {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
  </select>
);

const EmptyState = ({ icon, title, sub }) => (
  <div style={{ textAlign: "center", padding: "48px 24px", color: T.slate }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontWeight: 700, fontSize: 16, color: T.carbon, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, lineHeight: 1.6 }}>{sub}</div>
  </div>
);

const ProgressBar = ({ value, max, color = T.rosso }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ background: T.linen, borderRadius: 99, height: 6, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 99, transition: "width 0.4s ease" }} />
    </div>
  );
};

const Table = ({ cols, rows, emptyMsg = "No data" }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ background: T.linen }}>
          {cols.map(c => (
            <th key={c.key} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: T.asphalt, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `2px solid ${T.linenDark}`, whiteSpace: "nowrap" }}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={cols.length} style={{ padding: 32, textAlign: "center", color: T.mist }}>{emptyMsg}</td></tr>
        ) : rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${T.linen}`, background: i % 2 === 0 ? T.white : T.cream }}>
            {cols.map(c => (
              <td key={c.key} style={{ padding: "10px 14px", color: T.carbon, verticalAlign: "middle" }}>
                {c.render ? c.render(r) : r[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ============================================================
// NAVIGATION
// ============================================================
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "◈" },
  { id: "groups", label: "Groups", icon: "⬡" },
  { id: "guests", label: "Guests", icon: "◎" },
  { id: "rsvp", label: "RSVP Forecast", icon: "◑" },
  { id: "events", label: "Events", icon: "◆" },
  { id: "activities", label: "Activities", icon: "▲" },
  { id: "tasks", label: "Tasks", icon: "✦" },
  { id: "budget", label: "Budget", icon: "◈" },
  { id: "vendors", label: "Vendors", icon: "◉" },
  { id: "timeline", label: "Timeline", icon: "⬘" },
  { id: "travel", label: "Travel", icon: "◈" },
  { id: "import", label: "Import", icon: "⊕" },
  { id: "ai", label: "AI Planner", icon: "✧" },
  { id: "comms", label: "Comms", icon: "◎" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

// ============================================================
// MODULE: DASHBOARD
// ============================================================
const Dashboard = ({ guests, tasks, budget, weddingDate }) => {
  const days = daysUntil(weddingDate);
  const groomGuests = guests.filter(g => g.side === "Groom" && g.rsvp !== "Not Invited");
  const brideGuests = guests.filter(g => g.side === "Bride" && g.rsvp !== "Not Invited");
  const groomConfirmed = groomGuests.filter(g => g.rsvp === "Confirmed").length;
  const brideConfirmed = brideGuests.filter(g => g.rsvp === "Confirmed").length;
  const forecast = calcForecast(guests);
  const totalBudget = budget.reduce((s, b) => s + b.estimated, 0);
  const totalActual = budget.reduce((s, b) => s + b.actual, 0);
  const outstanding = budget.filter(b => !b.fullyPaid).reduce((s, b) => s + (b.estimated - b.actual), 0);
  const urgentTasks = tasks.filter(t => t.status !== "Done" && (t.priority === "Critical" || t.priority === "High")).slice(0, 5);
  const overdue = tasks.filter(t => t.status !== "Done" && new Date(t.dueDate) < new Date()).length;

  return (
    <div>
      {/* Hero Countdown */}
      <div style={{
        background: `linear-gradient(135deg, ${T.carbon} 0%, ${T.asphalt} 60%, #4A3028 100%)`,
        borderRadius: 16, padding: "28px 28px 24px", marginBottom: 24, position: "relative", overflow: "hidden"
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(196,18,48,0.12)" }} />
        <div style={{ position: "absolute", bottom: -20, right: 60, width: 80, height: 80, borderRadius: "50%", background: "rgba(184,135,30,0.15)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 11, color: T.mist, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Bangkok Wedding · 18 September 2026</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 64, fontWeight: 900, color: "#fff", letterSpacing: "-3px", lineHeight: 1 }}>{days}</span>
            <span style={{ fontSize: 20, color: T.mist, fontWeight: 600 }}>days to go</span>
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
            {[
              { label: "Thai Ceremony", time: "10:00" },
              { label: "Lunch Reception", time: "13:30" },
              { label: "Venue", time: "Mandarin Oriental" },
            ].map(item => (
              <div key={item.label} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 8, padding: "6px 14px" }}>
                <div style={{ fontSize: 10, color: T.mist, letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</div>
                <div style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>{item.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Allocation Grid — Groom row then Bride row */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {/* Groom label */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: T.linenDark }} />
          <span style={{ fontSize: 10, color: T.rosso, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Groom</span>
          <div style={{ flex: 1, height: 1, background: T.linenDark }} />
        </div>
        {/* Groom row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Invited", value: groomGuests.length, sub: "/ 150" },
            { label: "Confirmed", value: groomConfirmed, accent: true, accentColor: T.rosso },
            { label: "Remaining", value: 150 - groomGuests.length, sub: "left" },
          ].map(s => (
            <div key={s.label} style={{ background: T.white, borderRadius: 10, border: `1px solid ${T.linenDark}`, padding: "12px 10px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 10, color: T.slate, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: s.accent ? s.accentColor : T.carbon, lineHeight: 1, letterSpacing: "-0.5px" }}>{s.value}</div>
              {s.sub && <div style={{ fontSize: 10, color: T.mist, marginTop: 3 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
        {/* Bride label */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: T.linenDark }} />
          <span style={{ fontSize: 10, color: T.gold, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Bride</span>
          <div style={{ flex: 1, height: 1, background: T.linenDark }} />
        </div>
        {/* Bride row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Invited", value: brideGuests.length, sub: "/ 150" },
            { label: "Confirmed", value: brideConfirmed, accent: true, accentColor: T.gold },
            { label: "Remaining", value: 150 - brideGuests.length, sub: "left" },
          ].map(s => (
            <div key={s.label} style={{ background: T.white, borderRadius: 10, border: `1px solid ${T.linenDark}`, padding: "12px 10px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 10, color: T.slate, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: s.accent ? s.accentColor : T.carbon, lineHeight: 1, letterSpacing: "-0.5px" }}>{s.value}</div>
              {s.sub && <div style={{ fontSize: 10, color: T.mist, marginTop: 3 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Total Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <StatCard label="Total Invited" value={forecast.invited} />
        <StatCard label="Confirmed" value={forecast.confirmed} accent />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[
          { label: "Declined", value: forecast.declined, color: T.danger },
          { label: "Pending", value: forecast.pending, color: T.warning },
          { label: "Projected", value: forecast.projected, color: T.olive },
        ].map(s => (
          <div key={s.label} style={{ background: T.white, borderRadius: 10, border: `1px solid ${T.linenDark}`, padding: "10px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 10, color: T.slate, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Budget + Tasks Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Budget Summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Total Budget", value: fmtCurrency(totalBudget), color: T.carbon },
              { label: "Spent to Date", value: fmtCurrency(totalActual), color: T.rosso },
              { label: "Outstanding", value: fmtCurrency(outstanding), color: T.warning },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: T.slate }}>{item.label}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</span>
              </div>
            ))}
            <ProgressBar value={totalActual} max={totalBudget} color={T.rosso} />
            <div style={{ fontSize: 11, color: T.mist, textAlign: "right" }}>{Math.round((totalActual / totalBudget) * 100)}% spent</div>
          </div>
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Urgent Tasks</div>
            {overdue > 0 && <Badge label={`${overdue} Overdue`} color="danger" />}
          </div>
          {urgentTasks.length === 0 ? (
            <div style={{ color: T.mist, fontSize: 13 }}>All urgent tasks complete 🎉</div>
          ) : urgentTasks.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: `1px solid ${T.linen}`, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.carbon }}>{t.task}</div>
                <div style={{ fontSize: 11, color: T.mist }}>{fmtDate(t.dueDate)}</div>
              </div>
              {priorityBadge(t.priority)}
            </div>
          ))}
        </Card>
      </div>

      {/* RSVP Breakdown by Side */}
      <Card>
        <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>Allocation Overview</div>
        {[
          { label: "Groom Side", invited: groomGuests.length, confirmed: groomConfirmed, max: 150, color: T.rosso },
          { label: "Bride Side", invited: brideGuests.length, confirmed: brideConfirmed, max: 150, color: T.gold },
        ].map(side => (
          <div key={side.label} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.carbon }}>{side.label}</span>
              <span style={{ fontSize: 13, color: T.slate }}>{side.invited} / {side.max} invited · {side.confirmed} confirmed</span>
            </div>
            <ProgressBar value={side.invited} max={side.max} color={side.color} />
          </div>
        ))}
      </Card>
    </div>
  );
};

// ============================================================
// MODULE: GUESTS — Sprint A
// ============================================================

const Guests = ({ guests, setGuests }) => {
  const [search, setSearch] = useState("");
  const [filterSide, setFilterSide] = useState("All");
  const [filterRsvp, setFilterRsvp] = useState("All");
  const [filterGroup, setFilterGroup] = useState("All");
  const [view, setView] = useState("list"); // list | detail | edit | add | bulk | dupes
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkField, setBulkField] = useState("rsvp");
  const [bulkValue, setBulkValue] = useState("");
  const [newGuestForm, setNewGuestForm] = useState({ firstName: "", lastName: "", side: "Groom", category: "Friends", group: "Unassigned", relationship: "", travelLikelihood: "Likely", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", dietary: "", hotel: "", notes: "" });
  const [toast, setToast] = useState(null);
  const [historyLog, setHistoryLog] = useState([]);

  const groups = ["All", ...Array.from(new Set(guests.map(g => g.group))).filter(Boolean).sort()];
  const groupOptions = Array.from(new Set(guests.map(g => g.group))).filter(Boolean).sort();
  const sides = ["All", "Groom", "Bride", "Both"];
  const rsvpOptions = ["All", "Confirmed", "Invited", "Maybe", "Declined", "Not Invited"];
  const rsvpValues = ["Confirmed", "Invited", "Maybe", "Declined", "Not Invited"];
  const travelOptions = ["Certain", "Likely", "Maybe", "Unlikely"];

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const logChange = (guestName, field, oldVal, newVal) => {
    setHistoryLog(prev => [{
      id: Date.now(), time: new Date().toLocaleTimeString(), guest: guestName,
      field, from: oldVal, to: newVal
    }, ...prev].slice(0, 100));
  };

  const filtered = guests.filter(g => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${g.firstName} ${g.lastName}`.toLowerCase().includes(q) || g.group?.toLowerCase().includes(q) || g.relationship?.toLowerCase().includes(q);
    const matchSide = filterSide === "All" || g.side === filterSide;
    const matchRsvp = filterRsvp === "All" || g.rsvp === filterRsvp;
    const matchGroup = filterGroup === "All" || g.group === filterGroup;
    return matchSearch && matchSide && matchRsvp && matchGroup;
  });

  // Duplicate detection — same first+last name
  const dupes = useMemo(() => {
    const seen = {};
    guests.forEach(g => {
      const key = `${g.firstName.toLowerCase()} ${g.lastName.toLowerCase()}`.trim();
      if (!seen[key]) seen[key] = [];
      seen[key].push(g);
    });
    return Object.values(seen).filter(arr => arr.length > 1);
  }, [guests]);

  // ── SAVE EDIT ──
  const saveEdit = () => {
    const original = guests.find(g => g.id === editForm.id);
    Object.keys(editForm).forEach(k => {
      if (original[k] !== editForm[k]) {
        logChange(`${editForm.firstName} ${editForm.lastName}`, k, original[k], editForm[k]);
      }
    });
    setGuests(prev => prev.map(g => g.id === editForm.id ? { ...editForm } : g));
    showToast(`${editForm.firstName} ${editForm.lastName} updated`);
    setView("detail");
  };

  // ── SAVE NEW GUEST ──
  const saveNewGuest = () => {
    if (!newGuestForm.firstName.trim()) return;
    const id = "g" + Date.now();
    setGuests(prev => [...prev, { ...newGuestForm, id }]);
    logChange(`${newGuestForm.firstName} ${newGuestForm.lastName}`, "created", "—", "New guest");
    showToast(`${newGuestForm.firstName} ${newGuestForm.lastName} added`);
    setNewGuestForm({ firstName: "", lastName: "", side: "Groom", category: "Friends", group: "Unassigned", relationship: "", travelLikelihood: "Likely", rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited", dietary: "", hotel: "", notes: "" });
    setView("list");
  };

  // ── BULK EDIT ──
  const applyBulk = () => {
    if (!bulkValue || bulkSelected.length === 0) return;
    setGuests(prev => prev.map(g => {
      if (!bulkSelected.includes(g.id)) return g;
      logChange(`${g.firstName} ${g.lastName}`, bulkField, g[bulkField], bulkValue);
      return { ...g, [bulkField]: bulkValue };
    }));
    showToast(`Updated ${bulkSelected.length} guests`);
    setBulkSelected([]);
    setView("list");
  };

  // ── MERGE DUPES ──
  const mergeDupes = (keep, remove) => {
    setGuests(prev => prev.filter(g => g.id !== remove));
    logChange(keep.firstName + " " + keep.lastName, "merged", "duplicate removed", "kept " + keep.id);
    showToast("Duplicate removed");
  };

  // ── DELETE GUEST ──
  const deleteGuest = (id) => {
    const g = guests.find(x => x.id === id);
    setGuests(prev => prev.filter(x => x.id !== id));
    showToast(`${g.firstName} ${g.lastName} deleted`, "danger");
    setView("list");
  };

  const selectedGuest = guests.find(g => g.id === selectedId);

  const EditField = ({ label, field, type = "text", options }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</div>
      {options ? (
        <Select value={editForm[field] || ""} onChange={v => setEditForm(p => ({ ...p, [field]: v }))} options={options} />
      ) : (
        <Input value={editForm[field] || ""} onChange={v => setEditForm(p => ({ ...p, [field]: v }))} />
      )}
    </div>
  );

  // ── DETAIL VIEW ──
  if (view === "detail" && selectedGuest) {
    const g = selectedGuest;
    return (
      <div>
        {toast && <div style={{ position: "fixed", top: 64, right: 16, zIndex: 300, background: toast.type === "danger" ? T.danger : T.success, color: "#fff", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>{toast.msg}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <Btn variant="secondary" small onClick={() => setView("list")}>← Back</Btn>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, flex: 1 }}>{g.firstName} {g.lastName}</h2>
          <Btn small onClick={() => { setEditForm({ ...g }); setView("edit"); }}>Edit</Btn>
          <Btn variant="secondary" small onClick={() => deleteGuest(g.id)}>Delete</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Side", value: <Badge label={g.side} color={g.side === "Groom" ? "rosso" : "gold"} /> },
            { label: "Group", value: g.group },
            { label: "Category", value: g.category },
            { label: "Relationship", value: g.relationship },
            { label: "RSVP", value: rsvpBadge(g.rsvp) },
            { label: "Ceremony", value: rsvpBadge(g.ceremonyRsvp) },
            { label: "Lunch", value: rsvpBadge(g.lunchRsvp) },
            { label: "Travel", value: g.travelLikelihood },
            { label: "Dietary", value: g.dietary || <span style={{ color: T.mist }}>None</span> },
            { label: "Hotel", value: g.hotel || <span style={{ color: T.mist }}>—</span> },
          ].map(item => (
            <Card key={item.label} style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 10, color: T.mist, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.carbon }}>{item.value}</div>
            </Card>
          ))}
        </div>
        {g.notes && <Card style={{ marginBottom: 16, padding: "12px 16px" }}><div style={{ fontSize: 11, color: T.mist, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Notes</div><div style={{ fontSize: 14, color: T.carbon }}>{g.notes}</div></Card>}
        {/* Change history for this guest */}
        {historyLog.filter(h => h.guest === `${g.firstName} ${g.lastName}`).length > 0 && (
          <Card>
            <div style={{ fontSize: 11, color: T.mist, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Change History</div>
            {historyLog.filter(h => h.guest === `${g.firstName} ${g.lastName}`).map(h => (
              <div key={h.id} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${T.linen}`, fontSize: 12 }}>
                <span style={{ color: T.mist, flexShrink: 0 }}>{h.time}</span>
                <span style={{ color: T.carbon }}><strong>{h.field}</strong>: {h.from} → {h.to}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  }

  // ── EDIT VIEW ──
  if (view === "edit" && editForm) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <Btn variant="secondary" small onClick={() => setView("detail")}>← Cancel</Btn>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, flex: 1 }}>Edit — {editForm.firstName} {editForm.lastName}</h2>
          <Btn small onClick={saveEdit}>Save Changes</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.carbon, marginBottom: 14, borderBottom: `1px solid ${T.linen}`, paddingBottom: 8 }}>Identity</div>
            <EditField label="First Name" field="firstName" />
            <EditField label="Last Name" field="lastName" />
            <EditField label="Side" field="side" options={["Groom", "Bride", "Both"]} />
            <EditField label="Category" field="category" options={["Immediate Family", "Extended Family", "Cousins", "Wedding Party", "Friends", "VIP", "Buffer"]} />
            <EditField label="Group" field="group" options={groupOptions} />
            <EditField label="Relationship" field="relationship" />
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.carbon, marginBottom: 14, borderBottom: `1px solid ${T.linen}`, paddingBottom: 8 }}>RSVP & Travel</div>
            <EditField label="RSVP Status" field="rsvp" options={rsvpValues} />
            <EditField label="Ceremony RSVP" field="ceremonyRsvp" options={rsvpValues} />
            <EditField label="Lunch RSVP" field="lunchRsvp" options={rsvpValues} />
            <EditField label="Travel Likelihood" field="travelLikelihood" options={travelOptions} />
            <div style={{ fontSize: 12, fontWeight: 700, color: T.carbon, margin: "16px 0 14px", borderBottom: `1px solid ${T.linen}`, paddingBottom: 8 }}>Logistics</div>
            <EditField label="Dietary Requirements" field="dietary" />
            <EditField label="Hotel" field="hotel" />
            <EditField label="Notes" field="notes" />
          </Card>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <Btn onClick={saveEdit}>Save Changes</Btn>
          <Btn variant="secondary" onClick={() => setView("detail")}>Cancel</Btn>
        </div>
      </div>
    );
  }

  // ── ADD GUEST VIEW ──
  if (view === "add") {
    const nf = newGuestForm;
    const setNf = (k, v) => setNewGuestForm(p => ({ ...p, [k]: v }));
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <Btn variant="secondary" small onClick={() => setView("list")}>← Cancel</Btn>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Add New Guest</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.carbon, marginBottom: 14, borderBottom: `1px solid ${T.linen}`, paddingBottom: 8 }}>Identity</div>
            {[
              { label: "First Name *", key: "firstName" },
              { label: "Last Name", key: "lastName" },
              { label: "Relationship", key: "relationship" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{f.label}</div>
                <Input value={nf[f.key]} onChange={v => setNf(f.key, v)} />
              </div>
            ))}
            {[
              { label: "Side", key: "side", options: ["Groom", "Bride", "Both"] },
              { label: "Category", key: "category", options: ["Immediate Family", "Extended Family", "Cousins", "Wedding Party", "Friends", "VIP", "Buffer"] },
              { label: "Group", key: "group", options: ["Unassigned", ...groupOptions] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{f.label}</div>
                <Select value={nf[f.key]} onChange={v => setNf(f.key, v)} options={f.options} />
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.carbon, marginBottom: 14, borderBottom: `1px solid ${T.linen}`, paddingBottom: 8 }}>RSVP & Logistics</div>
            {[
              { label: "RSVP Status", key: "rsvp", options: rsvpValues },
              { label: "Ceremony RSVP", key: "ceremonyRsvp", options: rsvpValues },
              { label: "Lunch RSVP", key: "lunchRsvp", options: rsvpValues },
              { label: "Travel Likelihood", key: "travelLikelihood", options: travelOptions },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{f.label}</div>
                <Select value={nf[f.key]} onChange={v => setNf(f.key, v)} options={f.options} />
              </div>
            ))}
            {[
              { label: "Dietary", key: "dietary" },
              { label: "Hotel", key: "hotel" },
              { label: "Notes", key: "notes" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{f.label}</div>
                <Input value={nf[f.key]} onChange={v => setNf(f.key, v)} />
              </div>
            ))}
          </Card>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <Btn onClick={saveNewGuest} disabled={!nf.firstName.trim()}>Add Guest</Btn>
          <Btn variant="secondary" onClick={() => setView("list")}>Cancel</Btn>
        </div>
      </div>
    );
  }

  // ── BULK EDIT VIEW ──
  if (view === "bulk") {
    const bulkFieldOptions = [
      { value: "rsvp", label: "RSVP Status" },
      { value: "ceremonyRsvp", label: "Ceremony RSVP" },
      { value: "lunchRsvp", label: "Lunch RSVP" },
      { value: "travelLikelihood", label: "Travel Likelihood" },
      { value: "side", label: "Side" },
      { value: "group", label: "Group" },
    ];
    const bulkValueOptions = {
      rsvp: rsvpValues, ceremonyRsvp: rsvpValues, lunchRsvp: rsvpValues,
      travelLikelihood: travelOptions, side: ["Groom", "Bride", "Both"],
      group: groupOptions,
    };
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <Btn variant="secondary" small onClick={() => { setView("list"); setBulkSelected([]); }}>← Cancel</Btn>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, flex: 1 }}>Bulk Edit</h2>
          <Badge label={`${bulkSelected.length} selected`} color="rosso" />
        </div>
        <Card style={{ marginBottom: 16, padding: "16px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.carbon, marginBottom: 14 }}>Apply to {bulkSelected.length} selected guests</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, marginBottom: 5 }}>Field to Update</div>
              <Select value={bulkField} onChange={v => { setBulkField(v); setBulkValue(""); }}
                options={bulkFieldOptions.map(o => ({ value: o.value, label: o.label }))} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, marginBottom: 5 }}>New Value</div>
              <Select value={bulkValue} onChange={setBulkValue}
                options={["Select…", ...(bulkValueOptions[bulkField] || [])]} />
            </div>
            <Btn onClick={applyBulk} disabled={!bulkValue || bulkValue === "Select…" || bulkSelected.length === 0}>Apply to {bulkSelected.length} guests</Btn>
          </div>
        </Card>
        <Card style={{ padding: 0 }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.linen}`, display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={bulkSelected.length === filtered.length} onChange={e => setBulkSelected(e.target.checked ? filtered.map(g => g.id) : [])} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.carbon }}>Select all ({filtered.length})</span>
          </div>
          {filtered.map(g => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${T.linen}`, background: bulkSelected.includes(g.id) ? T.rossoLight : "transparent" }}>
              <input type="checkbox" checked={bulkSelected.includes(g.id)} onChange={e => setBulkSelected(prev => e.target.checked ? [...prev, g.id] : prev.filter(id => id !== g.id))} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.carbon }}>{g.firstName} {g.lastName}</div>
                <div style={{ fontSize: 11, color: T.mist }}>{g.group} · {g.side}</div>
              </div>
              {rsvpBadge(g.rsvp)}
            </div>
          ))}
        </Card>
      </div>
    );
  }

  // ── DUPLICATES VIEW ──
  if (view === "dupes") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Btn variant="secondary" small onClick={() => setView("list")}>← Back</Btn>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Duplicate Detection</h2>
          <Badge label={`${dupes.length} groups`} color={dupes.length > 0 ? "warning" : "success"} />
        </div>
        {dupes.length === 0 ? (
          <Card><EmptyState icon="✓" title="No duplicates found" sub="All guest names are unique" /></Card>
        ) : dupes.map((group, i) => (
          <Card key={i} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.warning, marginBottom: 12 }}>⚠ Possible duplicate — {group[0].firstName} {group[0].lastName}</div>
            {group.map((g, j) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: j < group.length - 1 ? `1px solid ${T.linen}` : "none" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.carbon }}>{g.firstName} {g.lastName}</div>
                  <div style={{ fontSize: 11, color: T.mist }}>{g.group} · {g.side} · {g.relationship}</div>
                  <div style={{ marginTop: 4 }}>{rsvpBadge(g.rsvp)}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn small variant="secondary" onClick={() => { setSelectedId(g.id); setView("detail"); }}>View</Btn>
                  {j > 0 && <Btn small onClick={() => mergeDupes(group[0], g.id)}>Remove</Btn>}
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>
    );
  }

  // ── HISTORY VIEW ──
  if (view === "history") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Btn variant="secondary" small onClick={() => setView("list")}>← Back</Btn>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Change History</h2>
          <Badge label={`${historyLog.length} changes`} color="info" />
        </div>
        {historyLog.length === 0 ? (
          <Card><EmptyState icon="◎" title="No changes yet" sub="Changes made to guests will appear here" /></Card>
        ) : (
          <Card style={{ padding: 0 }}>
            {historyLog.map(h => (
              <div key={h.id} style={{ display: "flex", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${T.linen}`, alignItems: "flex-start" }}>
                <span style={{ fontSize: 11, color: T.mist, flexShrink: 0, paddingTop: 2 }}>{h.time}</span>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: T.carbon }}>{h.guest}</span>
                  <span style={{ fontSize: 12, color: T.slate }}> · {h.field}</span>
                  <div style={{ fontSize: 12, color: T.mist, marginTop: 2 }}>
                    <span style={{ color: T.danger }}>{h.from}</span>
                    <span> → </span>
                    <span style={{ color: T.success }}>{h.to}</span>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 64, right: 16, zIndex: 300, background: toast.type === "danger" ? T.danger : T.success, color: "#fff", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>{toast.msg}</div>}
      <SectionHeader
        title="Guest Management"
        subtitle={`${filtered.length} of ${guests.length} guests`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            {dupes.length > 0 && <Btn small variant="secondary" onClick={() => setView("dupes")}>⚠ {dupes.length} Dupes</Btn>}
            <Btn small variant="secondary" onClick={() => setView("history")}>History</Btn>
            <Btn small variant="secondary" onClick={() => { setBulkSelected(filtered.map(g => g.id)); setView("bulk"); }}>Bulk Edit</Btn>
            <Btn small onClick={() => setView("add")}>+ Add Guest</Btn>
          </div>
        }
      />
      <Card style={{ marginBottom: 16, padding: "14px 16px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Input value={search} onChange={setSearch} placeholder="Search name, group, relationship…" style={{ flex: 2, minWidth: 160 }} />
          <Select value={filterSide} onChange={setFilterSide} options={sides} style={{ flex: 1, minWidth: 90 }} />
          <Select value={filterRsvp} onChange={setFilterRsvp} options={rsvpOptions} style={{ flex: 1, minWidth: 110 }} />
          <Select value={filterGroup} onChange={setFilterGroup} options={groups} style={{ flex: 1, minWidth: 130 }} />
        </div>
      </Card>
      <Card style={{ padding: 0 }}>
        <Table
          cols={[
            { key: "name", label: "Guest", render: r => (
              <button onClick={() => { setSelectedId(r.id); setView("detail"); }} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                <div style={{ fontWeight: 700, color: T.carbon, fontSize: 14 }}>{r.firstName} {r.lastName}</div>
                <div style={{ fontSize: 11, color: T.mist }}>{r.relationship}</div>
              </button>
            )},
            { key: "side", label: "Side", render: r => <Badge label={r.side} color={r.side === "Groom" ? "rosso" : r.side === "Bride" ? "gold" : "olive"} /> },
            { key: "group", label: "Group", render: r => <span style={{ fontSize: 12, color: T.slate }}>{r.group}</span> },
            { key: "rsvp", label: "RSVP", render: r => rsvpBadge(r.rsvp) },
            { key: "travel", label: "Travel", render: r => <span style={{ fontSize: 12, color: T.slate }}>{r.travelLikelihood}</span> },
            { key: "dietary", label: "Dietary", render: r => r.dietary ? <Badge label={r.dietary} color="olive" /> : <span style={{ color: T.mist, fontSize: 12 }}>—</span> },
            { key: "edit", label: "", render: r => (
              <button onClick={() => { setEditForm({ ...r }); setSelectedId(r.id); setView("edit"); }} style={{ background: T.linen, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: T.slate, cursor: "pointer", fontWeight: 700 }}>Edit</button>
            )},
          ]}
          rows={filtered}
        />
      </Card>
    </div>
  );
};

// ============================================================
// MODULE: GROUPS (Editable + Inline Guest Creation)
// ============================================================
const Groups = ({ guests, setGuests }) => {
  const [editingGroup, setEditingGroup] = useState(null);
  const [editName, setEditName] = useState("");
  const [addingGuest, setAddingGuest] = useState(null);
  const [guestSearch, setGuestSearch] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({ firstName: "", lastName: "", side: "Groom", relationship: "", dietary: "", notes: "" });

  const groupData = useMemo(() => {
    const map = {};
    guests.forEach(g => {
      if (!g.group) return;
      if (!map[g.group]) map[g.group] = { name: g.group, guests: [] };
      map[g.group].guests.push(g);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [guests]);

  const sideBadge = (groupGuests) => {
    const sides = [...new Set(groupGuests.map(x => x.side))];
    if (sides.length > 1) return <Badge label="Mixed" color="olive" />;
    if (sides[0] === "Groom") return <Badge label="Groom" color="rosso" />;
    if (sides[0] === "Bride") return <Badge label="Bride" color="gold" />;
    return <Badge label="—" color="mist" />;
  };

  const handleRename = (oldName) => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === oldName) { setEditingGroup(null); return; }
    setGuests(prev => prev.map(g => g.group === oldName ? { ...g, group: trimmed } : g));
    setEditingGroup(null);
  };

  const handleRemoveFromGroup = (guestId) => {
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, group: "Unassigned" } : g));
  };

  const handleAddToGroup = (guestId, groupName) => {
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, group: groupName } : g));
  };

  const handleDeleteGroup = (groupName) => {
    setGuests(prev => prev.map(g => g.group === groupName ? { ...g, group: "Unassigned" } : g));
    setConfirmDelete(null);
  };

  const handleCreateGroup = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    setNewGroupName("");
    setShowNewGroup(false);
    setAddingGuest(trimmed);
  };

  // Create a brand new guest directly from the group panel
  const handleCreateGuest = (groupName) => {
    const first = newGuest.firstName.trim();
    if (!first) return;
    const id = "g" + Date.now();
    const guest = {
      id, firstName: first, lastName: newGuest.lastName.trim(),
      side: newGuest.side, category: "Friends", group: groupName,
      relationship: newGuest.relationship.trim() || "Guest",
      rsvp: "Invited", ceremonyRsvp: "Invited", lunchRsvp: "Invited",
      travelLikelihood: "Likely", dietary: newGuest.dietary.trim(),
      hotel: "", notes: newGuest.notes.trim(),
    };
    setGuests(prev => [...prev, guest]);
    setNewGuest({ firstName: "", lastName: "", side: "Groom", relationship: "", dietary: "", notes: "" });
    setShowNewGuest(false);
  };

  const outsideGuests = useMemo(() => {
    if (!addingGuest) return [];
    return guests.filter(g => g.group !== addingGuest).filter(g => {
      const q = guestSearch.toLowerCase();
      return !q || `${g.firstName} ${g.lastName}`.toLowerCase().includes(q) || g.group?.toLowerCase().includes(q);
    });
  }, [guests, addingGuest, guestSearch]);

  // ── MANAGE MEMBERS VIEW ──
  if (addingGuest) {
    const inGroup = guests.filter(g => g.group === addingGuest);
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <Btn variant="secondary" onClick={() => { setAddingGuest(null); setGuestSearch(""); setShowNewGuest(false); }}>← Back</Btn>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.carbon }}>{addingGuest}</h2>
          <Badge label={`${inGroup.length} members`} color="rosso" />
        </div>

        {/* Quick-add new guest form */}
        {showNewGuest ? (
          <Card style={{ marginBottom: 16, background: T.goldLight, border: `1.5px solid ${T.gold}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.carbon, marginBottom: 14 }}>
              New Guest → {addingGuest}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, marginBottom: 4 }}>First Name *</div>
                <Input value={newGuest.firstName} onChange={v => setNewGuest(p => ({ ...p, firstName: v }))} placeholder="First name" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, marginBottom: 4 }}>Last Name</div>
                <Input value={newGuest.lastName} onChange={v => setNewGuest(p => ({ ...p, lastName: v }))} placeholder="Last name" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, marginBottom: 4 }}>Side</div>
                <Select value={newGuest.side} onChange={v => setNewGuest(p => ({ ...p, side: v }))} options={["Groom", "Bride", "Both"]} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, marginBottom: 4 }}>Relationship</div>
                <Input value={newGuest.relationship} onChange={v => setNewGuest(p => ({ ...p, relationship: v }))} placeholder="e.g. School Friend" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, marginBottom: 4 }}>Dietary</div>
                <Input value={newGuest.dietary} onChange={v => setNewGuest(p => ({ ...p, dietary: v }))} placeholder="e.g. Vegetarian" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, marginBottom: 4 }}>Notes</div>
                <Input value={newGuest.notes} onChange={v => setNewGuest(p => ({ ...p, notes: v }))} placeholder="Optional notes" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={() => handleCreateGuest(addingGuest)} disabled={!newGuest.firstName.trim()}>Add to {addingGuest}</Btn>
              <Btn variant="secondary" onClick={() => { setShowNewGuest(false); setNewGuest({ firstName: "", lastName: "", side: "Groom", relationship: "", dietary: "", notes: "" }); }}>Cancel</Btn>
            </div>
          </Card>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <Btn onClick={() => setShowNewGuest(true)}>+ New Guest</Btn>
            <span style={{ fontSize: 12, color: T.mist, marginLeft: 10 }}>Create a new guest and add directly to this group</span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Current members */}
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.slate, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
              In Group ({inGroup.length})
            </div>
            {inGroup.length === 0 && (
              <div style={{ color: T.mist, fontSize: 13, padding: "12px 0" }}>
                No members yet — create a new guest above or add existing guests from the right.
              </div>
            )}
            {inGroup.map(g => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.linen}` }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.carbon }}>{g.firstName} {g.lastName}</div>
                  <div style={{ fontSize: 11, color: T.mist, marginTop: 2 }}>
                    {g.relationship} · {g.side} · {rsvpBadge(g.rsvp)}
                  </div>
                  {g.dietary && <div style={{ fontSize: 11, color: T.olive, marginTop: 2 }}>🥗 {g.dietary}</div>}
                </div>
                <button onClick={() => handleRemoveFromGroup(g.id)} style={{
                  background: T.dangerLight, border: "none", borderRadius: 6, padding: "4px 10px",
                  fontSize: 12, color: T.danger, cursor: "pointer", fontWeight: 700, flexShrink: 0
                }}>Remove</button>
              </div>
            ))}
          </Card>

          {/* Add existing guests */}
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.slate, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
              Add Existing Guest
            </div>
            <Input value={guestSearch} onChange={setGuestSearch} placeholder="Search by name or current group…" style={{ marginBottom: 10 }} />
            <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {outsideGuests.length === 0 && (
                <div style={{ color: T.mist, fontSize: 13, padding: "12px 0" }}>
                  {guestSearch ? "No guests match your search" : "All guests are already in this group"}
                </div>
              )}
              {outsideGuests.map(g => (
                <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: T.linen }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: T.carbon }}>{g.firstName} {g.lastName}</div>
                    <div style={{ fontSize: 11, color: T.mist }}>{g.group} · {g.side}</div>
                  </div>
                  <button onClick={() => handleAddToGroup(g.id, addingGuest)} style={{
                    background: T.successLight, border: "none", borderRadius: 6, padding: "4px 10px",
                    fontSize: 12, color: T.success, cursor: "pointer", fontWeight: 700, flexShrink: 0
                  }}>+ Add</button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ── GROUP CARDS VIEW ──
  return (
    <div>
      <SectionHeader
        title="Group Planner"
        subtitle={`${groupData.length} groups · ${guests.filter(g => g.group !== "Unassigned").length} assigned guests`}
        action={<Btn small onClick={() => setShowNewGroup(true)}>+ New Group</Btn>}
      />

      {showNewGroup && (
        <Card style={{ marginBottom: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.carbon, marginBottom: 10 }}>Create New Group</div>
          <div style={{ display: "flex", gap: 10 }}>
            <Input value={newGroupName} onChange={setNewGroupName} placeholder="e.g. School Friends, Work Colleagues…" />
            <Btn onClick={handleCreateGroup} disabled={!newGroupName.trim()}>Create & Add Members</Btn>
            <Btn variant="secondary" onClick={() => { setShowNewGroup(false); setNewGroupName(""); }}>Cancel</Btn>
          </div>
        </Card>
      )}

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Card style={{ maxWidth: 360, width: "100%" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: T.carbon, marginBottom: 8 }}>Delete "{confirmDelete}"?</div>
            <div style={{ fontSize: 13, color: T.slate, marginBottom: 20 }}>
              All {guests.filter(g => g.group === confirmDelete).length} members will be moved to "Unassigned". This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={() => handleDeleteGroup(confirmDelete)}>Delete Group</Btn>
              <Btn variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Btn>
            </div>
          </Card>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {groupData.map(group => {
          const confirmed = group.guests.filter(g => g.rsvp === "Confirmed").length;
          const invited = group.guests.filter(g => g.rsvp !== "Not Invited").length;
          const projected = Math.round(group.guests.reduce((s, g) => s + (RSVP_PROBS[g.travelLikelihood] || 0.5), 0));
          const isEditing = editingGroup === group.name;

          return (
            <Card key={group.name}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleRename(group.name); if (e.key === "Escape") setEditingGroup(null); }}
                        style={{ border: `1.5px solid ${T.rosso}`, borderRadius: 6, padding: "4px 8px", fontSize: 14, fontWeight: 800, color: T.carbon, width: "100%", outline: "none" }}
                      />
                      <button onClick={() => handleRename(group.name)} style={{ background: T.rosso, border: "none", borderRadius: 6, padding: "4px 8px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                      <button onClick={() => setEditingGroup(null)} style={{ background: T.linen, border: "none", borderRadius: 6, padding: "4px 8px", color: T.slate, cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ fontWeight: 800, fontSize: 15, color: T.carbon }}>{group.name}</div>
                  )}
                  <div style={{ fontSize: 12, color: T.mist, marginTop: 2 }}>{group.guests.length} members</div>
                </div>
                {sideBadge(group.guests)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "Invited", value: invited, color: T.info },
                  { label: "Confirmed", value: confirmed, color: T.success },
                  { label: "Projected", value: projected, color: T.gold },
                ].map(s => (
                  <div key={s.label} style={{ background: T.linen, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: T.slate, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <ProgressBar value={confirmed} max={invited || 1} color={T.rosso} />
              <div style={{ fontSize: 11, color: T.mist, marginTop: 6, display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span>{confirmed} confirmed of {invited}</span>
                <span>{invited > 0 ? Math.round((confirmed / invited) * 100) : 0}% response</span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14, minHeight: 24 }}>
                {group.guests.slice(0, 8).map(g => (
                  <span key={g.id} style={{
                    background: g.rsvp === "Confirmed" ? T.successLight : g.rsvp === "Declined" ? T.dangerLight : T.linen,
                    color: g.rsvp === "Confirmed" ? T.success : g.rsvp === "Declined" ? T.danger : T.slate,
                    borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 600
                  }}>{g.firstName}</span>
                ))}
                {group.guests.length > 8 && <span style={{ fontSize: 11, color: T.mist }}>+{group.guests.length - 8} more</span>}
                {group.guests.length === 0 && <span style={{ fontSize: 11, color: T.mist, fontStyle: "italic" }}>No members yet</span>}
              </div>

              <div style={{ display: "flex", gap: 6, borderTop: `1px solid ${T.linen}`, paddingTop: 12 }}>
                <button onClick={() => { setAddingGuest(group.name); setGuestSearch(""); setShowNewGuest(false); }} style={{
                  flex: 1, background: T.rossoLight, border: `1px solid ${T.rosso}`, borderRadius: 7,
                  padding: "7px 0", fontSize: 12, fontWeight: 700, color: T.rosso, cursor: "pointer"
                }}>Manage Members</button>
                <button onClick={() => { setEditingGroup(group.name); setEditName(group.name); }} style={{
                  background: T.linen, border: `1px solid ${T.linenDark}`, borderRadius: 7,
                  padding: "7px 10px", fontSize: 12, fontWeight: 700, color: T.slate, cursor: "pointer"
                }}>Rename</button>
                <button onClick={() => setConfirmDelete(group.name)} style={{
                  background: T.dangerLight, border: `1px solid ${T.danger}`, borderRadius: 7,
                  padding: "7px 10px", fontSize: 12, fontWeight: 700, color: T.danger, cursor: "pointer"
                }}>✕</button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// ============================================================
// MODULE: RSVP FORECAST — Sprint C
// ============================================================

// Inline SVG bar chart
const BarChart = ({ bars, height = 160, showValues = true }) => {
  const max = Math.max(...bars.map(b => b.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height, padding: "0 4px" }}>
      {bars.map((b, i) => {
        const pct = b.value / max;
        const barH = Math.max(pct * (height - 32), b.value > 0 ? 4 : 0);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {showValues && <span style={{ fontSize: 11, fontWeight: 800, color: b.color || T.carbon }}>{b.value}</span>}
            <div style={{ width: "100%", background: T.linen, borderRadius: "4px 4px 0 0", height: height - 32, display: "flex", alignItems: "flex-end" }}>
              <div style={{ width: "100%", height: barH, background: b.color || T.rosso, borderRadius: "4px 4px 0 0", transition: "height 0.4s ease" }} />
            </div>
            <span style={{ fontSize: 10, color: T.slate, textAlign: "center", fontWeight: 600, lineHeight: 1.2 }}>{b.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// Inline SVG funnel
const FunnelChart = ({ steps }) => {
  const max = steps[0]?.value || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map((s, i) => {
        const pct = s.value / max;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.carbon }}>{s.label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value} <span style={{ fontSize: 11, fontWeight: 400, color: T.mist }}>({Math.round(pct * 100)}%)</span></span>
            </div>
            <div style={{ background: T.linen, borderRadius: 99, height: 10, overflow: "hidden" }}>
              <div style={{ width: `${pct * 100}%`, background: s.color, height: "100%", borderRadius: 99, transition: "width 0.5s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RsvpForecast = ({ guests }) => {
  const [probs, setProbs] = useState({ Certain: 95, Likely: 75, Maybe: 45, Unlikely: 15 });
  const [activeTab, setActiveTab] = useState("overview"); // overview | events | groups | dietary

  const active = guests.filter(g => g.rsvp !== "Not Invited");
  const confirmed = active.filter(g => g.rsvp === "Confirmed").length;
  const declined = active.filter(g => g.rsvp === "Declined").length;
  const pending = active.filter(g => g.rsvp === "Invited" || g.rsvp === "Maybe").length;
  const total = active.length;

  // Custom probability calculator
  const calcCustomForecast = (guestList) => {
    return Math.round(guestList.reduce((sum, g) => {
      if (g.rsvp === "Confirmed") return sum + 1;
      if (g.rsvp === "Declined") return sum;
      return sum + ((probs[g.travelLikelihood] || 50) / 100);
    }, 0));
  };

  const projected = calcCustomForecast(active);
  const conservative = Math.round(confirmed + active.filter(g => g.rsvp !== "Confirmed" && g.rsvp !== "Declined" && g.travelLikelihood === "Certain").length * 0.85);
  const optimistic = Math.min(Math.round(projected * 1.12), total);

  const byLikelihood = Object.entries(probs).map(([label, prob]) => {
    const gs = active.filter(g => g.travelLikelihood === label);
    return { label, count: gs.length, prob, expected: Math.round(gs.length * prob / 100), color: { Certain: T.success, Likely: T.olive, Maybe: T.warning, Unlikely: T.danger }[label] };
  });

  const bySide = ["Groom", "Bride"].map(side => {
    const sg = active.filter(g => g.side === side);
    return {
      side,
      invited: sg.length,
      confirmed: sg.filter(g => g.rsvp === "Confirmed").length,
      declined: sg.filter(g => g.rsvp === "Declined").length,
      projected: calcCustomForecast(sg),
    };
  });

  const byGroup = useMemo(() => {
    const map = {};
    active.forEach(g => {
      if (!map[g.group]) map[g.group] = [];
      map[g.group].push(g);
    });
    return Object.entries(map).map(([name, gs]) => ({
      name,
      invited: gs.length,
      confirmed: gs.filter(g => g.rsvp === "Confirmed").length,
      declined: gs.filter(g => g.rsvp === "Declined").length,
      projected: calcCustomForecast(gs),
      pending: gs.filter(g => g.rsvp === "Invited" || g.rsvp === "Maybe").length,
    })).sort((a, b) => b.projected - a.projected);
  }, [guests, probs]);

  // By event RSVP
  const byEvent = [
    { name: "Thai Ceremony", rsvpField: "ceremonyRsvp" },
    { name: "Lunch Reception", rsvpField: "lunchRsvp" },
  ].map(ev => {
    const gs = guests.filter(g => g[ev.rsvpField] !== "Not Invited");
    return {
      name: ev.name,
      confirmed: gs.filter(g => g[ev.rsvpField] === "Confirmed").length,
      declined: gs.filter(g => g[ev.rsvpField] === "Declined").length,
      invited: gs.filter(g => g[ev.rsvpField] === "Invited" || g[ev.rsvpField] === "Maybe").length,
      total: gs.length,
    };
  });

  // Dietary breakdown
  const dietary = useMemo(() => {
    const map = {};
    active.filter(g => g.dietary).forEach(g => {
      map[g.dietary] = (map[g.dietary] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [guests]);

  const tabs = ["overview", "events", "groups", "dietary"];

  return (
    <div>
      <SectionHeader title="RSVP Forecast Engine" subtitle="Live attendance projections · Bangkok Wedding" />

      {/* Key metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Invited" value={total} />
        <StatCard label="Confirmed" value={confirmed} accent />
        <StatCard label="Declined" value={declined} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Conservative" value={conservative} sub="floor" />
        <StatCard label="Expected" value={projected} sub="projected" accent />
        <StatCard label="Optimistic" value={optimistic} sub="ceiling" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, background: T.linen, borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            background: activeTab === t ? T.white : "transparent",
            border: "none", borderRadius: 7, padding: "7px 16px",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            color: activeTab === t ? T.carbon : T.slate,
            boxShadow: activeTab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            textTransform: "capitalize"
          }}>{t}</button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* RSVP Funnel */}
            <Card>
              <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>RSVP Funnel</div>
              <FunnelChart steps={[
                { label: "Total Allocation", value: 300, color: T.asphalt },
                { label: "Invited", value: total, color: T.info },
                { label: "Confirmed", value: confirmed, color: T.success },
                { label: "Projected", value: projected, color: T.rosso },
              ]} />
            </Card>

            {/* Status bar chart */}
            <Card>
              <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>Response Status</div>
              <BarChart bars={[
                { label: "Confirmed", value: confirmed, color: T.success },
                { label: "Declined", value: declined, color: T.danger },
                { label: "Pending", value: pending, color: T.warning },
                { label: "Projected", value: projected, color: T.rosso },
              ]} height={160} />
            </Card>
          </div>

          {/* By side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {bySide.map(s => (
              <Card key={s.side}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: T.carbon }}>{s.side} Side</span>
                  <Badge label={`${s.projected} projected`} color={s.side === "Groom" ? "rosso" : "gold"} />
                </div>
                <BarChart bars={[
                  { label: "Invited", value: s.invited, color: T.info },
                  { label: "Confirmed", value: s.confirmed, color: T.success },
                  { label: "Declined", value: s.declined, color: T.danger },
                  { label: "Projected", value: s.projected, color: s.side === "Groom" ? T.rosso : T.gold },
                ]} height={120} />
                <div style={{ marginTop: 12 }}>
                  <ProgressBar value={s.confirmed} max={s.invited || 1} color={s.side === "Groom" ? T.rosso : T.gold} />
                  <div style={{ fontSize: 11, color: T.mist, marginTop: 4 }}>
                    {s.confirmed} confirmed · {s.invited > 0 ? Math.round((s.confirmed / s.invited) * 100) : 0}% response rate
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Travel likelihood */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>Travel Likelihood Breakdown</div>
            <BarChart bars={byLikelihood.map(b => ({ label: `${b.label}\n${b.prob}%`, value: b.count, color: b.color }))} height={140} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 16 }}>
              {byLikelihood.map(b => (
                <div key={b.label} style={{ background: T.linen, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: b.color }}>{b.count}</div>
                  <div style={{ fontSize: 10, color: T.slate, textTransform: "uppercase", letterSpacing: "0.04em" }}>{b.label}</div>
                  <div style={{ fontSize: 11, color: T.mist, marginTop: 2 }}>~{b.expected} attend</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Editable probabilities */}
          <Card>
            <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Attendance Probabilities</div>
            <div style={{ fontSize: 12, color: T.mist, marginBottom: 14 }}>Adjust these to update all projections live.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {Object.entries(probs).map(([label, val]) => (
                <div key={label} style={{ background: T.linen, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.carbon, marginBottom: 8 }}>{label}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="range" min={0} max={100} value={val}
                      onChange={e => setProbs(p => ({ ...p, [label]: Number(e.target.value) }))}
                      style={{ flex: 1, accentColor: T.rosso }}
                    />
                    <span style={{ fontSize: 16, fontWeight: 900, color: T.rosso, width: 36, textAlign: "right" }}>{val}%</span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <ProgressBar value={val} max={100} color={{ Certain: T.success, Likely: T.olive, Maybe: T.warning, Unlikely: T.danger }[label]} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: "12px 14px", background: T.rossoLight, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: T.carbon }}>Updated projected attendance</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: T.rosso }}>{projected}</span>
            </div>
          </Card>
        </div>
      )}

      {/* ── EVENTS TAB ── */}
      {activeTab === "events" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
            {byEvent.map(ev => (
              <Card key={ev.name}>
                <div style={{ fontWeight: 800, fontSize: 15, color: T.carbon, marginBottom: 14 }}>{ev.name}</div>
                <FunnelChart steps={[
                  { label: "Invited", value: ev.total, color: T.info },
                  { label: "Confirmed", value: ev.confirmed, color: T.success },
                  { label: "Pending", value: ev.invited, color: T.warning },
                  { label: "Declined", value: ev.declined, color: T.danger },
                ]} />
                <div style={{ marginTop: 14 }}>
                  <ProgressBar value={ev.confirmed} max={ev.total || 1} color={T.rosso} />
                  <div style={{ fontSize: 11, color: T.mist, marginTop: 4 }}>
                    {ev.total > 0 ? Math.round((ev.confirmed / ev.total) * 100) : 0}% confirmed
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card>
            <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>Event Comparison</div>
            <BarChart
              bars={byEvent.flatMap(ev => [
                { label: `${ev.name.split(" ")[0]}\nConfirmed`, value: ev.confirmed, color: T.success },
                { label: `${ev.name.split(" ")[0]}\nPending`, value: ev.invited, color: T.warning },
              ])}
              height={160}
            />
          </Card>
        </div>
      )}

      {/* ── GROUPS TAB ── */}
      {activeTab === "groups" && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>Projected Attendance by Group</div>
            <BarChart
              bars={byGroup.slice(0, 10).map(g => ({ label: g.name.length > 10 ? g.name.slice(0, 9) + "…" : g.name, value: g.projected, color: T.rosso }))}
              height={180}
            />
          </Card>
          <Card style={{ padding: 0 }}>
            <Table
              cols={[
                { key: "name", label: "Group", render: r => <span style={{ fontWeight: 700 }}>{r.name}</span> },
                { key: "invited", label: "Invited" },
                { key: "confirmed", label: "Confirmed", render: r => <span style={{ fontWeight: 700, color: T.success }}>{r.confirmed}</span> },
                { key: "declined", label: "Declined", render: r => <span style={{ color: T.danger }}>{r.declined}</span> },
                { key: "pending", label: "Pending", render: r => <span style={{ color: T.warning }}>{r.pending}</span> },
                { key: "projected", label: "Projected", render: r => <span style={{ fontWeight: 800, color: T.rosso }}>{r.projected}</span> },
                { key: "rate", label: "Rate", render: r => (
                  <div style={{ minWidth: 80 }}>
                    <ProgressBar value={r.confirmed} max={r.invited || 1} color={T.rosso} />
                    <div style={{ fontSize: 10, color: T.mist, marginTop: 2 }}>{r.invited > 0 ? Math.round((r.confirmed / r.invited) * 100) : 0}%</div>
                  </div>
                )},
              ]}
              rows={byGroup}
            />
          </Card>
        </div>
      )}

      {/* ── DIETARY TAB ── */}
      {activeTab === "dietary" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <Card>
              <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>Dietary Requirements</div>
              <BarChart
                bars={dietary.map(([label, val]) => ({ label, value: val, color: T.olive }))}
                height={160}
              />
            </Card>
            <Card>
              <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>Breakdown</div>
              {dietary.length === 0 ? (
                <div style={{ color: T.mist, fontSize: 13 }}>No dietary requirements recorded</div>
              ) : dietary.map(([label, count]) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: T.carbon }}>{label}</span>
                    <span style={{ fontSize: 13, color: T.slate }}>{count} guests</span>
                  </div>
                  <ProgressBar value={count} max={active.length} color={T.olive} />
                </div>
              ))}
              <div style={{ marginTop: 16, padding: "10px 12px", background: T.linen, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: T.slate }}>
                  <strong>{dietary.reduce((s, [, v]) => s + v, 0)}</strong> guests with dietary requirements out of <strong>{active.length}</strong> invited
                </div>
              </div>
            </Card>
          </div>
          {/* Guest list by dietary requirement */}
          {dietary.map(([req]) => (
            <Card key={req} style={{ marginBottom: 12, padding: "12px 16px" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: T.carbon, marginBottom: 10 }}>
                <Badge label={req} color="olive" /> — {active.filter(g => g.dietary === req).length} guests
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {active.filter(g => g.dietary === req).map(g => (
                  <span key={g.id} style={{ background: T.oliveLight, color: T.olive, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                    {g.firstName} {g.lastName}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// MODULE: EVENTS
// ============================================================
const Events = () => {
  const events = [
    { id: "e001", name: "Thai Ceremony", type: "Ceremony", date: "2026-09-18", start: "10:00", end: "12:00", venue: "Mandarin Oriental Ballroom", capacity: 300, cost: 15000, notes: "Traditional Thai ceremony" },
    { id: "e002", name: "Lunch Reception", type: "Reception", date: "2026-09-18", start: "13:30", end: "16:00", venue: "Mandarin Oriental Ballroom", capacity: 300, cost: 35000, notes: "Seated luncheon reception" },
    { id: "e003", name: "Welcome Dinner", type: "Social", date: "2026-09-17", start: "18:00", end: "22:00", venue: "TBC Rooftop", capacity: 80, cost: 8000, notes: "International guests welcome dinner" },
  ];
  const typeColor = { Ceremony: "rosso", Reception: "gold", Social: "olive", Sport: "info" };
  return (
    <div>
      <SectionHeader title="Events" subtitle="All events within the Bangkok Wedding project" action={<Btn small>+ Add Event</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {events.map(ev => (
          <Card key={ev.id}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <Badge label={ev.type} color={typeColor[ev.type] || "mist"} />
              <span style={{ fontSize: 12, color: T.mist }}>{fmtDate(ev.date)}</span>
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: T.carbon }}>{ev.name}</h3>
            <div style={{ fontSize: 13, color: T.slate, marginBottom: 12 }}>{ev.venue}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "Start", value: ev.start },
                { label: "End", value: ev.end },
                { label: "Capacity", value: ev.capacity },
              ].map(d => (
                <div key={d.label} style={{ background: T.linen, borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: T.mist, textTransform: "uppercase", letterSpacing: "0.06em" }}>{d.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.carbon }}>{d.value}</div>
                </div>
              ))}
            </div>
            {ev.notes && <p style={{ fontSize: 12, color: T.slate, margin: "12px 0 0", lineHeight: 1.5 }}>{ev.notes}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// MODULE: ACTIVITIES
// ============================================================
const Activities = ({ activities }) => {
  const catColor = { Sport: "rosso", Culture: "olive", Dining: "gold", Transport: "info" };
  return (
    <div>
      <SectionHeader title="Activities" subtitle="Optional activities for guests" action={<Btn small>+ Add Activity</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {activities.map(a => (
          <Card key={a.id}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <Badge label={a.category} color={catColor[a.category] || "mist"} />
              {a.rsvpRequired && <Badge label="RSVP Required" color="warning" />}
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: T.carbon }}>{a.name}</h3>
            <div style={{ fontSize: 12, color: T.mist, marginBottom: 10 }}>{fmtDate(a.date)}</div>
            <p style={{ fontSize: 13, color: T.slate, margin: "0 0 12px", lineHeight: 1.5 }}>{a.description}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ background: T.linen, borderRadius: 8, padding: "6px 12px" }}>
                <div style={{ fontSize: 10, color: T.mist, textTransform: "uppercase" }}>Capacity</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.carbon }}>{a.capacity}</div>
              </div>
              <div style={{ background: T.linen, borderRadius: 8, padding: "6px 12px" }}>
                <div style={{ fontSize: 10, color: T.mist, textTransform: "uppercase" }}>Cost</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.carbon }}>{fmtCurrency(a.cost)}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: T.slate }}><strong>Groups:</strong> {a.assignedGroups.join(", ")}</div>
            {a.notes && <div style={{ fontSize: 12, color: T.mist, marginTop: 6 }}>{a.notes}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// ============================================================
// MODULE: TASKS — Sprint D
// ============================================================
const STATUSES = ["Not Started", "In Progress", "Waiting", "Blocked", "Done"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const OWNERS = ["Groom", "Bride", "Both", "Best Man", "Planner", "Family"];
const CATEGORIES = ["Venue", "Catering", "Vendors", "Guests", "Accommodation", "Travel", "Communications", "Activities", "Events", "Attire", "Finance", "Other"];

const emptyTask = () => ({ id: "", ref: "", task: "", description: "", category: "Other", owner: "Both", dueDate: "", priority: "Medium", status: "Not Started", notes: "", budgetRef: "" });

// ── Shared file attachment helper ──
const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = e => resolve({ data: e.target.result, name: file.name, type: file.type, size: file.size });
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const FileAttachments = ({ attachments = [], onChange }) => {
  const addFiles = async (e) => {
    const files = Array.from(e.target.files);
    const loaded = await Promise.all(files.map(readFile));
    onChange([...attachments, ...loaded]);
  };
  const remove = (i) => onChange(attachments.filter((_, j) => j !== i));
  const isImage = (f) => f.type?.startsWith("image/");

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        Attachments {attachments.length > 0 && `(${attachments.length})`}
      </div>
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {attachments.map((f, i) => (
            <div key={i} style={{ position: "relative", border: `1px solid ${T.linenDark}`, borderRadius: 8, overflow: "hidden", background: T.linen }}>
              {isImage(f) ? (
                <img src={f.data} alt={f.name} style={{ width: 80, height: 80, objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: 80, height: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 4 }}>
                  <div style={{ fontSize: 24 }}>📄</div>
                  <div style={{ fontSize: 9, color: T.slate, textAlign: "center", lineHeight: 1.2, marginTop: 4 }}>{f.name.slice(0, 12)}</div>
                </div>
              )}
              <button onClick={() => remove(i)} style={{
                position: "absolute", top: 2, right: 2, width: 18, height: 18,
                background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
                color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <label style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: T.linen, border: `1.5px dashed ${T.linenDark}`, borderRadius: 8,
        padding: "7px 14px", cursor: "pointer", fontSize: 13, color: T.slate, fontWeight: 600
      }}>
        📎 Add Photo or File
        <input type="file" accept="image/*,application/pdf,.doc,.docx,.txt" multiple
          onChange={addFiles} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
      </label>
    </div>
  );
};

// ── Task Modal — defined outside Tasks so it never remounts ──
const TaskModal = ({ initial, onSave, onCancel, onDelete }) => {
  const [form, setForm] = useState(initial || emptyTask());
  const [photo, setPhoto] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const scanPhoto = async () => {
    if (!photo) return;
    setScanning(true);
    setScanResult(null);
    try {
      const base64 = photo.split(",")[1];
      const mediaType = photo.split(";")[0].split(":")[1];
      const text = await callGemini({
        imageBase64: base64,
        imageType: mediaType,
        textPrompt: `You are helping plan a wedding in Bangkok. Look at this image and extract any useful planning details.

Return a JSON object (no markdown, raw JSON only) with these fields:
{
  "taskName": "suggested task name if visible",
  "vendor": "vendor or business name if visible",
  "cost": "any price or cost mentioned (number only, no currency symbol)",
  "notes": "key details, description, or relevant info from the image",
  "category": "one of: Venue, Catering, Vendors, Attire, Travel, Accommodation, Activities, Finance, Other"
}

If a field is not visible or applicable, use an empty string. Be concise.`
      });
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setScanResult(parsed);
      if (parsed.taskName && !form.task) set("task", parsed.taskName);
      if (parsed.notes) set("notes", (form.notes ? form.notes + "\n" : "") + parsed.notes);
      if (parsed.category) set("category", parsed.category);
    } catch (err) {
      setScanResult({ error: "Could not read image. Try a clearer photo." });
    }
    setScanning(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: T.white, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 600, maxHeight: "92vh", overflowY: "auto", padding: 24, boxSizing: "border-box" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.carbon }}>{form.id ? "Edit Task" : "New Task"}</h3>
          <button onClick={onCancel} style={{ background: T.linen, border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>

        {/* Ref + Task name */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
          <div style={{ width: 80, flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Ref</div>
            <div style={{ background: T.linen, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 800, color: T.rosso, textAlign: "center" }}>{form.ref || "—"}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Task Name *</div>
            <Input value={form.task} onChange={v => set("task", v)} placeholder="What needs to be done?" />
          </div>
        </div>

        {/* Grid fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[
            { label: "Priority", key: "priority", options: PRIORITIES },
            { label: "Status", key: "status", options: STATUSES },
            { label: "Owner", key: "owner", options: OWNERS },
            { label: "Category", key: "category", options: CATEGORIES },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{f.label}</div>
              <Select value={form[f.key]} onChange={v => set(f.key, v)} options={f.options} />
            </div>
          ))}
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Due Date</div>
            <input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)}
              style={{ border: `1.5px solid ${T.linenDark}`, borderRadius: 8, padding: "8px 12px", fontSize: 14, color: T.carbon, background: T.white, outline: "none", width: "100%", boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Budget link */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Linked Budget Ref</div>
          <Input value={form.budgetRef || ""} onChange={v => set("budgetRef", v)} placeholder="e.g. B-005" />
          {form.budgetRef && <div style={{ fontSize: 11, color: T.mist, marginTop: 3 }}>Linked to budget item {form.budgetRef}</div>}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Notes</div>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
            placeholder="Add notes, details, vendor info, costs…" rows={4}
            style={{ border: `1.5px solid ${T.linenDark}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: T.carbon, background: T.white, outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, minHeight: 90 }} />
        </div>

        {/* File attachments */}
        <FileAttachments
          attachments={form.attachments || []}
          onChange={v => set("attachments", v)}
        />

        {/* Photo scan */}
        <div style={{ marginBottom: 20, background: T.linen, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.carbon, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span>📷</span> Scan Photo with AI
            <span style={{ fontSize: 11, color: T.mist, fontWeight: 400 }}>— extract details & costs</span>
          </div>
          <label style={{ display: "block", background: T.white, border: `1.5px dashed ${T.linenDark}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, color: T.slate, textAlign: "center", marginBottom: 8 }}>
            {photo ? "📎 Photo attached — tap to change" : "Tap to take photo or choose from library"}
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
          </label>
          {photo && <img src={photo} alt="preview" style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />}
          {photo && !scanning && !scanResult && <Btn onClick={scanPhoto}>Scan with AI</Btn>}
          {scanning && <div style={{ fontSize: 13, color: T.slate }}>Reading image…</div>}
          {scanResult && !scanResult.error && (
            <div style={{ background: T.white, borderRadius: 8, padding: 10, border: `1px solid ${T.linenDark}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.success, marginBottom: 6 }}>✓ AI extracted these details</div>
              {[
                { label: "Task", value: scanResult.taskName },
                { label: "Vendor", value: scanResult.vendor },
                { label: "Cost", value: scanResult.cost ? `$${scanResult.cost}` : "" },
                { label: "Notes", value: scanResult.notes },
              ].filter(r => r.value).map(r => (
                <div key={r.label} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: T.mist, fontWeight: 700, minWidth: 50 }}>{r.label}</span>
                  <span style={{ color: T.carbon }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => {
                  if (scanResult.taskName) set("task", scanResult.taskName);
                  if (scanResult.category) set("category", scanResult.category);
                  if (scanResult.notes) set("notes", [form.notes, scanResult.vendor ? `Vendor: ${scanResult.vendor}` : "", scanResult.cost ? `Cost: $${scanResult.cost}` : "", scanResult.notes].filter(Boolean).join("\n"));
                  if (photo) set("attachments", [...(form.attachments || []), { data: photo, name: "scan.jpg", type: "image/jpeg" }]);
                  setScanResult(null); setPhoto(null);
                }} style={{ background: T.rosso, color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Apply All</button>
                <button onClick={() => setScanResult(null)} style={{ background: T.linen, border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: T.slate }}>Dismiss</button>
              </div>
            </div>
          )}
          {scanResult?.error && <div style={{ fontSize: 13, color: T.danger, marginTop: 6 }}>{scanResult.error}</div>}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: `1px solid ${T.linen}` }}>
          <Btn onClick={() => onSave(form)} disabled={!form.task.trim()}>{form.id ? "Save" : "Add Task"}</Btn>
          <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
          {form.id && <Btn variant="secondary" onClick={() => onDelete(form.id)}>Delete</Btn>}
        </div>
      </div>
    </div>
  );
};

const Tasks = ({ tasks, setTasks }) => {
  const [view, setView] = useState("kanban");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterOwner, setFilterOwner] = useState("All");
  const [filterCat, setFilterCat] = useState("All");
  const [search, setSearch] = useState("");
  const [modalTask, setModalTask] = useState(null); // null = closed, {} = new, {id,...} = edit
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date(2026, 8, 1));
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
  const openNew = () => setModalTask(emptyTask());
  const openEdit = (t) => setModalTask({ ...t });
  const closeModal = () => setModalTask(null);

  const now = new Date();
  const overdue = tasks.filter(t => t.status !== "Done" && t.dueDate && new Date(t.dueDate) < now);
  const dueThisWeek = tasks.filter(t => {
    if (t.status === "Done" || !t.dueDate) return false;
    const d = new Date(t.dueDate);
    const diff = (d - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  const filtered = tasks.filter(t => {
    const mp = filterPriority === "All" || t.priority === filterPriority;
    const mo = filterOwner === "All" || t.owner === filterOwner;
    const mc = filterCat === "All" || t.category === filterCat;
    const ms = !search || t.task.toLowerCase().includes(search.toLowerCase()) || t.notes?.toLowerCase().includes(search.toLowerCase());
    return mp && mo && mc && ms;
  });

  // ── Save task ──
  const saveTask = (form) => {
    if (!form.task.trim()) return;
    if (form.id) {
      setTasks(prev => prev.map(t => t.id === form.id ? form : t));
      showToast("Task updated");
    } else {
      setTasks(prev => [...prev, { ...form, id: "t" + Date.now() }]);
      showToast("Task added");
    }
    closeModal();
  };

  const deleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    showToast("Task deleted");
    closeModal();
  };

  const moveTask = (id, newStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  // ── Drag handlers ──
  const onDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; };
  const onDragOver = (e, status) => { e.preventDefault(); setDragOver(status); };
  const onDrop = (e, status) => {
    e.preventDefault();
    if (dragId) { moveTask(dragId, status); showToast(`Moved to ${status}`); }
    setDragId(null); setDragOver(null);
  };
  const onDragEnd = () => { setDragId(null); setDragOver(null); };

  // ── CALENDAR VIEW ──
  const CalendarView = () => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const tasksByDay = {};
    filtered.forEach(t => {
      if (!t.dueDate) return;
      const d = new Date(t.dueDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!tasksByDay[day]) tasksByDay[day] = [];
        tasksByDay[day].push(t);
      }
    });

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} style={{ background: T.linen, border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 16 }}>‹</button>
          <span style={{ fontWeight: 800, fontSize: 16, color: T.carbon }}>
            {calMonth.toLocaleString("default", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} style={{ background: T.linen, border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 16 }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: T.linenDark, border: `1px solid ${T.linenDark}`, borderRadius: 10, overflow: "hidden" }}>
          {dayNames.map(d => (
            <div key={d} style={{ background: T.linen, padding: "8px 4px", textAlign: "center", fontSize: 11, fontWeight: 700, color: T.slate, textTransform: "uppercase", letterSpacing: "0.06em" }}>{d}</div>
          ))}
          {cells.map((day, i) => {
            const dayTasks = day ? (tasksByDay[day] || []) : [];
            const isToday = day && new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
            const hasOverdue = dayTasks.some(t => t.status !== "Done" && new Date(t.dueDate) < now);
            return (
              <div key={i} style={{ background: T.white, minHeight: 70, padding: "6px 4px", position: "relative" }}>
                {day && (
                  <>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: isToday ? T.rosso : "transparent",
                      color: isToday ? "#fff" : hasOverdue ? T.danger : T.carbon,
                      fontWeight: isToday || hasOverdue ? 800 : 400, fontSize: 12, marginBottom: 4
                    }}>{day}</div>
                    {dayTasks.slice(0, 2).map(t => (
                      <div key={t.id} onClick={() => openEdit(t)}
                        style={{
                          fontSize: 10, fontWeight: 600, borderRadius: 3, padding: "2px 4px", marginBottom: 2,
                          background: t.status === "Done" ? T.successLight : t.priority === "Critical" ? T.dangerLight : t.priority === "High" ? T.rossoLight : T.linen,
                          color: t.status === "Done" ? T.success : t.priority === "Critical" ? T.danger : t.priority === "High" ? T.rosso : T.slate,
                          cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis"
                        }}>{t.task}</div>
                    ))}
                    {dayTasks.length > 2 && <div style={{ fontSize: 10, color: T.mist }}>+{dayTasks.length - 2} more</div>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── KANBAN VIEW ──
  const KanbanView = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
      {STATUSES.map(status => {
        const col = filtered.filter(t => t.status === status);
        const isOver = dragOver === status;
        return (
          <div key={status}
            onDragOver={e => onDragOver(e, status)}
            onDrop={e => onDrop(e, status)}
            onDragLeave={() => setDragOver(null)}
            style={{ background: isOver ? T.rossoLight : T.linen, borderRadius: 12, padding: 10, border: `2px solid ${isOver ? T.rosso : "transparent"}`, transition: "all 0.15s", minHeight: 200 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "0 2px" }}>
              {statusBadge(status)}
              <span style={{ fontSize: 12, fontWeight: 800, color: T.mist }}>{col.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {col.map(t => {
                const od = t.dueDate && new Date(t.dueDate) < now && t.status !== "Done";
                return (
                    <div key={t.id}
                    draggable
                    onDragStart={e => onDragStart(e, t.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => openEdit(t)}
                    style={{
                      background: dragId === t.id ? T.rossoLight : T.white,
                      borderRadius: 8, padding: "10px 12px",
                      border: `1px solid ${od ? T.danger : T.linenDark}`,
                      cursor: "grab", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      opacity: dragId === t.id ? 0.5 : 1, transition: "opacity 0.15s"
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: T.carbon, lineHeight: 1.3, flex: 1 }}>{t.task}</div>
                      {t.ref && <span style={{ fontSize: 10, color: T.rosso, fontWeight: 800, marginLeft: 6, flexShrink: 0 }}>{t.ref}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                      {priorityBadge(t.priority)}
                      {t.owner && <span style={{ fontSize: 10, color: T.mist, fontWeight: 600 }}>{t.owner}</span>}
                      {t.budgetRef && <span style={{ background: T.goldLight, color: T.gold, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{t.budgetRef}</span>}
                    </div>
                    {t.dueDate && (
                      <div style={{ fontSize: 11, color: od ? T.danger : T.mist, fontWeight: od ? 700 : 400, marginTop: 6 }}>
                        {od ? "⚠ " : "📅 "}{fmtDate(t.dueDate)}
                      </div>
                    )}
                    {t.notes && <div style={{ fontSize: 11, color: T.mist, marginTop: 4, lineHeight: 1.4 }}>{t.notes}</div>}
                    {t.attachments?.length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                        {t.attachments.slice(0,3).map((a,i) => (
                          a.type?.startsWith("image/") ?
                            <img key={i} src={a.data} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4 }} /> :
                            <div key={i} style={{ width: 32, height: 32, background: T.linen, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📄</div>
                        ))}
                        {t.attachments.length > 3 && <div style={{ fontSize: 10, color: T.mist, alignSelf: "center" }}>+{t.attachments.length-3}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
              {col.length === 0 && (
                <div style={{ fontSize: 12, color: T.mist, textAlign: "center", padding: "20px 0", fontStyle: "italic" }}>Drop here</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── LIST VIEW ──
  const ListView = () => (
    <Card style={{ padding: 0 }}>
      <Table
        cols={[
          { key: "task", label: "Task", render: r => (
            <div>
              <button onClick={() => openEdit(r)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                <div style={{ fontWeight: 700, color: T.carbon, fontSize: 14 }}>{r.task}</div>
              </button>
              <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
                {r.ref && <span style={{ fontSize: 10, color: T.rosso, fontWeight: 800 }}>{r.ref}</span>}
                <span style={{ fontSize: 11, color: T.mist }}>{r.category} · {r.owner}</span>
                {r.budgetRef && <span style={{ background: T.goldLight, color: T.gold, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{r.budgetRef}</span>}
              </div>
              {r.notes && <div style={{ fontSize: 11, color: T.mist, marginTop: 2 }}>{r.notes}</div>}
            </div>
          )},
          { key: "priority", label: "Priority", render: r => priorityBadge(r.priority) },
          { key: "status", label: "Status", render: r => (
            <Select value={r.status} onChange={v => moveTask(r.id, v)} options={STATUSES} style={{ width: 120, fontSize: 12 }} />
          )},
          { key: "owner", label: "Owner", render: r => <span style={{ fontSize: 12, color: T.slate }}>{r.owner}</span> },
          { key: "dueDate", label: "Due", render: r => {
            const od = r.dueDate && new Date(r.dueDate) < now && r.status !== "Done";
            return <span style={{ fontSize: 12, color: od ? T.danger : T.slate, fontWeight: od ? 700 : 400 }}>{r.dueDate ? fmtDate(r.dueDate) : "—"}{od ? " ⚠" : ""}</span>;
          }},
        ]}
        rows={filtered}
      />
    </Card>
  );

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 64, right: 16, zIndex: 300, background: T.success, color: "#fff", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>{toast}</div>}

      <SectionHeader
        title="Task Management"
        subtitle={`${tasks.filter(t => t.status !== "Done").length} open · ${overdue.length} overdue · ${dueThisWeek.length} due this week`}
        action={<Btn small onClick={() => openNew()}>+ Add Task</Btn>}
      />

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div style={{ background: T.dangerLight, border: `1.5px solid ${T.danger}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.danger, marginBottom: 6 }}>{overdue.length} overdue task{overdue.length > 1 ? "s" : ""}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {overdue.map(t => (
                <button key={t.id} onClick={() => openEdit(t)}
                  style={{ background: T.white, border: `1px solid ${T.danger}`, borderRadius: 6, padding: "3px 10px", fontSize: 12, color: T.danger, cursor: "pointer", fontWeight: 600 }}>
                  {t.task} · {fmtDate(t.dueDate)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Due this week */}
      {dueThisWeek.length > 0 && (
        <div style={{ background: T.warningLight, border: `1.5px solid ${T.warning}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: T.warning, marginBottom: 6 }}>Due this week</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {dueThisWeek.map(t => (
              <button key={t.id} onClick={() => openEdit(t)}
                style={{ background: T.white, border: `1px solid ${T.warning}`, borderRadius: 6, padding: "3px 10px", fontSize: 12, color: T.warning, cursor: "pointer", fontWeight: 600 }}>
                {t.task} · {fmtDate(t.dueDate)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Task modal */}
      {modalTask !== null && (
        <TaskModal
          initial={modalTask}
          onSave={saveTask}
          onCancel={closeModal}
          onDelete={deleteTask}
        />
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 2, background: T.linen, borderRadius: 8, padding: 3 }}>
          {["kanban", "list", "calendar"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? T.white : "transparent", border: "none", borderRadius: 6,
              padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              color: view === v ? T.carbon : T.slate,
              boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              textTransform: "capitalize"
            }}>{v}</button>
          ))}
        </div>
        <Input value={search} onChange={setSearch} placeholder="Search tasks…" style={{ width: 160 }} />
        <Select value={filterPriority} onChange={setFilterPriority} options={["All", ...PRIORITIES]} style={{ width: 110 }} />
        <Select value={filterOwner} onChange={setFilterOwner} options={["All", ...OWNERS]} style={{ width: 110 }} />
        <Select value={filterCat} onChange={setFilterCat} options={["All", ...CATEGORIES]} style={{ width: 120 }} />
      </div>

      {view === "kanban" && <KanbanView />}
      {view === "list" && <ListView />}
      {view === "calendar" && <CalendarView />}
    </div>
  );
};

// ============================================================
// ============================================================
// MODULE: BUDGET — Sprint E
// ============================================================
const Budget = ({ budget, setBudget }) => {
  const [tab, setTab] = useState("items");
  const [filterCat, setFilterCat] = useState("All");
  const [payFilter, setPayFilter] = useState("all"); // all | unpaid | deposit | paid
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const cats = ["All", ...Array.from(new Set(budget.map(b => b.category))).sort()];
  const filtered = filterCat === "All" ? budget : budget.filter(b => b.category === filterCat);

  const payFilteredItems = filtered.filter(b => {
    if (payFilter === "unpaid") return !b.depositPaid && !b.fullyPaid;
    if (payFilter === "deposit") return b.depositPaid && !b.fullyPaid;
    if (payFilter === "paid") return b.fullyPaid;
    return true;
  });

  const totalEst = budget.reduce((s, b) => s + (b.estimated || 0), 0);
  const totalAct = budget.reduce((s, b) => s + (b.actual || 0), 0);
  const totalPaid = budget.filter(b => b.fullyPaid).reduce((s, b) => s + (b.actual || b.estimated || 0), 0);
  const totalOutstanding = budget.filter(b => !b.fullyPaid).reduce((s, b) => s + ((b.estimated || 0) - (b.actual || 0)), 0);
  const variance = totalEst - totalAct;
  const pctUsed = totalEst > 0 ? Math.round((totalAct / totalEst) * 100) : 0;

  const catSummary = useMemo(() => {
    const map = {};
    budget.forEach(b => {
      if (!map[b.category]) map[b.category] = { cat: b.category, est: 0, act: 0, count: 0, paid: 0 };
      map[b.category].est += b.estimated || 0;
      map[b.category].act += b.actual || 0;
      map[b.category].count += 1;
      if (b.fullyPaid) map[b.category].paid += 1;
    });
    return Object.values(map).sort((a, b) => b.est - a.est);
  }, [budget]);

  // Payment status buckets
  const unpaid = budget.filter(b => !b.depositPaid && !b.fullyPaid);
  const depositOnly = budget.filter(b => b.depositPaid && !b.fullyPaid);
  const fullPaid = budget.filter(b => b.fullyPaid);

  // ── Budget item form ──
  const emptyItem = () => ({ id: "", ref: "", item: "", category: "Venue", vendor: "", estimated: "", actual: "", depositPaid: false, fullyPaid: false, notes: "", taskRef: "" });
  const [form, setForm] = useState(emptyItem());
  const [bPhoto, setBPhoto] = useState(null);
  const [bScanning, setBScanning] = useState(false);
  const [bScanResult, setBScanResult] = useState(null);
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setForm(emptyItem()); setBPhoto(null); setBScanResult(null); setEditItem(null); setShowForm(true); };
  const openEdit = (item) => { setForm({ ...item, estimated: item.estimated?.toString(), actual: item.actual?.toString() }); setBPhoto(null); setBScanResult(null); setEditItem(item.id); setShowForm(true); };

  const scanBudgetPhoto = async () => {
    if (!bPhoto) return;
    setBScanning(true); setBScanResult(null);
    try {
      const base64 = bPhoto.split(",")[1];
      const mediaType = bPhoto.split(";")[0].split(":")[1];
      const text = await callGemini({
        imageBase64: base64,
        imageType: mediaType,
        textPrompt: `You are helping manage a wedding budget in Bangkok. Look at this image (quote, invoice, receipt, menu, price list, or business card) and extract financial details.

Return raw JSON only, no markdown:
{
  "itemName": "what is being purchased or paid for",
  "vendor": "business or vendor name",
  "cost": "total cost as number only, no currency",
  "category": "one of: Venue, Catering, Photography, Flowers, Attire, Entertainment, Accommodation, Travel, Stationery, Events, Other",
  "notes": "payment terms, what is included, any other useful details"
}

If a field is not visible, use empty string.`
      });
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim() || "{}");
      setBScanResult(parsed);
      if (parsed.itemName && !form.item) setF("item", parsed.itemName);
      if (parsed.vendor && !form.vendor) setF("vendor", parsed.vendor);
      if (parsed.cost) setF("estimated", parsed.cost);
      if (parsed.category) setF("category", parsed.category);
      if (parsed.notes) setF("notes", parsed.notes);
    } catch { setBScanResult({ error: "Could not read image. Try a clearer photo." }); }
    setBScanning(false);
  };

  const saveItem = () => {
    if (!form.item.trim()) return;
    const nextRef = form.ref || `B-${String(budget.length + 1).padStart(3, "0")}`;
    const record = { ...form, ref: nextRef, id: form.id || "b" + Date.now(), estimated: parseFloat(form.estimated) || 0, actual: parseFloat(form.actual) || 0 };
    if (editItem) {
      setBudget(prev => prev.map(b => b.id === editItem ? record : b));
      showToast("Item updated");
    } else {
      setBudget(prev => [...prev, record]);
      showToast("Item added");
    }
    setShowForm(false);
  };

  const deleteItem = (id) => {
    setBudget(prev => prev.filter(b => b.id !== id));
    showToast("Item deleted");
    setShowForm(false);
  };

  const togglePayment = (id, field) => {
    setBudget(prev => prev.map(b => {
      if (b.id !== id) return b;
      if (field === "fullyPaid") return { ...b, fullyPaid: !b.fullyPaid, depositPaid: !b.fullyPaid ? true : b.depositPaid };
      return { ...b, [field]: !b[field] };
    }));
  };

  const BudgetItemForm = () => (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
      <div style={{ background: T.white, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 600, maxHeight: "92vh", overflowY: "auto", padding: 24, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.carbon }}>{editItem ? "Edit" : "New"} Budget Item</h3>
            {form.ref && <span style={{ background: T.goldLight, color: T.gold, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>{form.ref}</span>}
          </div>
          <button onClick={() => setShowForm(false)} style={{ background: T.linen, border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 700, cursor: "pointer" }}>✕</button>
        </div>

        {/* Photo scan */}
        <div style={{ marginBottom: 16, background: T.linen, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.carbon, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span>📷</span> Scan Quote / Invoice / Receipt
          </div>
          <label style={{ display: "block", background: T.white, border: `1.5px dashed ${T.linenDark}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, color: T.slate, textAlign: "center", marginBottom: 8 }}>
            {bPhoto ? "📎 Photo attached — tap to change" : "Tap to take photo or choose file"}
            <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => setBPhoto(ev.target.result); r.readAsDataURL(f); } }}
              style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
          </label>
          {bPhoto && <img src={bPhoto} alt="preview" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />}
          {bPhoto && !bScanning && !bScanResult && <Btn small onClick={scanBudgetPhoto}>Scan with AI</Btn>}
          {bScanning && <div style={{ fontSize: 13, color: T.slate }}>Reading image…</div>}
          {bScanResult && !bScanResult.error && (
            <div style={{ background: T.white, borderRadius: 8, padding: 10, border: `1px solid ${T.linenDark}`, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.success, marginBottom: 6 }}>✓ AI extracted these details</div>
              {[
                { label: "Item", value: bScanResult.itemName },
                { label: "Vendor", value: bScanResult.vendor },
                { label: "Cost", value: bScanResult.cost ? `$${bScanResult.cost}` : "" },
                { label: "Category", value: bScanResult.category },
              ].filter(r => r.value).map(r => (
                <div key={r.label} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: T.mist, fontWeight: 700, minWidth: 55 }}>{r.label}</span>
                  <span style={{ color: T.carbon }}>{r.value}</span>
                </div>
              ))}
              <button onClick={() => setBScanResult(null)} style={{ marginTop: 8, background: T.linen, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: T.slate, fontWeight: 600 }}>Dismiss</button>
            </div>
          )}
          {bScanResult?.error && <div style={{ fontSize: 12, color: T.danger, marginTop: 6 }}>{bScanResult.error}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Item Name *</div>
            <Input value={form.item} onChange={v => setF("item", v)} placeholder="e.g. Wedding Photography" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Category</div>
            <Select value={form.category} onChange={v => setF("category", v)} options={["Venue","Catering","Photography","Flowers","Attire","Entertainment","Accommodation","Travel","Stationery","Events","Other"]} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Vendor</div>
            <Input value={form.vendor} onChange={v => setF("vendor", v)} placeholder="Vendor name" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Budget ($)</div>
            <Input value={form.estimated} onChange={v => setF("estimated", v)} placeholder="0" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Actual Paid ($)</div>
            <Input value={form.actual} onChange={v => setF("actual", v)} placeholder="0" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Linked Task Ref</div>
            <Input value={form.taskRef || ""} onChange={v => setF("taskRef", v)} placeholder="e.g. T-006" />
            {form.taskRef && <div style={{ fontSize: 11, color: T.mist, marginTop: 3 }}>Linked to task {form.taskRef}</div>}
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Payment Status</div>
            <div style={{ display: "flex", gap: 16 }}>
              {[{ key: "depositPaid", label: "Deposit Paid" }, { key: "fullyPaid", label: "Fully Paid" }].map(f => (
                <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, color: T.carbon }}>
                  <input type="checkbox" checked={form[f.key]} onChange={e => setF(f.key, e.target.checked)} style={{ width: 16, height: 16, accentColor: T.rosso }} />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Notes</div>
            <textarea value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Payment terms, due dates, contract details…" rows={3}
              style={{ border: `1.5px solid ${T.linenDark}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: T.carbon, background: T.white, outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
          </div>
        </div>

        <FileAttachments
          attachments={form.attachments || []}
          onChange={v => setF("attachments", v)}
        />

        <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: `1px solid ${T.linen}` }}>
          <Btn onClick={saveItem} disabled={!form.item.trim()}>{editItem ? "Save" : "Add Item"}</Btn>
          <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn>
          {editItem && <Btn variant="secondary" onClick={() => deleteItem(editItem)}>Delete</Btn>}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 64, right: 16, zIndex: 300, background: T.success, color: "#fff", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>{toast}</div>}
      {showForm && <BudgetItemForm />}

      <SectionHeader title="Budget Management" subtitle="Bangkok Wedding · All figures in USD"
        action={<Btn small onClick={openAdd}>+ Add Item</Btn>} />

      {/* Key metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 16 }}>
        <StatCard label="Total Budget" value={fmtCurrency(totalEst)} />
        <StatCard label="Spent to Date" value={fmtCurrency(totalAct)} accent />
        <StatCard label="Outstanding" value={fmtCurrency(totalOutstanding)} />
        <StatCard label="Fully Paid" value={fmtCurrency(totalPaid)} />
        <StatCard label="Variance" value={fmtCurrency(variance)} sub={`${pctUsed}% used`} />
      </div>

      {/* Overall progress bar */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: T.carbon }}>Overall Budget Progress</span>
          <span style={{ fontSize: 13, color: T.slate }}>{fmtCurrency(totalAct)} of {fmtCurrency(totalEst)}</span>
        </div>
        <div style={{ background: T.linen, borderRadius: 99, height: 10, overflow: "hidden", marginBottom: 6 }}>
          <div style={{ width: `${Math.min(pctUsed, 100)}%`, background: pctUsed > 90 ? T.danger : pctUsed > 70 ? T.warning : T.rosso, height: "100%", borderRadius: 99 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.mist }}>
          <span>{pctUsed}% spent</span>
          <span>{fmtCurrency(totalEst - totalAct)} remaining</span>
        </div>
      </Card>

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: 2, background: T.linen, borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
        {["items", "overview", "payments"].map(t => (
          <button key={t} onClick={() => { setTab(t); setPayFilter("all"); }} style={{
            background: tab === t ? T.white : "transparent", border: "none", borderRadius: 7,
            padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            color: tab === t ? T.carbon : T.slate, textTransform: "capitalize",
            boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
          }}>{t}</button>
        ))}
      </div>

      {/* ── ITEMS TAB ── */}
      {tab === "items" && (
        <div>
          {/* Payment filter pills */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { key: "unpaid", label: "Unpaid", value: unpaid.length, amount: fmtCurrency(unpaid.reduce((s,b)=>s+(b.estimated||0),0)), color: T.danger, bg: T.dangerLight, activeBg: T.danger },
              { key: "deposit", label: "Deposit", value: depositOnly.length, amount: fmtCurrency(depositOnly.reduce((s,b)=>s+((b.estimated||0)-(b.actual||0)),0)), color: T.warning, bg: T.warningLight, activeBg: T.warning },
              { key: "paid", label: "Paid", value: fullPaid.length, amount: fmtCurrency(fullPaid.reduce((s,b)=>s+(b.actual||b.estimated||0),0)), color: T.success, bg: T.successLight, activeBg: T.success },
            ].map(p => {
              const isActive = payFilter === p.key;
              return (
                <button key={p.key} onClick={() => setPayFilter(isActive ? "all" : p.key)}
                  style={{
                    background: isActive ? p.activeBg : p.bg,
                    border: `2px solid ${isActive ? p.activeBg : "transparent"}`,
                    borderRadius: 12, padding: "12px 8px", textAlign: "center", cursor: "pointer",
                    transition: "all 0.15s"
                  }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: isActive ? "#fff" : p.color, lineHeight: 1 }}>{p.value}</div>
                  <div style={{ fontSize: 10, color: isActive ? "rgba(255,255,255,0.85)" : p.color, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, margin: "3px 0" }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: isActive ? "rgba(255,255,255,0.85)" : p.color, fontWeight: 600 }}>{p.amount}</div>
                </button>
              );
            })}
          </div>

          {/* Category filter + count */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Select value={filterCat} onChange={setFilterCat} options={cats} style={{ width: 160 }} />
            <span style={{ fontSize: 12, color: T.mist }}>{payFilteredItems.length} items · {fmtCurrency(payFilteredItems.reduce((s,b) => s+(b.estimated||0),0))} total</span>
            {payFilter !== "all" && (
              <button onClick={() => setPayFilter("all")} style={{ fontSize: 12, color: T.rosso, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Clear filter ✕</button>
            )}
          </div>

          <Card style={{ padding: 0 }}>
            <Table
              cols={[
                { key: "ref", label: "Ref", render: r => <span style={{ fontWeight: 800, fontSize: 12, color: T.rosso }}>{r.ref}</span> },
                { key: "item", label: "Item", render: r => (
                  <button onClick={() => openEdit(r)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: T.carbon }}>{r.item} {r.attachments?.length > 0 && <span style={{ fontSize: 11 }}>📎</span>}</div>
                    <div style={{ fontSize: 11, color: T.mist }}>{r.vendor}</div>
                  </button>
                )},
                { key: "category", label: "Cat", render: r => <Badge label={r.category} color="olive" /> },
                { key: "estimated", label: "Budget", render: r => <span style={{ fontWeight: 700, fontSize: 13 }}>{fmtCurrency(r.estimated)}</span> },
                { key: "actual", label: "Paid", render: r => <span style={{ color: r.actual > 0 ? T.rosso : T.mist, fontWeight: 700, fontSize: 13 }}>{fmtCurrency(r.actual)}</span> },
                { key: "variance", label: "Left", render: r => {
                  const left = (r.estimated||0) - (r.actual||0);
                  return <span style={{ fontSize: 12, color: left < 0 ? T.danger : T.slate }}>{fmtCurrency(left)}</span>;
                }},
                { key: "taskRef", label: "Task", render: r => r.taskRef ? <span style={{ background: T.infoLight, color: T.info, borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{r.taskRef}</span> : <span style={{ color: T.mist, fontSize: 11 }}>—</span> },
                { key: "payment", label: "Status", render: r => (
                  <div style={{ display: "flex", gap: 4, flexDirection: "column" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, fontWeight: 600, color: r.depositPaid ? T.success : T.mist }}>
                      <input type="checkbox" checked={r.depositPaid} onChange={() => togglePayment(r.id, "depositPaid")} style={{ accentColor: T.success }} />
                      Deposit
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, fontWeight: 600, color: r.fullyPaid ? T.success : T.mist }}>
                      <input type="checkbox" checked={r.fullyPaid} onChange={() => togglePayment(r.id, "fullyPaid")} style={{ accentColor: T.success }} />
                      Paid
                    </label>
                  </div>
                )},
              ]}
              rows={payFilteredItems}
              emptyMsg={`No ${payFilter === "all" ? "" : payFilter + " "}items`}
            />
          </Card>
        </div>
      )}

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>By Category</div>
            {catSummary.map((c, i) => {
              const pct = c.est > 0 ? Math.round((c.act / c.est) * 100) : 0;
              const estPctOfTotal = totalEst > 0 ? Math.round((c.est / totalEst) * 100) : 0;
              return (
                <div key={c.cat} style={{ paddingBottom: 14, marginBottom: 14, borderBottom: i < catSummary.length - 1 ? `1px solid ${T.linen}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: T.carbon }}>{c.cat}</div>
                      <div style={{ fontSize: 11, color: T.mist, marginTop: 1 }}>{c.count} items · {c.paid} paid · {estPctOfTotal}% of budget</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: T.carbon }}>{fmtCurrency(c.est)}</div>
                      <div style={{ fontSize: 11, color: c.act > 0 ? T.rosso : T.mist, fontWeight: 600 }}>
                        {c.act > 0 ? `${fmtCurrency(c.act)} paid` : "Nothing paid"}
                      </div>
                    </div>
                  </div>
                  <div style={{ background: T.linen, borderRadius: 99, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? T.success : pct > 50 ? T.warning : T.rosso, height: "100%", borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.mist, marginTop: 4 }}>
                    {fmtCurrency(c.est - c.act)} remaining · {pct}% paid
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {tab === "payments" && (
        <div>
          {unpaid.length > 0 && (
            <Card style={{ marginBottom: 16, padding: 0 }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.linen}`, display: "flex", alignItems: "center", gap: 10 }}>
                <Badge label="Unpaid" color="danger" />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.carbon }}>No payment made · {fmtCurrency(unpaid.reduce((s,b) => s+(b.estimated||0),0))} total</span>
              </div>
              {unpaid.map(b => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${T.linen}`, background: T.dangerLight }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: T.carbon }}>{b.item}</div>
                    <div style={{ fontSize: 11, color: T.mist }}>{b.vendor} · {b.category}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: T.danger }}>{fmtCurrency(b.estimated)}</span>
                    <button onClick={() => openEdit(b)} style={{ background: T.white, border: `1px solid ${T.linenDark}`, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Pay</button>
                  </div>
                </div>
              ))}
            </Card>
          )}
          {depositOnly.length > 0 && (
            <Card style={{ marginBottom: 16, padding: 0 }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.linen}`, display: "flex", alignItems: "center", gap: 10 }}>
                <Badge label="Deposit Paid" color="warning" />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.carbon }}>Balance outstanding · {fmtCurrency(depositOnly.reduce((s,b) => s+((b.estimated||0)-(b.actual||0)),0))} remaining</span>
              </div>
              {depositOnly.map(b => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${T.linen}`, background: T.warningLight }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: T.carbon }}>{b.item}</div>
                    <div style={{ fontSize: 11, color: T.mist }}>{b.vendor} · Paid {fmtCurrency(b.actual)} of {fmtCurrency(b.estimated)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: T.warning }}>{fmtCurrency((b.estimated||0)-(b.actual||0))}</span>
                    <button onClick={() => openEdit(b)} style={{ background: T.white, border: `1px solid ${T.linenDark}`, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Update</button>
                  </div>
                </div>
              ))}
            </Card>
          )}
          {fullPaid.length > 0 && (
            <Card style={{ padding: 0 }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.linen}`, display: "flex", alignItems: "center", gap: 10 }}>
                <Badge label="Fully Paid" color="success" />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.carbon }}>{fullPaid.length} items · {fmtCurrency(fullPaid.reduce((s,b) => s+(b.actual||b.estimated||0),0))} paid</span>
              </div>
              {fullPaid.map(b => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${T.linen}`, background: T.successLight }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: T.carbon }}>{b.item}</div>
                    <div style={{ fontSize: 11, color: T.mist }}>{b.vendor}</div>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: T.success }}>✓ {fmtCurrency(b.actual || b.estimated)}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// MODULE: VENDORS
// ============================================================
const Vendors = ({ vendors }) => {
  const statusColor = { Paid: "success", Partial: "warning", Unpaid: "danger", Pending: "mist", Signed: "success", "N/A": "mist" };
  return (
    <div>
      <SectionHeader title="Vendor CRM" subtitle={`${vendors.length} vendors`} action={<Btn small>+ Add Vendor</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {vendors.map(v => (
          <Card key={v.id}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <Badge label={v.service} color="olive" />
              <span style={{ fontSize: 13, fontWeight: 800, color: T.carbon }}>{fmtCurrency(v.cost)}</span>
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: T.carbon }}>{v.name}</h3>
            <div style={{ fontSize: 13, color: T.slate, marginBottom: 10 }}>{v.contact}</div>
            <div style={{ display: "flex", gap: 6, fontSize: 12, color: T.mist, marginBottom: 12, flexWrap: "wrap" }}>
              <span>{v.phone}</span>
              <span>·</span>
              <span>{v.email}</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div><span style={{ fontSize: 11, color: T.mist }}>Deposit: </span><Badge label={v.depositStatus} color={statusColor[v.depositStatus]} /></div>
              <div><span style={{ fontSize: 11, color: T.mist }}>Payment: </span><Badge label={v.paymentStatus} color={statusColor[v.paymentStatus]} /></div>
              <div><span style={{ fontSize: 11, color: T.mist }}>Contract: </span><Badge label={v.contractStatus} color={statusColor[v.contractStatus]} /></div>
            </div>
            {v.notes && <p style={{ fontSize: 12, color: T.slate, margin: "10px 0 0", lineHeight: 1.5 }}>{v.notes}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// MODULE: TIMELINE
// ============================================================
const Timeline = ({ timeline }) => {
  const typeColor = { Ceremony: T.rosso, Reception: T.gold, Photography: T.olive, Preparation: T.info, Event: T.asphalt };
  const grouped = useMemo(() => {
    const map = {};
    timeline.forEach(t => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [timeline]);

  return (
    <div>
      <SectionHeader title="Wedding Timeline" subtitle="Planning timeline, wedding week, and wedding day" />
      {grouped.map(([date, items]) => (
        <div key={date} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.carbon, letterSpacing: "0.02em", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: T.rosso, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
              {new Date(date).getDate()}
            </div>
            {fmtDate(date)}
          </div>
          <div style={{ marginLeft: 18, borderLeft: `2px solid ${T.linenDark}`, paddingLeft: 28 }}>
            {items.sort((a, b) => a.time.localeCompare(b.time)).map((item, i) => (
              <div key={item.id} style={{ position: "relative", marginBottom: 20 }}>
                <div style={{ position: "absolute", left: -37, top: 4, width: 12, height: 12, borderRadius: "50%", background: typeColor[item.type] || T.asphalt, border: `2px solid ${T.white}` }} />
                <Card style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: T.carbon }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: T.slate, marginTop: 2 }}>{item.location}</div>
                      {item.notes && <div style={{ fontSize: 12, color: T.mist, marginTop: 4 }}>{item.notes}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: T.carbon }}>{item.time}</span>
                      <Badge label={item.type} color="olive" />
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// MODULE: TRAVEL & HOTEL
// ============================================================
const Travel = ({ hotels }) => (
  <div>
    <SectionHeader title="Travel & Hotel Tracker" subtitle="Destination wedding coordination" action={<Btn small>+ Add Record</Btn>} />
    <Card style={{ padding: 0 }}>
      <Table
        cols={[
          { key: "guest", label: "Guest", render: r => <span style={{ fontWeight: 700 }}>{r.guest}</span> },
          { key: "hotel", label: "Hotel", render: r => <span style={{ fontSize: 12 }}>{r.hotel}</span> },
          { key: "roomType", label: "Room", render: r => <span style={{ fontSize: 12 }}>{r.roomType}</span> },
          { key: "checkIn", label: "Check-in", render: r => <span style={{ fontSize: 12 }}>{fmtDate(r.checkIn)}</span> },
          { key: "checkOut", label: "Check-out", render: r => <span style={{ fontSize: 12 }}>{fmtDate(r.checkOut)}</span> },
          { key: "flight", label: "Flight", render: r => <Badge label={r.flightNumber} color="info" /> },
          { key: "transfer", label: "Transfer", render: r => r.transferRequired ? <Badge label="Required" color="warning" /> : <Badge label="None" color="mist" /> },
        ]}
        rows={hotels}
      />
    </Card>
  </div>
);

// ============================================================
// ============================================================
// MODULE: IMPORT (WithJoy CSV) — Sprint B
// ============================================================

// WithJoy column name variants we try to auto-detect
const WITHJOY_MAP = {
  firstName:        ["First Name", "first_name", "firstname", "First"],
  lastName:         ["Last Name", "last_name", "lastname", "Last"],
  email:            ["Email", "email", "Email Address"],
  rsvp:             ["RSVP", "rsvp", "RSVP Status", "Status", "rsvp_status"],
  dietaryNotes:     ["Dietary Notes", "dietary", "Dietary", "Food", "dietary_notes"],
  plusOne:          ["Plus One", "plus_one", "Plus 1", "PlusOne"],
  group:            ["Group", "group", "List", "Guest List"],
  phone:            ["Phone", "phone", "Mobile", "Phone Number"],
  notes:            ["Notes", "notes", "Note"],
};

const RSVP_REMAP = {
  "attending": "Confirmed", "confirmed": "Confirmed", "yes": "Confirmed", "accepted": "Confirmed",
  "not attending": "Declined", "declined": "Declined", "no": "Declined", "rejected": "Declined",
  "maybe": "Maybe", "awaiting": "Invited", "pending": "Invited", "invited": "Invited", "": "Invited",
};

const Import = ({ guests, setGuests }) => {
  const [step, setStep] = useState("upload");
  const [csvText, setCsvText] = useState("");
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [colMap, setColMap] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [diffResult, setDiffResult] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [importSide, setImportSide] = useState("Groom");

  // ── Parse CSV handling quoted fields properly ──
  const parseCSV = (text) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return { headers: [], rows: [] };
    const parseRow = (line) => {
      const vals = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; continue; }
        if (c === "," && !inQ) { vals.push(cur.trim()); cur = ""; continue; }
        cur += c;
      }
      vals.push(cur.trim());
      return vals;
    };
    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = parseRow(line);
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i] || "");
      return obj;
    });
    return { headers, rows };
  };

  // ── Auto-detect column mapping ──
  const autoDetect = (headers) => {
    const map = {};
    Object.entries(WITHJOY_MAP).forEach(([field, variants]) => {
      const match = headers.find(h => variants.some(v => v.toLowerCase() === h.toLowerCase()));
      if (match) map[field] = match;
    });
    return map;
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setCsvText(text);
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setColMap(autoDetect(headers));
      setStep("mapping");
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // ── Build diff: what's new, what changed, what's a dupe ──
  const buildDiff = () => {
    const added = [], updated = [], dupes = [], errors = [];
    csvRows.forEach((row, i) => {
      const first = (row[colMap.firstName] || "").trim();
      const last = (row[colMap.lastName] || "").trim();
      if (!first) { errors.push({ row: i + 2, reason: "Missing first name" }); return; }
      const fullName = `${first} ${last}`.trim();
      const rawRsvp = (row[colMap.rsvp] || "").toLowerCase().trim();
      const rsvp = RSVP_REMAP[rawRsvp] || "Invited";
      const dietary = row[colMap.dietaryNotes] || "";
      const notes = row[colMap.notes] || "";
      const email = row[colMap.email] || "";

      // Exact name match
      const existing = guests.find(g =>
        `${g.firstName} ${g.lastName}`.toLowerCase() === fullName.toLowerCase()
      );

      if (existing) {
        const changes = [];
        if (existing.rsvp !== rsvp) changes.push({ field: "rsvp", from: existing.rsvp, to: rsvp });
        if (dietary && existing.dietary !== dietary) changes.push({ field: "dietary", from: existing.dietary, to: dietary });
        if (notes && existing.notes !== notes) changes.push({ field: "notes", from: existing.notes, to: notes });

        // Check for another match — real dupe
        const dupeMatch = guests.filter(g =>
          `${g.firstName} ${g.lastName}`.toLowerCase() === fullName.toLowerCase()
        );
        if (dupeMatch.length > 1) {
          dupes.push({ name: fullName, rows: dupeMatch });
        } else if (changes.length > 0) {
          updated.push({ id: existing.id, firstName: first, lastName: last, rsvp, dietary, notes, email, changes });
        }
      } else {
        added.push({ firstName: first, lastName: last, rsvp, dietary, notes, email, side: importSide, group: "Unassigned", category: "Friends", relationship: "Guest", travelLikelihood: "Likely", ceremonyRsvp: rsvp, lunchRsvp: rsvp });
      }
    });
    setDiffResult({ added, updated, dupes, errors });
    setStep("diff");
  };

  // ── Confirm import ──
  const confirmImport = () => {
    const { added, updated } = diffResult;
    const newGuests = added.map(g => ({ ...g, id: "import_" + Date.now() + "_" + Math.random().toString(36).slice(2) }));
    setGuests(prev => {
      const updatedList = prev.map(g => {
        const upd = updated.find(u => u.id === g.id);
        if (!upd) return g;
        return { ...g, rsvp: upd.rsvp, dietary: upd.dietary || g.dietary, notes: upd.notes || g.notes };
      });
      return [...updatedList, ...newGuests];
    });
    const record = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      fileName: "WithJoy Export",
      added: added.length,
      updated: updated.length,
      dupes: diffResult.dupes.length,
      errors: diffResult.errors.length,
      total: csvRows.length,
    };
    setImportHistory(prev => [record, ...prev]);
    setStep("complete");
  };

  const reset = () => {
    setStep("upload"); setCsvText(""); setCsvHeaders([]); setCsvRows([]);
    setColMap({}); setDiffResult(null);
  };

  // ── UPLOAD STEP ──
  if (step === "upload") return (
    <div>
      <SectionHeader title="WithJoy Import" subtitle="Import guest data from WithJoy CSV exports" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{ border: `2px dashed ${dragOver ? T.rosso : T.linenDark}`, borderRadius: 12, padding: "32px 24px", textAlign: "center", background: dragOver ? T.rossoLight : T.linen, transition: "all 0.2s", marginBottom: 16 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⊕</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: T.carbon, marginBottom: 4 }}>Drop your WithJoy CSV here</div>
            <div style={{ fontSize: 12, color: T.mist }}>or use the button below</div>
          </div>

          {/* File picker — label wraps hidden input, label itself is styled as button */}
          <label style={{
            display: "block", textAlign: "center", background: T.rosso, color: "#fff",
            borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700,
            cursor: "pointer", marginBottom: 16, userSelect: "none"
          }}>
            Choose CSV File
            <input
              type="file"
              accept=".csv,.txt"
              onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
            />
          </label>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Default Side for New Guests</div>
            <Select value={importSide} onChange={setImportSide} options={["Groom", "Bride", "Both"]} />
          </div>
          <div style={{ marginTop: 16, padding: "14px 0 0", borderTop: `1px solid ${T.linen}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.carbon, marginBottom: 10 }}>How to export from WithJoy</div>
            {["1. Go to Guest List in WithJoy", "2. Click Export → CSV", "3. Download the file", "4. Drop it here"].map(s => (
              <div key={s} style={{ fontSize: 12, color: T.slate, padding: "5px 0", borderBottom: `1px solid ${T.linen}` }}>{s}</div>
            ))}
          </div>
        </Card>

        {/* Import History */}
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.slate, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Import History</div>
          {importHistory.length === 0 ? (
            <EmptyState icon="⊕" title="No imports yet" sub="Your import history will appear here" />
          ) : importHistory.map(h => (
            <div key={h.id} style={{ padding: "10px 0", borderBottom: `1px solid ${T.linen}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: T.carbon }}>{h.fileName}</span>
                <span style={{ fontSize: 11, color: T.mist }}>{h.date}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge label={`+${h.added} added`} color="success" />
                <Badge label={`~${h.updated} updated`} color="info" />
                {h.dupes > 0 && <Badge label={`${h.dupes} dupes`} color="warning" />}
                {h.errors > 0 && <Badge label={`${h.errors} errors`} color="danger" />}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );

  // ── MAPPING STEP ──
  if (step === "mapping") return (
    <div>
      <SectionHeader title="Column Mapping" subtitle={`${csvRows.length} rows detected · Map your CSV columns to guest fields`} />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.carbon, marginBottom: 4 }}>Detected Columns</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {csvHeaders.map(h => <Badge key={h} label={h} color="mist" />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {Object.entries(WITHJOY_MAP).map(([field, _]) => (
            <div key={field}>
              <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
                {field.replace(/([A-Z])/g, " $1").trim()}
                {["firstName", "lastName"].includes(field) && <span style={{ color: T.rosso }}> *</span>}
              </div>
              <Select
                value={colMap[field] || ""}
                onChange={v => setColMap(p => ({ ...p, [field]: v }))}
                options={[{ value: "", label: "— Not mapped —" }, ...csvHeaders.map(h => ({ value: h, label: h }))]}
              />
              {colMap[field] && (
                <div style={{ fontSize: 11, color: T.mist, marginTop: 3 }}>
                  Sample: <strong>{csvRows[0]?.[colMap[field]] || "—"}</strong>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Preview table */}
      <Card style={{ marginBottom: 16, padding: 0 }}>
        <div style={{ padding: "14px 16px 0", fontSize: 12, fontWeight: 700, color: T.slate, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Data Preview (first 5 rows)
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.linen }}>
                {csvHeaders.map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: Object.values(colMap).includes(h) ? T.rosso : T.asphalt, borderBottom: `2px solid ${T.linenDark}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvRows.slice(0, 5).map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.linen}`, background: i % 2 === 0 ? T.white : T.cream }}>
                  {csvHeaders.map(h => <td key={h} style={{ padding: "7px 12px", color: T.carbon }}>{row[h]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="secondary" onClick={reset}>← Back</Btn>
        <Btn onClick={buildDiff} disabled={!colMap.firstName}>Preview Import</Btn>
      </div>
    </div>
  );

  // ── DIFF STEP ──
  if (step === "diff" && diffResult) {
    const { added, updated, dupes, errors } = diffResult;
    return (
      <div>
        <SectionHeader title="Import Preview" subtitle="Review changes before confirming" />

        {/* Summary bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 20 }}>
          <StatCard label="New Guests" value={added.length} accent />
          <StatCard label="Updated" value={updated.length} />
          <StatCard label="Duplicates" value={dupes.length} />
          <StatCard label="Errors" value={errors.length} />
          <StatCard label="Total Rows" value={csvRows.length} />
        </div>

        {/* New guests */}
        {added.length > 0 && (
          <Card style={{ marginBottom: 16, padding: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.linen}`, display: "flex", alignItems: "center", gap: 10 }}>
              <Badge label={`${added.length} New`} color="success" />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.carbon }}>Guests to be added</span>
            </div>
            {added.map((g, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 16px", borderBottom: `1px solid ${T.linen}`, background: T.successLight }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: T.carbon }}>{g.firstName} {g.lastName}</span>
                  {g.email && <span style={{ fontSize: 11, color: T.mist, marginLeft: 8 }}>{g.email}</span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {rsvpBadge(g.rsvp)}
                  {g.dietary && <Badge label={g.dietary} color="olive" />}
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Updated guests */}
        {updated.length > 0 && (
          <Card style={{ marginBottom: 16, padding: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.linen}`, display: "flex", alignItems: "center", gap: 10 }}>
              <Badge label={`${updated.length} Updated`} color="info" />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.carbon }}>Existing guests with changes</span>
            </div>
            {updated.map((g, i) => (
              <div key={i} style={{ padding: "10px 16px", borderBottom: `1px solid ${T.linen}` }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.carbon, marginBottom: 6 }}>{g.firstName} {g.lastName}</div>
                {g.changes.map((c, j) => (
                  <div key={j} style={{ fontSize: 12, color: T.slate, display: "flex", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: T.carbon }}>{c.field}:</span>
                    <span style={{ color: T.danger, textDecoration: "line-through" }}>{c.from || "—"}</span>
                    <span>→</span>
                    <span style={{ color: T.success, fontWeight: 700 }}>{c.to}</span>
                  </div>
                ))}
              </div>
            ))}
          </Card>
        )}

        {/* Duplicates */}
        {dupes.length > 0 && (
          <Card style={{ marginBottom: 16, padding: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.linen}`, display: "flex", alignItems: "center", gap: 10 }}>
              <Badge label={`${dupes.length} Dupes`} color="warning" />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.carbon }}>Skipped — already exist as duplicates</span>
            </div>
            {dupes.map((d, i) => (
              <div key={i} style={{ padding: "9px 16px", borderBottom: `1px solid ${T.linen}`, background: T.warningLight }}>
                <span style={{ fontSize: 13, color: T.carbon, fontWeight: 700 }}>{d.name}</span>
                <span style={{ fontSize: 11, color: T.mist, marginLeft: 8 }}>{d.rows.length} existing records</span>
              </div>
            ))}
          </Card>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <Card style={{ marginBottom: 16, padding: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.linen}`, display: "flex", alignItems: "center", gap: 10 }}>
              <Badge label={`${errors.length} Errors`} color="danger" />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.carbon }}>Rows that could not be imported</span>
            </div>
            {errors.map((e, i) => (
              <div key={i} style={{ padding: "9px 16px", borderBottom: `1px solid ${T.linen}`, background: T.dangerLight }}>
                <span style={{ fontSize: 12, color: T.danger }}>Row {e.row}: {e.reason}</span>
              </div>
            ))}
          </Card>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="secondary" onClick={() => setStep("mapping")}>← Back</Btn>
          <Btn onClick={confirmImport} disabled={added.length === 0 && updated.length === 0}>
            Confirm Import ({added.length + updated.length} changes)
          </Btn>
        </div>
      </div>
    );
  }

  // ── COMPLETE STEP ──
  if (step === "complete" && importHistory[0]) {
    const h = importHistory[0];
    return (
      <div>
        <SectionHeader title="Import Complete" />
        <Card style={{ marginBottom: 20, background: T.successLight, border: `1.5px solid ${T.success}` }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.carbon, marginBottom: 16 }}>WithJoy import successful</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12 }}>
            {[
              { label: "Added", value: h.added, color: T.success },
              { label: "Updated", value: h.updated, color: T.info },
              { label: "Skipped", value: h.dupes, color: T.warning },
              { label: "Errors", value: h.errors, color: T.danger },
            ].map(s => (
              <div key={s.label} style={{ background: T.white, borderRadius: 8, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: T.slate, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={reset}>Import Another File</Btn>
          <Btn variant="secondary" onClick={reset}>Done</Btn>
        </div>
      </div>
    );
  }

  return null;
};

// ============================================================
// ============================================================
// MODULE: AI PLANNER — Sprint F
// ============================================================
const PROMPT_CATEGORIES = [
  {
    label: "Weekly Review",
    icon: "📅",
    prompts: [
      "What should I focus on this week?",
      "What tasks are overdue right now?",
      "What's due in the next 7 days?",
      "Give me a full weekly wedding status report",
    ]
  },
  {
    label: "Guests & RSVP",
    icon: "◎",
    prompts: [
      "Who is unlikely to attend the wedding?",
      "Who hasn't responded yet from the Groom side?",
      "Which groups have the lowest response rate?",
      "How many guests are confirmed vs projected?",
      "Which guests have dietary requirements?",
      "Which guests need airport transfers?",
    ]
  },
  {
    label: "Budget",
    icon: "◈",
    prompts: [
      "Summarise our budget concerns",
      "What hasn't been paid yet?",
      "Which vendors still need deposits?",
      "What's our biggest unconfirmed cost?",
    ]
  },
  {
    label: "Risks",
    icon: "⚠",
    prompts: [
      "What are the top wedding risks right now?",
      "What could go wrong in the next 30 days?",
      "Which vendors don't have signed contracts?",
      "What tasks are blocked or waiting?",
    ]
  },
  {
    label: "Draft Messages",
    icon: "✉",
    prompts: [
      "Draft a family update for the Groom side",
      "Draft a message to the Wedding Party about arrival",
      "Draft a guest reminder to RSVP",
      "Draft a vendor follow-up for contracts not yet signed",
      "Draft a welcome dinner briefing for international guests",
      "Draft groomsmen briefing notes",
    ]
  },
  {
    label: "Planning",
    icon: "◆",
    prompts: [
      "Which activities are best for the Muay Thai Friends group?",
      "Help me plan the wedding week schedule",
      "Which guests should attend Golf Day?",
      "What hotel coordination do I need to do?",
    ]
  },
];

const AiPlanner = ({ guests, tasks, budget, vendors }) => {
  const [conversations, setConversations] = useState([
    { id: "c1", title: "Wedding Planning", date: new Date().toLocaleDateString(), messages: [
      { role: "assistant", content: "Welcome to Wedding Planner AI. I have full context of your Bangkok Wedding — all guests, RSVP data, budget items, tasks, and vendors. Ask me anything or pick a prompt to get started." }
    ]}
  ]);
  const [activeConvId, setActiveConvId] = useState("c1");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [draftMode, setDraftMode] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [view, setView] = useState("chat"); // chat | saved | drafts
  const messagesEndRef = { current: null };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const messages = activeConv?.messages || [];

  // ── Rich context builder ──
  const buildContext = () => {
    const fc = calcForecast(guests);
    const totalBudget = budget.reduce((s, b) => s + (b.estimated||0), 0);
    const totalSpent = budget.reduce((s, b) => s + (b.actual||0), 0);
    const overdueTasks = tasks.filter(t => t.status !== "Done" && t.dueDate && new Date(t.dueDate) < new Date());
    const criticalTasks = tasks.filter(t => t.status !== "Done" && t.priority === "Critical");
    const unpaidVendors = vendors.filter(v => v.paymentStatus === "Unpaid");
    const unsignedContracts = vendors.filter(v => v.contractStatus === "Pending" || v.contractStatus === "");
    const dueThisWeek = tasks.filter(t => {
      if (t.status === "Done" || !t.dueDate) return false;
      const diff = (new Date(t.dueDate) - new Date()) / (1000*60*60*24);
      return diff >= 0 && diff <= 7;
    });
    const groupSummary = [...new Set(guests.map(g => g.group))].filter(Boolean).map(group => {
      const gs = guests.filter(g => g.group === group);
      const confirmed = gs.filter(g => g.rsvp === "Confirmed").length;
      const invited = gs.filter(g => g.rsvp !== "Not Invited").length;
      return `  ${group}: ${invited} invited, ${confirmed} confirmed`;
    }).join("\n");
    const dietaryGuests = guests.filter(g => g.dietary).map(g => `  ${g.firstName} ${g.lastName}: ${g.dietary}`).join("\n");
    const transferGuests = guests.filter(g => g.hotel && g.rsvp === "Confirmed").map(g => `  ${g.firstName} ${g.lastName} → ${g.hotel}`).join("\n");
    const unpaidBudget = budget.filter(b => !b.depositPaid && !b.fullyPaid);
    const budgetBreakdown = budget.map(b => `  ${b.ref} ${b.item}: budget $${b.estimated}, paid $${b.actual}, ${b.fullyPaid ? "FULLY PAID" : b.depositPaid ? "DEPOSIT PAID" : "UNPAID"}`).join("\n");

    return `WEDDING HQ — LIVE DATA CONTEXT
Bangkok Wedding · 18 September 2026 · Mandarin Oriental Bangkok
Days until wedding: ${Math.ceil((new Date("2026-09-18") - new Date()) / (1000*60*60*24))}

═══ GUEST DATA ═══
Total Invited: ${fc.invited} | Confirmed: ${fc.confirmed} | Declined: ${fc.declined} | Pending: ${fc.pending}
Projected Attendance: ${fc.projected}
Groom Side: ${guests.filter(g=>g.side==="Groom"&&g.rsvp!=="Not Invited").length} invited, ${guests.filter(g=>g.side==="Groom"&&g.rsvp==="Confirmed").length} confirmed
Bride Side: ${guests.filter(g=>g.side==="Bride"&&g.rsvp!=="Not Invited").length} invited, ${guests.filter(g=>g.side==="Bride"&&g.rsvp==="Confirmed").length} confirmed

Groups:
${groupSummary}

Dietary Requirements (${guests.filter(g=>g.dietary).length} guests):
${dietaryGuests || "  None recorded"}

Hotel Guests:
${transferGuests || "  None confirmed with hotels"}

═══ TASKS ═══
Total Open: ${tasks.filter(t=>t.status!=="Done").length} | Done: ${tasks.filter(t=>t.status==="Done").length}
Critical Open: ${criticalTasks.length}
Overdue (${overdueTasks.length}):
${overdueTasks.map(t=>`  [${t.ref||t.id}] ${t.task} — due ${t.dueDate} (${t.priority})`).join("\n") || "  None"}
Due This Week (${dueThisWeek.length}):
${dueThisWeek.map(t=>`  [${t.ref||t.id}] ${t.task} — due ${t.dueDate}`).join("\n") || "  None"}
Blocked/Waiting: ${tasks.filter(t=>t.status==="Blocked"||t.status==="Waiting").map(t=>t.task).join(", ") || "None"}

═══ BUDGET ═══
Total Budget: $${totalBudget.toLocaleString()} | Spent: $${totalSpent.toLocaleString()} | Outstanding: $${(totalBudget-totalSpent).toLocaleString()}
Unpaid Items (${unpaidBudget.length}): ${unpaidBudget.map(b=>b.item).join(", ")}

All Budget Items:
${budgetBreakdown}

═══ VENDORS ═══
Total: ${vendors.length} | Contracts Signed: ${vendors.filter(v=>v.contractStatus==="Signed").length}
Unpaid: ${unpaidVendors.map(v=>v.name).join(", ") || "None"}
Unsigned Contracts: ${unsignedContracts.map(v=>v.name).join(", ") || "None"}

${vendors.map(v=>`  ${v.name} (${v.service}): ${v.paymentStatus} payment, ${v.contractStatus} contract`).join("\n")}

IMPORTANT RULES:
- Base ALL answers ONLY on data above
- Never invent guest names, costs, or RSVPs not listed here
- When drafting messages, make them warm, clear and actionable
- State clearly if something is not in the data`.trim();
  };

  // ── Send message ──
  const sendMessage = async (text) => {
    const userMsg = (text || input).trim();
    if (!userMsg || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userMsg }];
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, messages: newMessages } : c));
    setLoading(true);

    try {
      const context = buildContext();
      const historyForAPI = newMessages.slice(1).map(m => ({ role: m.role, content: m.content }));
      const system = `You are Wedding Planner AI for the Bangkok Wedding (18 Sep 2026, Mandarin Oriental Bangkok). You have access to live wedding data below.

${context}

Guidelines:
- Be concise, warm, and actionable
- For draft messages: write them ready to send, clearly marked with "--- DRAFT START ---" and "--- DRAFT END ---"
- Never invent data not in the context
- Use bullet points for lists, keep answers scannable on mobile`;

      const reply = await callGemini({ messages: historyForAPI, system, maxTokens: 1500 });
      const hasDraft = reply.includes("--- DRAFT START ---");

      const finalMessages = [...newMessages, { role: "assistant", content: reply, isDraft: hasDraft }];
      setConversations(prev => prev.map(c => c.id === activeConvId ? {
        ...c,
        messages: finalMessages,
        title: c.title === "New Conversation" ? userMsg.slice(0, 40) : c.title
      } : c));
    } catch (err) {
      const errMessages = [...newMessages, { role: "assistant", content: err?.message === "NO_KEY" ? "⚠️ No Gemini API key set. Go to Settings → add your key." : "Unable to connect. Check your API key in Settings." }];
      setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, messages: errMessages } : c));
    }
    setLoading(false);
  };

  // ── New conversation ──
  const newConversation = () => {
    const id = "c" + Date.now();
    setConversations(prev => [...prev, {
      id, title: "New Conversation", date: new Date().toLocaleDateString(),
      messages: [{ role: "assistant", content: "New conversation started. What would you like to work on?" }]
    }]);
    setActiveConvId(id);
    setView("chat");
  };

  // ── Copy message ──
  const copyMessage = (content, id) => {
    // Extract draft content if present
    const draftMatch = content.match(/--- DRAFT START ---([\s\S]*?)--- DRAFT END ---/);
    const toCopy = draftMatch ? draftMatch[1].trim() : content;
    navigator.clipboard?.writeText(toCopy).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Save draft ──
  const saveDraft = (content, prompt) => {
    const draftMatch = content.match(/--- DRAFT START ---([\s\S]*?)--- DRAFT END ---/);
    const text = draftMatch ? draftMatch[1].trim() : content;
    setSavedDrafts(prev => [{
      id: Date.now(), title: prompt?.slice(0, 50) || "Draft",
      content: text, date: new Date().toLocaleDateString()
    }, ...prev]);
  };

  // ── Format message content ──
  const formatContent = (content) => {
    if (!content.includes("--- DRAFT START ---")) return content;
    const parts = content.split(/(--- DRAFT START ---[\s\S]*?--- DRAFT END ---)/);
    return parts.map((part, i) => {
      if (part.startsWith("--- DRAFT START ---")) {
        const text = part.replace("--- DRAFT START ---", "").replace("--- DRAFT END ---", "").trim();
        return (
          <div key={i} style={{ background: T.goldLight, border: `1.5px solid ${T.gold}`, borderRadius: 10, padding: 14, marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>✉ Draft Message</div>
            <div style={{ fontSize: 13, color: T.carbon, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{text}</div>
          </div>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div>
      <SectionHeader
        title="Wedding Planner AI"
        subtitle="Powered by Claude · Full wedding context · Bangkok Wedding"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small variant="secondary" onClick={() => setView(view === "saved" ? "chat" : "saved")}>
              {view === "saved" ? "← Chat" : `Saved (${conversations.length})`}
            </Btn>
            <Btn small onClick={newConversation}>+ New</Btn>
          </div>
        }
      />

      {/* ── SAVED CONVERSATIONS ── */}
      {view === "saved" && (
        <div>
          <div style={{ display: "grid", gap: 10 }}>
            {conversations.map(c => (
              <Card key={c.id} style={{ padding: "12px 16px", cursor: "pointer", border: c.id === activeConvId ? `2px solid ${T.rosso}` : `1px solid ${T.linenDark}` }}
                onClick={() => { setActiveConvId(c.id); setView("chat"); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.carbon }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: T.mist, marginTop: 2 }}>{c.date} · {c.messages.length} messages</div>
                  </div>
                  {c.id === activeConvId && <Badge label="Active" color="rosso" />}
                </div>
              </Card>
            ))}
          </div>
          {savedDrafts.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Saved Drafts</div>
              {savedDrafts.map(d => (
                <Card key={d.id} style={{ padding: "12px 16px", marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.carbon, marginBottom: 4 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: T.slate, marginBottom: 10, lineHeight: 1.6 }}>{d.content.slice(0, 120)}…</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => copyMessage(d.content, d.id)} style={{ background: T.rosso, color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {copiedId === d.id ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={() => setSavedDrafts(prev => prev.filter(x => x.id !== d.id))} style={{ background: T.linen, color: T.slate, border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Delete</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CHAT VIEW ── */}
      {view === "chat" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>

          {/* Prompt categories */}
          <div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {PROMPT_CATEGORIES.map(cat => (
                <button key={cat.label} onClick={() => setActiveCategory(activeCategory === cat.label ? null : cat.label)}
                  style={{
                    background: activeCategory === cat.label ? T.carbon : T.white,
                    border: `1.5px solid ${activeCategory === cat.label ? T.carbon : T.linenDark}`,
                    borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700,
                    color: activeCategory === cat.label ? "#fff" : T.carbon, cursor: "pointer"
                  }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            {activeCategory && (
              <div style={{ background: T.linen, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {PROMPT_CATEGORIES.find(c => c.label === activeCategory)?.prompts.map(p => (
                    <button key={p} onClick={() => { sendMessage(p); setActiveCategory(null); }}
                      style={{
                        background: T.white, border: `1px solid ${T.linenDark}`, borderRadius: 8,
                        padding: "6px 12px", fontSize: 12, color: T.carbon, cursor: "pointer",
                        fontWeight: 500, textAlign: "left", lineHeight: 1.4
                      }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat window */}
          <Card style={{ padding: 0, display: "flex", flexDirection: "column", height: 480 }}>
            {/* Conversation title bar */}
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.linen}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.carbon }}>{activeConv?.title}</span>
              <span style={{ fontSize: 11, color: T.mist }}>{messages.length} messages</span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
                  {m.role === "assistant" && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.carbon, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, marginTop: 2 }}>✧</div>
                  )}
                  <div style={{ maxWidth: "82%" }}>
                    <div style={{
                      padding: "10px 14px", borderRadius: 12,
                      background: m.role === "user" ? T.rosso : T.linen,
                      color: m.role === "user" ? "#fff" : T.carbon,
                      fontSize: 13, lineHeight: 1.65,
                      borderBottomRightRadius: m.role === "user" ? 4 : 12,
                      borderBottomLeftRadius: m.role === "user" ? 12 : 4,
                      whiteSpace: "pre-wrap"
                    }}>
                      {m.role === "assistant" ? formatContent(m.content) : m.content}
                    </div>
                    {m.role === "assistant" && i > 0 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button onClick={() => copyMessage(m.content, i)} style={{
                          background: "none", border: `1px solid ${T.linenDark}`, borderRadius: 6,
                          padding: "3px 10px", fontSize: 11, color: T.slate, cursor: "pointer", fontWeight: 600
                        }}>{copiedId === i ? "✓ Copied" : "Copy"}</button>
                        {m.isDraft && (
                          <button onClick={() => saveDraft(m.content, messages[i-1]?.content)} style={{
                            background: T.goldLight, border: `1px solid ${T.gold}`, borderRadius: 6,
                            padding: "3px 10px", fontSize: 11, color: T.gold, cursor: "pointer", fontWeight: 700
                          }}>Save Draft</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.carbon, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>✧</div>
                  <div style={{ padding: "10px 14px", background: T.linen, borderRadius: 12, fontSize: 13, color: T.mist }}>
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={el => { if (messagesEndRef) messagesEndRef.current = el; }} />
            </div>

            {/* Input */}
            <div style={{ borderTop: `1px solid ${T.linenDark}`, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => setDraftMode(!draftMode)} style={{
                background: draftMode ? T.gold : T.linen, border: "none", borderRadius: 8,
                padding: "8px 10px", fontSize: 14, cursor: "pointer", flexShrink: 0
              }} title="Draft mode">✉</button>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder={draftMode ? "Draft a message for…" : "Ask about your wedding…"}
                style={{
                  flex: 1, border: `1.5px solid ${T.linenDark}`, borderRadius: 8, padding: "8px 12px",
                  fontSize: 14, color: T.carbon, background: T.white, outline: "none"
                }}
              />
              <Btn onClick={() => sendMessage()} disabled={loading || !input.trim()}>Send</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// ============================================================
// MODULE: COMMS
// ============================================================
const Comms = () => {
  const templates = [
    { id: "c001", title: "Save the Date", audience: "All Guests", status: "Sent", date: "2026-05-01", type: "Email" },
    { id: "c002", title: "Family Welcome Note", audience: "Immediate Family", status: "Draft", date: null, type: "WhatsApp" },
    { id: "c003", title: "Groomsmen Briefing", audience: "Wedding Party", status: "Draft", date: null, type: "Email" },
    { id: "c004", title: "Hotel Coordination", audience: "Confirmed International", status: "Pending", date: null, type: "Email" },
  ];
  const typeColor = { Email: "info", WhatsApp: "success", SMS: "olive" };
  const statusColor = { Sent: "success", Draft: "mist", Pending: "warning" };
  return (
    <div>
      <SectionHeader title="Communications Centre" subtitle="Drafts, templates, and sent communications" action={<Btn small>+ New Draft</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {templates.map(t => (
          <Card key={t.id}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <Badge label={t.type} color={typeColor[t.type] || "mist"} />
              <Badge label={t.status} color={statusColor[t.status] || "mist"} />
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: T.carbon }}>{t.title}</h3>
            <div style={{ fontSize: 13, color: T.slate, marginBottom: 10 }}>To: {t.audience}</div>
            {t.date && <div style={{ fontSize: 12, color: T.mist }}>Sent: {fmtDate(t.date)}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn variant="secondary" small>Edit</Btn>
              {t.status !== "Sent" && <Btn small>Send</Btn>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// MODULE: SETTINGS
// ============================================================
// ── Test AI Button ──
const TestAiButton = () => {
  const [status, setStatus] = useState(null); // null | "testing" | "ok" | "fail"
  const [msg, setMsg] = useState("");

  const test = async () => {
    setStatus("testing");
    setMsg("");
    try {
      const reply = await callGemini({
        messages: [{ role: "user", content: "Say exactly: AI is working!" }],
        system: "You are a test bot. Reply only with what the user asks.",
        maxTokens: 20
      });
      setStatus("ok");
      setMsg(reply.trim());
    } catch (err) {
      setStatus("fail");
      setMsg(err?.message === "NO_KEY" ? "No key saved yet." : err?.message || "Connection failed.");
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={test} disabled={status === "testing"} style={{
        background: status === "ok" ? T.success : status === "fail" ? T.danger : T.carbon,
        color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px",
        fontSize: 13, fontWeight: 800, cursor: "pointer"
      }}>
        {status === "testing" ? "Testing…" : status === "ok" ? "✓ AI Working" : status === "fail" ? "✗ Failed" : "Test AI Connection"}
      </button>
      {msg && <div style={{ fontSize: 12, color: status === "ok" ? T.success : T.danger, marginTop: 6, fontWeight: 600 }}>{msg}</div>}
    </div>
  );
};

// ── User Management — Admin only ──
const UserManagement = () => {
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState(3);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const assignRole = async () => {
    if (!email) return;
    setLoading(true); setStatus("");
    try {
      // Save role by email — user must have logged in at least once
      // We store by email as a lookup key
      await setDoc(doc(fbDb, "invites", email.toLowerCase()), {
        email: email.toLowerCase(),
        role: Number(selectedRole),
        assignedAt: new Date().toISOString()
      });
      setStatus(`✓ Role L${selectedRole} set for ${email}. They'll get access on next login.`);
      setEmail("");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <Card style={{ marginBottom: 16, border: `1.5px solid ${T.linenDark}` }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: T.carbon, marginBottom: 4 }}>👥 Manage User Access</div>
      <div style={{ fontSize: 12, color: T.mist, marginBottom: 14 }}>First add the user in Firebase Console → Authentication → Add user. Then assign their role here.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@email.com"
          style={{ flex: 2, minWidth: 160, border: `1.5px solid ${T.linenDark}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }} />
        <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
          style={{ flex: 1, minWidth: 120, border: `1.5px solid ${T.linenDark}`, borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
          <option value={2}>L2 — Partner (Sira)</option>
          <option value={3}>L3 — Planner</option>
          <option value={4}>L4 — Family</option>
          <option value={5}>L5 — Read Only</option>
        </select>
        <button onClick={assignRole} disabled={loading || !email}
          style={{ background: T.rosso, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "…" : "Assign"}
        </button>
      </div>
      {status && <div style={{ fontSize: 12, color: status.startsWith("✓") ? T.success : T.danger, marginTop: 4 }}>{status}</div>}
      <div style={{ marginTop: 14, fontSize: 11, color: T.mist }}>
        {[
          { l: 1, name: "Admin (You)", desc: "Everything + Settings" },
          { l: 2, name: "Partner (Sira)", desc: "Everything except Settings. Full budget." },
          { l: 3, name: "Planner", desc: "Guests, Tasks, Vendors, AI. No budget." },
          { l: 4, name: "Family", desc: "Guests (view), Events, Timeline." },
          { l: 5, name: "Read Only", desc: "Events, Timeline only." },
        ].map(r => (
          <div key={r.l} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "flex-start" }}>
            <span style={{ background: ROLE_COLORS[r.l], color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>L{r.l}</span>
            <span style={{ fontWeight: 600, color: T.carbon, minWidth: 110 }}>{r.name}</span>
            <span style={{ color: T.mist }}>{r.desc}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

const Settings = ({ user, role, onLogout }) => {
  const [settings, setSettings] = useState({
    weddingName: "Bangkok Wedding",
    groomName: "Leon",
    brideName: "Sira",
    weddingDate: "2026-09-18",
    city: "Bangkok, Thailand",
    venue: "Mandarin Oriental Bangkok",
    groomAllocation: 150,
    brideAllocation: 150,
    probCertain: 95,
    probLikely: 75,
    probMaybe: 45,
    probUnlikely: 15,
  });
  const [geminiKey, setGeminiKey] = useState(getGeminiKey());
  const [keyVisible, setKeyVisible] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const saveKey = () => {
    localStorage.setItem("gemini_api_key", geminiKey.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  return (
    <div>
      <SectionHeader title="Settings" subtitle="Platform configuration and preferences" />

      {/* Account */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.carbon, marginBottom: 12 }}>Account</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.carbon }}>{user?.email}</div>
            <div style={{ fontSize: 11, color: T.mist, marginTop: 2 }}>
              <span style={{ background: ROLE_COLORS[role], color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>L{role} {ROLE_NAMES[role]}</span>
            </div>
          </div>
          <button onClick={onLogout} style={{ background: T.linen, border: `1px solid ${T.linenDark}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: T.carbon, cursor: "pointer" }}>
            Sign Out
          </button>
        </div>
      </Card>

      {/* User Management — Admin only */}
      {role === 1 && <UserManagement />}

      {/* AI Key */}
      <Card style={{ marginBottom: 16, border: `2px solid ${T.rosso}` }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.carbon, marginBottom: 4 }}>✧ Gemini AI Key</div>
        <div style={{ fontSize: 12, color: T.mist, marginBottom: 14 }}>
          Stored on this device only. Get your key from <span style={{ color: T.info }}>aistudio.google.com</span> → Get API Key. Use <strong>gemini-2.5-flash-lite</strong>.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type={keyVisible ? "text" : "password"}
            value={geminiKey}
            onChange={e => setGeminiKey(e.target.value)}
            placeholder="AIza…"
            style={{ flex: 1, border: `1.5px solid ${T.linenDark}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, color: T.carbon, background: T.white, outline: "none", fontFamily: "monospace" }}
          />
          <button onClick={() => setKeyVisible(!keyVisible)} style={{ background: T.linen, border: "none", borderRadius: 8, padding: "9px 12px", cursor: "pointer", fontSize: 13, color: T.slate, fontWeight: 600 }}>
            {keyVisible ? "Hide" : "Show"}
          </button>
          <button onClick={saveKey} style={{ background: keySaved ? T.success : T.rosso, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>
            {keySaved ? "✓ Saved" : "Save"}
          </button>
        </div>
        {geminiKey && geminiKey === getGeminiKey() && (
          <div style={{ fontSize: 11, color: T.success, marginTop: 8, fontWeight: 700 }}>✓ Key is set — AI features are active</div>
        )}
        {getGeminiKey() && (
          <TestAiButton />
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.carbon, marginBottom: 16, borderBottom: `1px solid ${T.linen}`, paddingBottom: 10 }}>Wedding Details</div>
          {[
            { label: "Wedding Name", key: "weddingName" },
            { label: "Groom Name", key: "groomName" },
            { label: "Bride Name", key: "brideName" },
            { label: "Wedding Date", key: "weddingDate" },
            { label: "City", key: "city" },
            { label: "Venue", key: "venue" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, marginBottom: 5 }}>{f.label}</div>
              <Input value={settings[f.key]} onChange={v => set(f.key, v)} style={{ width: "100%" }} />
            </div>
          ))}
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.carbon, marginBottom: 16, borderBottom: `1px solid ${T.linen}`, paddingBottom: 10 }}>Guest Allocation</div>
            {[
              { label: "Groom Allocation", key: "groomAllocation" },
              { label: "Bride Allocation", key: "brideAllocation" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: T.slate, fontWeight: 700, marginBottom: 5 }}>{f.label}</div>
                <Input value={settings[f.key]} onChange={v => set(f.key, v)} />
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.carbon, marginBottom: 16, borderBottom: `1px solid ${T.linen}`, paddingBottom: 10 }}>Attendance Probabilities</div>
            {[
              { label: "Certain (%)", key: "probCertain" },
              { label: "Likely (%)", key: "probLikely" },
              { label: "Maybe (%)", key: "probMaybe" },
              { label: "Unlikely (%)", key: "probUnlikely" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 13, color: T.carbon }}>{f.label}</span>
                <Input value={settings[f.key]} onChange={v => set(f.key, v)} style={{ width: 80, textAlign: "center" }} />
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.carbon, marginBottom: 12 }}>Platform Info</div>
            {[
              { label: "Version", value: "1.0.0" },
              { label: "AI Model", value: "Gemini 2.5 Flash Lite" },
              { label: "Environment", value: "Production" },
              { label: "Build", value: "#16" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.linen}` }}>
                <span style={{ fontSize: 12, color: T.slate }}>{item.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.carbon }}>{item.value}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <Btn>Save Settings</Btn>
      </div>
    </div>
  );
};

// ============================================================
// AI ACTION CARD — shows proposed change before applying
// ============================================================
const AiActionCard = ({ action, onApply, onDismiss }) => {
  const typeColors = {
    update_guest: T.info, update_task: T.olive,
    update_budget: T.gold, create_task: T.success, create_budget: T.success,
  };
  const typeLabels = {
    update_guest: "Update Guest", update_task: "Update Task",
    update_budget: "Update Budget", create_task: "New Task", create_budget: "New Budget Item",
  };
  const color = typeColors[action.type] || T.rosso;
  return (
    <div style={{ background: T.white, border: `2px solid ${color}`, borderRadius: 12, padding: 14, marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
        ⚡ {typeLabels[action.type] || "Proposed Change"}
      </div>
      <div style={{ marginBottom: 10 }}>
        {action.target && <div style={{ fontSize: 13, fontWeight: 700, color: T.carbon, marginBottom: 4 }}>{action.target}</div>}
        {action.changes && Object.entries(action.changes).map(([k, v]) => (
          <div key={k} style={{ fontSize: 12, color: T.slate, display: "flex", gap: 6, marginBottom: 3 }}>
            <span style={{ fontWeight: 700, color: T.carbon, minWidth: 80 }}>{k}:</span>
            {action.from?.[k] && <span style={{ color: T.danger, textDecoration: "line-through" }}>{String(action.from[k])}</span>}
            {action.from?.[k] && <span style={{ color: T.mist }}>→</span>}
            <span style={{ color, fontWeight: 700 }}>{String(v)}</span>
          </div>
        ))}
        {action.data && Object.entries(action.data).filter(([k]) => !["id","ref"].includes(k)).map(([k, v]) => v && (
          <div key={k} style={{ fontSize: 12, color: T.slate, display: "flex", gap: 6, marginBottom: 3 }}>
            <span style={{ fontWeight: 700, color: T.carbon, minWidth: 80 }}>{k}:</span>
            <span style={{ color: T.carbon }}>{String(v)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onApply} style={{ background: color, color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Apply</button>
        <button onClick={onDismiss} style={{ background: T.linen, color: T.slate, border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Dismiss</button>
      </div>
    </div>
  );
};

// ============================================================
// MINI AI — floating panel with AI actions + photo/file upload
// ============================================================
const MiniAI = ({ guests, tasks, budget, vendors, setGuests, setTasks, setBudget }) => {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your Wedding Planner AI. Ask me anything, or I can make changes directly — just tell me what you need." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [attachedImage, setAttachedImage] = useState(null);
  const [pendingActions, setPendingActions] = useState({});

  const QUICK = [
    "What should I focus on this week?",
    "What's overdue?",
    "Mark all Done tasks as complete",
    "Budget summary",
    "Top risks",
    "Draft family update",
  ];

  const buildContext = () => {
    const fc = calcForecast(guests);
    const totalBudget = budget.reduce((s, b) => s + (b.estimated||0), 0);
    const totalSpent = budget.reduce((s, b) => s + (b.actual||0), 0);
    const overdue = tasks.filter(t => t.status !== "Done" && t.dueDate && new Date(t.dueDate) < new Date());
    const unpaid = budget.filter(b => !b.depositPaid && !b.fullyPaid);
    const guestList = guests.map(g => `${g.firstName} ${g.lastName} (${g.side}, ${g.group}, RSVP: ${g.rsvp}, Travel: ${g.travelLikelihood})`).join("\n");
    const taskList = tasks.map(t => `[${t.ref||t.id}] ${t.task} - ${t.status} - ${t.priority} - due ${t.dueDate||"none"}`).join("\n");
    const budgetList = budget.map(b => `[${b.ref}] ${b.item} - $${b.estimated} budget - $${b.actual} paid - ${b.fullyPaid?"PAID":b.depositPaid?"DEPOSIT":"UNPAID"}`).join("\n");
    return `Bangkok Wedding · 18 Sep 2026 · Mandarin Oriental
Days until wedding: ${Math.ceil((new Date("2026-09-18") - new Date()) / (1000*60*60*24))}
Guests: ${fc.invited} invited, ${fc.confirmed} confirmed, ${fc.projected} projected
Budget: $${totalBudget.toLocaleString()} total, $${totalSpent.toLocaleString()} spent, ${unpaid.length} unpaid items
Overdue tasks: ${overdue.length}

ALL GUESTS:
${guestList}

ALL TASKS:
${taskList}

ALL BUDGET ITEMS:
${budgetList}

VENDORS: ${vendors.map(v=>`${v.name} (${v.service}, ${v.paymentStatus}, ${v.contractStatus})`).join("; ")}`;
  };

  // Apply an AI action to app state
  const applyAction = (msgIdx, action) => {
    try {
      if (action.type === "update_guest") {
        setGuests(prev => prev.map(g => {
          const name = `${g.firstName} ${g.lastName}`.toLowerCase();
          if (name === action.target?.toLowerCase() || g.id === action.targetId) {
            return { ...g, ...action.changes };
          }
          return g;
        }));
      } else if (action.type === "update_task") {
        setTasks(prev => prev.map(t => {
          if (t.ref === action.targetRef || t.task?.toLowerCase() === action.target?.toLowerCase() || t.id === action.targetId) {
            return { ...t, ...action.changes };
          }
          return t;
        }));
      } else if (action.type === "create_task") {
        const id = "t" + Date.now();
        const ref = `T-${String(tasks.length + 1).padStart(3, "0")}`;
        setTasks(prev => [...prev, { id, ref, ...action.data, status: action.data.status || "Not Started", priority: action.data.priority || "Medium", owner: action.data.owner || "Both", category: action.data.category || "Other" }]);
      } else if (action.type === "update_budget") {
        setBudget(prev => prev.map(b => {
          if (b.ref === action.targetRef || b.item?.toLowerCase() === action.target?.toLowerCase() || b.id === action.targetId) {
            return { ...b, ...action.changes };
          }
          return b;
        }));
      } else if (action.type === "create_budget") {
        const id = "b" + Date.now();
        const ref = `B-${String(budget.length + 1).padStart(3, "0")}`;
        setBudget(prev => [...prev, { id, ref, depositPaid: false, fullyPaid: false, actual: 0, ...action.data }]);
      }
      // Mark as applied
      setPendingActions(prev => ({ ...prev, [msgIdx]: { ...prev[msgIdx], applied: true } }));
      // Update message to show applied
      setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, actionApplied: true } : m));
    } catch (err) {
      console.error("Action apply error:", err);
    }
  };

  const dismissAction = (msgIdx) => {
    setPendingActions(prev => ({ ...prev, [msgIdx]: { ...prev[msgIdx], dismissed: true } }));
  };

  const send = async (text) => {
    const msg = (text || input).trim();
    if ((!msg && !attachedImage) || loading) return;
    setInput("");

    const userContent = [];
    if (attachedImage) {
      userContent.push({ type: "image", source: { type: "base64", media_type: attachedImage.split(";")[0].split(":")[1], data: attachedImage.split(",")[1] } });
    }
    if (msg) userContent.push({ type: "text", text: msg });

    const displayMsg = msg || "📷 Photo sent";
    const newMsgs = [...messages, { role: "user", content: displayMsg }];
    setMessages(newMsgs);
    setAttachedImage(null);
    setLoading(true);

    try {
      const context = buildContext();
      const apiMessages = newMsgs.slice(1).map((m, i) => {
        if (i === newMsgs.length - 2 && attachedImage) {
          return { role: "user", content: userContent };
        }
        return { role: m.role, content: m.content };
      });

      const system = `You are Wedding Planner AI for the Bangkok Wedding. You can READ and WRITE to the app.

${context}

RESPONSE FORMAT:
- Always reply with helpful text first
- If you want to make a change, include ONE JSON action block at the end wrapped in <<<ACTION>>> and <<<END_ACTION>>>
- For drafts use --- DRAFT START --- and --- DRAFT END ---

ACTION TYPES you can use:
1. Update guest RSVP/field:
<<<ACTION>>>
{"type":"update_guest","target":"Full Name","changes":{"rsvp":"Confirmed"},"from":{"rsvp":"Invited"}}
<<<END_ACTION>>>

2. Update task status/field:
<<<ACTION>>>
{"type":"update_task","targetRef":"T-001","target":"Task name","changes":{"status":"Done"},"from":{"status":"In Progress"}}
<<<END_ACTION>>>

3. Create new task:
<<<ACTION>>>
{"type":"create_task","data":{"task":"Task name","category":"Vendors","owner":"Both","priority":"High","dueDate":"2026-08-01","notes":""}}
<<<END_ACTION>>>

4. Update budget item:
<<<ACTION>>>
{"type":"update_budget","targetRef":"B-001","target":"Item name","changes":{"depositPaid":true},"from":{"depositPaid":false}}
<<<END_ACTION>>>

5. Create budget item:
<<<ACTION>>>
{"type":"create_budget","data":{"item":"Item name","category":"Venue","vendor":"Vendor name","estimated":5000,"notes":""}}
<<<END_ACTION>>>

Only include an action if the user is clearly asking you to make a change. For questions, just answer in text. Never invent data not in the context.`;

      let reply = await callGemini({ messages: apiMessages, system, maxTokens: 1200 });

      // Extract action if present
      let action = null;
      const actionMatch = reply.match(/<<<ACTION>>>([\s\S]*?)<<<END_ACTION>>>/);
      if (actionMatch) {
        try {
          action = JSON.parse(actionMatch[1].trim());
          reply = reply.replace(/<<<ACTION>>>[\s\S]*?<<<END_ACTION>>>/, "").trim();
        } catch {}
      }

      const msgIdx = newMsgs.length;
      const finalMsg = { role: "assistant", content: reply, action };
      setMessages([...newMsgs, finalMsg]);
      if (action) setPendingActions(prev => ({ ...prev, [msgIdx]: action }));

    } catch (err) {
      setMessages([...newMsgs, { role: "assistant", content: err?.message === "NO_KEY" ? "⚠️ No Gemini API key set. Go to Settings → add your key." : "Connection error. Try again." }]);
    }
    setLoading(false);
  };

  const copy = (content, id) => {
    const match = content.match(/--- DRAFT START ---([\s\S]*?)--- DRAFT END ---/);
    navigator.clipboard?.writeText(match ? match[1].trim() : content).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatMsg = (content) => {
    if (!content) return content;
    if (!content.includes("--- DRAFT START ---")) return content;
    return content.split(/(--- DRAFT START ---[\s\S]*?--- DRAFT END ---)/).map((part, i) => {
      if (part.startsWith("--- DRAFT START ---")) {
        const text = part.replace("--- DRAFT START ---","").replace("--- DRAFT END ---","").trim();
        return <div key={i} style={{ background: T.goldLight, border: `1px solid ${T.gold}`, borderRadius: 8, padding: 10, marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.gold, marginBottom: 6 }}>✉ DRAFT</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", color: T.carbon }}>{text}</div>
        </div>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Quick prompts */}
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.linen}`, display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
        {QUICK.map(q => (
          <button key={q} onClick={() => send(q)} style={{
            background: T.linen, border: "none", borderRadius: 16, padding: "5px 12px",
            fontSize: 12, color: T.carbon, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap"
          }}>{q}</button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
            {m.role === "assistant" && (
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.carbon, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, marginTop: 2 }}>✧</div>
            )}
            <div style={{ maxWidth: "86%" }}>
              <div style={{
                padding: "9px 13px", borderRadius: 12,
                background: m.role === "user" ? T.rosso : T.linen,
                color: m.role === "user" ? "#fff" : T.carbon,
                fontSize: 13, lineHeight: 1.6,
                borderBottomRightRadius: m.role === "user" ? 4 : 12,
                borderBottomLeftRadius: m.role === "user" ? 12 : 4,
                whiteSpace: "pre-wrap"
              }}>
                {m.role === "assistant" ? formatMsg(m.content) : m.content}
              </div>

              {/* AI Action card */}
              {m.role === "assistant" && m.action && !pendingActions[i]?.applied && !pendingActions[i]?.dismissed && (
                <AiActionCard
                  action={m.action}
                  onApply={() => applyAction(i, m.action)}
                  onDismiss={() => dismissAction(i)}
                />
              )}
              {m.role === "assistant" && m.action && pendingActions[i]?.applied && (
                <div style={{ fontSize: 11, color: T.success, fontWeight: 700, marginTop: 6 }}>✓ Applied to app</div>
              )}
              {m.role === "assistant" && m.action && pendingActions[i]?.dismissed && (
                <div style={{ fontSize: 11, color: T.mist, marginTop: 6 }}>Dismissed</div>
              )}

              {m.role === "assistant" && i > 0 && (
                <button onClick={() => copy(m.content, i)} style={{
                  background: "none", border: `1px solid ${T.linenDark}`, borderRadius: 6,
                  padding: "2px 8px", fontSize: 11, color: T.slate, cursor: "pointer",
                  fontWeight: 600, marginTop: 4
                }}>{copiedId === i ? "✓ Copied" : "Copy"}</button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.carbon, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✧</div>
            <div style={{ padding: "9px 13px", background: T.linen, borderRadius: 12, fontSize: 13, color: T.mist }}>Thinking…</div>
          </div>
        )}
      </div>

      {/* Image preview */}
      {attachedImage && (
        <div style={{ padding: "6px 14px", borderTop: `1px solid ${T.linen}`, display: "flex", alignItems: "center", gap: 8 }}>
          <img src={attachedImage} alt="attached" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
          <span style={{ fontSize: 12, color: T.slate, flex: 1 }}>Image attached</span>
          <button onClick={() => setAttachedImage(null)} style={{ background: "none", border: "none", color: T.mist, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${T.linenDark}`, display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
        {/* Photo/file attach */}
        <label style={{ flexShrink: 0, cursor: "pointer", background: T.linen, border: "none", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
          title="Attach photo or file">
          📷
          <input type="file" accept="image/*" capture="environment"
            onChange={e => {
              const file = e.target.files[0];
              if (!file) return;
              const r = new FileReader();
              r.onload = ev => setAttachedImage(ev.target.result);
              r.readAsDataURL(file);
            }}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
        </label>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask or tell me to make a change…"
          style={{
            flex: 1, border: `1.5px solid ${T.linenDark}`, borderRadius: 8, padding: "9px 12px",
            fontSize: 14, color: T.carbon, background: T.white, outline: "none"
          }}
        />
        <Btn onClick={() => send()} disabled={loading || (!input.trim() && !attachedImage)}>Send</Btn>
      </div>
    </div>
  );
};


// ============================================================
// MAIN APP — Phase 4 with Firebase Auth + Firestore Sync
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [history, setHistory] = useState(["dashboard"]);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [guests, setGuestsState] = useState(SEED_GUESTS);
  const [tasks, setTasksState] = useState(SEED_TASKS);
  const [budget, setBudgetState] = useState(SEED_BUDGET);
  const [vendors, setVendors] = useState(SEED_VENDORS);
  const [activities] = useState(SEED_ACTIVITIES);
  const [timeline] = useState(SEED_TIMELINE);
  const [hotels] = useState(SEED_HOTELS);
  const [showClosing, setShowClosing] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  const WEDDING_DATE = "2026-09-18";

  // ── Auth listener ──
  useEffect(() => {
    const unsub = onAuthStateChanged(fbAuth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Check users collection first
          const snap = await getDoc(doc(fbDb, "users", firebaseUser.uid));
          if (snap.exists()) {
            setRole(snap.data().role);
          } else {
            // Check invites by email
            const inviteSnap = await getDoc(doc(fbDb, "invites", firebaseUser.email.toLowerCase()));
            // First user ever registered gets Admin
            const assignedRole = inviteSnap.exists() ? inviteSnap.data().role : ROLES.READONLY;
            // Save to users collection for next time
            await setDoc(doc(fbDb, "users", firebaseUser.uid), {
              email: firebaseUser.email,
              role: assignedRole,
              uid: firebaseUser.uid
            });
            setRole(assignedRole);
          }
        } catch { setRole(ROLES.READONLY); }
      } else {
        setUser(null);
        setRole(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Firestore sync — seed then subscribe ──
  useEffect(() => {
    if (!user) return;

    const setup = async () => {
      // Seed data if first time
      await seedCollection("guests", SEED_GUESTS);
      await seedCollection("tasks", SEED_TASKS);
      await seedCollection("budget", SEED_BUDGET);
      await seedCollection("vendors", SEED_VENDORS);
      setDbReady(true);
    };
    setup();

    // Subscribe to live updates
    const unsubGuests = subscribeCollection("guests", data => { if (data.length > 0) setGuestsState(data); });
    const unsubTasks = subscribeCollection("tasks", data => { if (data.length > 0) setTasksState(data); });
    const unsubBudget = subscribeCollection("budget", data => { if (data.length > 0) setBudgetState(data); });
    const unsubVendors = subscribeCollection("vendors", data => { if (data.length > 0) setVendors(data); });

    return () => { unsubGuests(); unsubTasks(); unsubBudget(); unsubVendors(); };
  }, [user]);

  // ── Firestore-aware setters ──
  const setGuests = useCallback((updater) => {
    setGuestsState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      next.forEach(g => saveToFirestore("guests", g.id, g));
      return next;
    });
  }, []);

  const setTasks = useCallback((updater) => {
    setTasksState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      next.forEach(t => saveToFirestore("tasks", t.id, t));
      return next;
    });
  }, []);

  const setBudget = useCallback((updater) => {
    setBudgetState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      next.forEach(b => saveToFirestore("budget", b.id, b));
      return next;
    });
  }, []);

  const activeModule = history[history.length - 1];
  const canGoBack = history.length > 1;

  const navigate = useCallback((moduleId) => {
    setHistory(prev => {
      if (prev[prev.length - 1] === moduleId) return prev;
      return [...prev, moduleId].slice(-20);
    });
    setSidebarOpen(false);
  }, []);

  const goBack = useCallback(() => {
    setHistory(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  }, []);

  // ── Loading screen ──
  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: "#1C1C1E", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>
          <span style={{ color: "#C41230" }}>SIRA</span>
          <span style={{ color: "#fff" }}>LEON</span>
          <span style={{ color: "#2D6DB5" }}>WEDDING</span>
          <span style={{ color: "#fff" }}>H</span>
          <span style={{ color: "#C41230" }}>Q</span>
        </div>
        <div style={{ color: "#AEAEB2", fontSize: 13 }}>Loading…</div>
      </div>
    </div>
  );

  // ── Login screen ──
  if (!user) return <LoginScreen />;

  const renderModule = () => {
    // Role-based access control
    if (!canAccess(role, activeModule)) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.carbon, marginBottom: 8 }}>Access Restricted</div>
          <div style={{ fontSize: 14, color: T.mist }}>Your role ({ROLE_NAMES[role]}) doesn't have access to this section.</div>
        </div>
      );
    }
    switch (activeModule) {
      case "dashboard": return <Dashboard guests={guests} tasks={tasks} budget={budget} weddingDate={WEDDING_DATE} />;
      case "guests": return <Guests guests={guests} setGuests={setGuests} canEdit={canEdit(role, "guests")} />;
      case "groups": return <Groups guests={guests} setGuests={setGuests} canEdit={canEdit(role, "groups")} />;
      case "rsvp": return <RsvpForecast guests={guests} />;
      case "events": return <Events />;
      case "activities": return <Activities activities={activities} />;
      case "tasks": return <Tasks tasks={tasks} setTasks={setTasks} canEdit={canEdit(role, "tasks")} />;
      case "budget": return <Budget budget={budget} setBudget={setBudget} canEdit={canEdit(role, "budget")} />;
      case "vendors": return <Vendors vendors={vendors} canEdit={canEdit(role, "vendors")} />;
      case "timeline": return <Timeline timeline={timeline} />;
      case "travel": return <Travel hotels={hotels} />;
      case "import": return <Import guests={guests} setGuests={setGuests} />;
      case "ai": return <AiPlanner guests={guests} tasks={tasks} budget={budget} vendors={vendors} />;
      case "comms": return <Comms />;
      case "settings": return <Settings user={user} role={role} onLogout={() => signOut(fbAuth)} />;
      default: return <Dashboard guests={guests} tasks={tasks} budget={budget} weddingDate={WEDDING_DATE} />;
    }
  };

  const activeNav = NAV_ITEMS.find(n => n.id === activeModule);
  const prevNav = history.length > 1 ? NAV_ITEMS.find(n => n.id === history[history.length - 2]) : null;

  return (
    <div
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: T.cream, minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {/* CLOSING SCREEN */}
      {showClosing && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: T.carbon,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 40, textAlign: "center"
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: T.rosso }} />
          <div style={{ fontSize: 48, marginBottom: 24 }}>🏁</div>
          <div style={{ fontSize: 13, color: T.mist, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, marginBottom: 16 }}>
            Bangkok Wedding · Wedding HQ
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: "0 0 16px", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
            Thank you for enjoying<br />
            <span style={{ color: T.rosso }}>this Kleinman</span> created app
          </h1>
          <p style={{ fontSize: 15, color: T.mist, lineHeight: 1.7, maxWidth: 300, margin: "0 0 40px" }}>
            Your wedding data is safe and ready when you return. See you in the paddock. 🌿
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setShowClosing(false)} style={{
              background: T.rosso, border: "none", borderRadius: 10,
              padding: "12px 28px", color: "#fff", fontSize: 15, fontWeight: 800,
              cursor: "pointer", letterSpacing: "0.01em"
            }}>Back to Wedding HQ</button>
          </div>
          <div style={{ position: "absolute", bottom: 24, fontSize: 11, color: T.asphalt, letterSpacing: "0.06em" }}>
            Wedding HQ v1.3.0 · A Kleinman Creation
          </div>
        </div>
      )}

      {/* SWIPE BACK — no visual overlay, gesture only */}

      {/* TOP BAR */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: T.carbon, borderBottom: `2px solid ${T.rosso}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 52
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", padding: 4
          }}>☰</button>

          {canGoBack ? (
            <button onClick={goBack} style={{
              background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7,
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              padding: "5px 12px", display: "flex", alignItems: "center", gap: 5
            }}>
              ‹ {prevNav ? prevNav.label : "Back"}
            </button>
          ) : (
            <button onClick={() => navigate("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
              <span style={{ color: T.rosso, fontWeight: 900, fontSize: 15, letterSpacing: "0.02em" }}>SIRA</span><span style={{ color: "#fff", fontWeight: 900, fontSize: 15, letterSpacing: "0.02em" }}>LEON</span><span style={{ color: "#2D6DB5", fontWeight: 900, fontSize: 15, letterSpacing: "0.02em" }}>WEDDING</span><span style={{ color: "#fff", fontWeight: 900, fontSize: 15, letterSpacing: "0.02em" }}>H</span><span style={{ color: "#C41230", fontWeight: 900, fontSize: 15, letterSpacing: "0.02em" }}>Q</span>
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canGoBack && (
            <button onClick={() => navigate("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
              <span style={{ color: T.rosso, fontWeight: 900, fontSize: 13, letterSpacing: "0.02em" }}>SIRA</span><span style={{ color: "#fff", fontWeight: 900, fontSize: 13, letterSpacing: "0.02em" }}>LEON</span><span style={{ color: "#2D6DB5", fontWeight: 900, fontSize: 13, letterSpacing: "0.02em" }}>WEDDING</span><span style={{ color: "#fff", fontWeight: 900, fontSize: 13, letterSpacing: "0.02em" }}>H</span><span style={{ color: "#C41230", fontWeight: 900, fontSize: 13, letterSpacing: "0.02em" }}>Q</span>
            </button>
          )}
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.success }} />
          <span style={{ color: T.mist, fontSize: 11 }}>v1.3.0</span>
          {role && <div style={{ background: ROLE_COLORS[role], color: "#fff", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 800, letterSpacing: "0.04em" }}>L{role}</div>}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, marginTop: 52 }}>
        {/* SIDEBAR */}
        <div style={{
          position: "fixed", top: 52, left: sidebarOpen ? 0 : -220, bottom: 0, width: 220,
          background: "#fff", borderRight: `1px solid ${T.linenDark}`,
          zIndex: 90, transition: "left 0.25s cubic-bezier(0.4,0,0.2,1)",
          overflowY: "auto", display: "flex", flexDirection: "column"
        }}>
          <div style={{ padding: "16px 12px 8px" }}>
            <div style={{ fontSize: 10, color: T.mist, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 8 }}>Navigation</div>
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => navigate(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: activeModule === item.id ? T.rossoLight : "transparent",
                  color: activeModule === item.id ? T.rosso : T.asphalt,
                  fontWeight: activeModule === item.id ? 800 : 500,
                  fontSize: 13, textAlign: "left", marginBottom: 2,
                  transition: "all 0.15s"
                }}>
                <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: "auto", padding: "12px 16px", borderTop: `1px solid ${T.linen}`, fontSize: 11, color: T.mist }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>SIRALEONWEDDINGHQ v1.3.0</div>
            <div>Production · 2026-06-14</div>
          </div>
        </div>

        {/* SIDEBAR OVERLAY */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{
            position: "fixed", inset: 0, zIndex: 89, background: "rgba(0,0,0,0.3)"
          }} />
        )}

        {/* MAIN CONTENT */}
        <main style={{
          flex: 1, padding: "24px 20px", maxWidth: 1100, margin: "0 auto",
          width: "100%", boxSizing: "border-box"
        }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 12, color: T.mist }}>
            <span style={{ color: T.rosso, fontWeight: 700 }}>Bangkok Wedding</span>
            <span>›</span>
            <span style={{ fontWeight: 600, color: T.carbon }}>{activeNav?.label}</span>
          </div>
          {renderModule()}
        </main>
      </div>

      {/* BOTTOM NAV — Mobile */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: T.white, borderTop: `1px solid ${T.linenDark}`,
        display: "flex", overflow: "hidden"
      }}>
        {NAV_ITEMS.slice(0, 5).map(item => (
          <button key={item.id} onClick={() => navigate(item.id)} style={{
            flex: 1, padding: "8px 4px 6px", border: "none", background: "none", cursor: "pointer",
            borderTop: activeModule === item.id ? `3px solid ${T.rosso}` : "3px solid transparent",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2
          }}>
            <span style={{ fontSize: 16, color: activeModule === item.id ? T.rosso : T.mist }}>{item.icon}</span>
            <span style={{ fontSize: 9, color: activeModule === item.id ? T.rosso : T.mist, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{item.label.split(" ")[0]}</span>
          </button>
        ))}
        <button onClick={() => setSidebarOpen(true)} style={{
          flex: 1, padding: "8px 4px 6px", border: "none", background: "none", cursor: "pointer",
          borderTop: "3px solid transparent",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2
        }}>
          <span style={{ fontSize: 16, color: T.mist }}>☰</span>
          <span style={{ fontSize: 9, color: T.mist, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>More</span>
        </button>
      </div>

      {/* FLOATING AI BUTTON */}
      {!aiPanelOpen && (
        <button
          onClick={() => setAiPanelOpen(true)}
          style={{
            position: "fixed", bottom: 72, right: 16, zIndex: 200,
            background: T.carbon, color: "#fff",
            border: `2px solid ${T.rosso}`,
            borderRadius: 28, padding: "10px 18px",
            fontSize: 13, fontWeight: 800, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            display: "flex", alignItems: "center", gap: 8,
            letterSpacing: "0.01em"
          }}>
          <span style={{ fontSize: 16 }}>✧</span>
          Artificial Idiot
        </button>
      )}

      {/* AI SLIDE-UP PANEL */}
      {aiPanelOpen && (
        <>
          {/* Backdrop */}
          <div onClick={() => setAiPanelOpen(false)} style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(0,0,0,0.45)"
          }} />

          {/* Panel */}
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301,
            background: T.white, borderRadius: "20px 20px 0 0",
            height: "88vh", display: "flex", flexDirection: "column",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.2)"
          }}>
            {/* Panel header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 20px", borderBottom: `1px solid ${T.linen}`, flexShrink: 0
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.carbon, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✧</div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15, color: T.carbon }}>Artificial Idiot</div>
                  <div style={{ fontSize: 11, color: T.mist }}>Wedding Planner AI · Bangkok Wedding</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => { setAiPanelOpen(false); navigate("ai"); }} style={{
                  background: T.linen, border: "none", borderRadius: 8, padding: "6px 12px",
                  fontSize: 12, fontWeight: 700, color: T.carbon, cursor: "pointer"
                }}>Open Full</button>
                <button onClick={() => setAiPanelOpen(false)} style={{
                  background: T.linen, border: "none", borderRadius: 8, padding: "6px 12px",
                  fontSize: 16, fontWeight: 700, color: T.carbon, cursor: "pointer"
                }}>✕</button>
              </div>
            </div>

            {/* Embedded mini AI — reuses context from app state */}
            <MiniAI
              guests={guests} tasks={tasks} budget={budget} vendors={vendors}
              setGuests={setGuests} setTasks={setTasks} setBudget={setBudget}
              onClose={() => setAiPanelOpen(false)}
              onOpenFull={() => { setAiPanelOpen(false); navigate("ai"); }}
            />
          </div>
        </>
      )}

      {/* FOOTER SPACER for bottom nav */}
      <div style={{ height: 56 }} />
    </div>
  );
}
