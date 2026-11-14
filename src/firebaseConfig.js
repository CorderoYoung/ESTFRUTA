// src/firebaseConfig.js
//
// 2026-11-14 — OJO: tres valores de este objeto estaban inventados y se
// corrigieron contra la consola de Firebase (Configuracion del proyecto ->
// Tus apps -> estfruta-web). Lo que estaba mal:
//   storageBucket      estfruta.appspot.com          -> estfruta.firebasestorage.app
//   messagingSenderId  1058802421234                 -> 629680311053
//   appId              ...web:a1b2c3d4e5f6g7h8i9j0k1 -> ...web:095a9817159b5b5e8afe44
// La apiKey, el authDomain y el projectId si eran correctos, por eso Firestore
// funcionaba: no usa los otros tres. Nada en src/ usa Storage ni Analytics.
// No volver a escribir estos valores de memoria ni copiarlos de una plantilla:
// se copian de la consola.
//
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBByH2jMZOBJK0I_K0ekw5Tph0ud_jijyQ",
  authDomain: "estfruta.firebaseapp.com",
  projectId: "estfruta",
  storageBucket: "estfruta.firebasestorage.app",
  messagingSenderId: "629680311053",
  appId: "1:629680311053:web:095a9817159b5b5e8afe44",
  measurementId: "G-S6VLL9884X"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// 2026-11-14 (Fase 3 del plan multiempresa): Firebase Authentication quedo
// habilitado con el proveedor Email/Password. Este export es lo unico que
// hacia falta del lado del codigo; todavia nadie lo usa.
export const auth = getAuth(app);