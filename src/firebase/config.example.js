// =====================================================================
// FIREBASE CONFIG TEMPLATE
//
// Copy this file to `src/firebase/config.js` and paste your project's
// values in. (config.js is gitignored — it's safe to put real keys there.)
//
// To get these values:
// 1. Go to https://console.firebase.google.com/ and create a project.
// 2. Add a Web app (the </> icon) — Firebase will show you a config object.
// 3. In the project: enable Authentication → Sign-in method → Email/Password.
// 4. Create a Firestore Database (start in Test mode for now; lock down
//    rules later — example rules are in the README at the bottom of this
//    file).
// 5. Paste the firebaseConfig values below.
//
// While `config.js` is missing or has placeholder values, the game runs
// in LOCAL-ONLY mode (no register, no leaderboard) so dev still works.
// =====================================================================

export const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

// ===== Suggested Firestore security rules =====
//
// Open the Firebase Console → Firestore Database → Rules and paste:
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     // Anyone can read scores (for the leaderboard).
//     // Only the owner can write to their own score document.
//     match /scores/{uid} {
//       allow read: if true;
//       allow write: if request.auth != null && request.auth.uid == uid;
//     }
//   }
// }
