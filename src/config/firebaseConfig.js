// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { FIREBASE_CONFIG } from "./env";

// Firebase web app config, set through the VITE_FIREBASE_* values in .env.
// These are public client identifiers, not secrets: never put a service
// account or private key here.
const app = initializeApp(FIREBASE_CONFIG);

// Firestore DB
export const db = getFirestore(app);
