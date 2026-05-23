// =====================================================================
// Cloud wrapper around Firebase Auth + Firestore.
//
// Designed for graceful fallback: while config.js still has its template
// "YOUR_..." values, isCloudEnabled() returns false and the rest of the
// app continues to work in local-only mode (no auth, no leaderboard).
// =====================================================================

import { initializeApp } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
  GoogleAuthProvider, signInWithPopup,
} from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, collection,
  query, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { firebaseConfig } from './config';

let _enabled = false;
let _app = null;
let _auth = null;
let _db = null;

function looksLikePlaceholder(cfg) {
  if (!cfg) return true;
  for (const v of Object.values(cfg)) {
    if (typeof v !== 'string') return true;
    if (v.startsWith('YOUR_') || v.includes('YOUR_PROJECT')) return true;
  }
  return false;
}

try {
  if (!looksLikePlaceholder(firebaseConfig)) {
    _app = initializeApp(firebaseConfig);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
    _enabled = true;
  }
} catch (e) {
  // Log but never throw — cloud is optional.
  // eslint-disable-next-line no-console
  console.warn('Firebase initialization failed:', e?.message || e);
  _enabled = false;
}

export function isCloudEnabled() {
  return _enabled;
}

// ===== Auth =====

export async function registerUser({ email, password, username }) {
  if (!_enabled) throw new Error('Cloud not configured');
  const cred = await createUserWithEmailAndPassword(_auth, email, password);
  await updateProfile(cred.user, { displayName: username });
  // Seed an empty score document so leaderboard queries can find the user.
  await setDoc(doc(_db, 'scores', cred.user.uid), {
    uid: cred.user.uid,
    username,
    email,
    totalScore: 0,
    medals: {},
    achievements: [],
    bestTimes: {},
    bestDeaths: {},
    totalRuns: 0,
    totalCompletes: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return cred.user;
}

export async function signInUser({ email, password }) {
  if (!_enabled) throw new Error('Cloud not configured');
  const cred = await signInWithEmailAndPassword(_auth, email, password);
  await ensureScoreDoc(cred.user);
  return cred.user;
}

export async function signInWithGoogle() {
  if (!_enabled) throw new Error('Cloud not configured');
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(_auth, provider);
  await ensureScoreDoc(cred.user);
  return cred.user;
}

// If the user has signed in but doesn't have a scores doc yet (e.g. first
// Google sign-in, or doc was deleted), seed one. Safe to call on every sign-in.
async function ensureScoreDoc(user) {
  if (!user) return;
  try {
    const ref = doc(_db, 'scores', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    const username = user.displayName || user.email?.split('@')[0] || 'anon';
    await setDoc(ref, {
      uid: user.uid,
      username,
      email: user.email || '',
      totalScore: 0,
      medals: {},
      medalCounts: { gold: 0, silver: 0, bronze: 0 },
      achievements: [],
      bestTimes: {},
      bestDeaths: {},
      totalRuns: 0,
      totalCompletes: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('ensureScoreDoc failed:', e?.message || e);
  }
}

export async function signOutUser() {
  if (!_enabled) return;
  return signOut(_auth);
}

export function subscribeToAuth(callback) {
  if (!_enabled) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(_auth, callback);
}

export function getCurrentUser() {
  if (!_enabled) return null;
  return _auth.currentUser;
}

// ===== Scores / leaderboard =====

export async function fetchMyScore(uid) {
  if (!_enabled || !uid) return null;
  const ref = doc(_db, 'scores', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Submit a score update for the signed-in user. We do a full merge of the
// "best so far" snapshot rather than tracking each run — keeps the document
// small and writes simple.
export async function submitScore({ uid, username, scoreData }) {
  if (!_enabled || !uid) return;
  const ref = doc(_db, 'scores', uid);
  await setDoc(ref, {
    uid,
    username,
    ...scoreData,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function fetchLeaderboard(maxRows = 50) {
  if (!_enabled) return [];
  const q = query(
    collection(_db, 'scores'),
    orderBy('totalScore', 'desc'),
    limit(maxRows),
  );
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach(s => rows.push(s.data()));
  return rows;
}
