import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// These are safe to be public as Firebase security is handled by Security Rules
const firebaseConfig = {
  apiKey: "AIzaSyAffFR66goUx51PBnpOb5VebVyp5qO907A",
  authDomain: "capstone-project-220-real-time.firebaseapp.com",
  projectId: "capstone-project-220-real-time",
  storageBucket: "capstone-project-220-real-time.firebasestorage.app",
  messagingSenderId: "585922420311",
  appId: "1:585922420311:web:59f30356aec0178088cd12",
  measurementId: "G-WG5SDEG9ER"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
