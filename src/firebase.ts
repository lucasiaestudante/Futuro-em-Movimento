import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB1_TonJurKptjMXdmGIRfB7SnQxNyNqXU",
  authDomain: "portal-faculdade.firebaseapp.com",
  projectId: "portal-faculdade",
  storageBucket: "portal-faculdade.firebasestorage.app",
  messagingSenderId: "1012108046238",
  appId: "1:1012108046238:web:0ade5941d60018a2ad708f",
  measurementId: "G-69JFX6LT64"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Expose to window as requested
(window as any).db = db;
(window as any).auth = auth;
(window as any).storage = storage;
