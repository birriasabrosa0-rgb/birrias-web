import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBEmwTzhLohBLGAh72zFv3ei3IeQ14EmVk",
    authDomain: "birrias.firebaseapp.com",
    projectId: "birrias",
    storageBucket: "birrias.firebasestorage.app",
    messagingSenderId: "730620829071",
    appId: "1:730620829071:web:e7aec585f68e49f5f9bffa",
    measurementId: "G-49K10FZ035"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Exponer globalmente para la consola y otros scripts
window.auth = auth;
window.db = db;