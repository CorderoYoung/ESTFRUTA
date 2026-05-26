import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBByH2jMZOBJK0I_K0ekw5Tph0ud_jijyQ",
  authDomain: "estfruta.firebaseapp.com",
  projectId: "estfruta",
  storageBucket: "estfruta.appspot.com",
  messagingSenderId: "1058802421234",
  appId: "1:1058802421234:web:a1b2c3d4e5f6g7h8i9j0k1"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);