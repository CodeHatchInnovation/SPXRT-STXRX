import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
// CORREGIDO: Ahora importa desde el CDN oficial de la base de datos de Firebase
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"; 

const firebaseConfig = {
    apiKey: "AIzaSyBgoDcmxdIYRqo5gup302xLWaKO3AHsC5Y",
    authDomain: "e-commerce-2ff74.firebaseapp.com",
    databaseURL: "https://e-commerce-2ff74-default-rtdb.firebaseio.com",
    projectId: "e-commerce-2ff74",
    storageBucket: "e-commerce-2ff74.firebasestorage.app",
    messagingSenderId: "1079041764789",
    appId: "1:1079041764789:web:63cc75dfd3e5a4e9d4bdfc",
    measurementId: "G-0BLDR9NWTK"
};

// 1. Inicializas la App
const app = initializeApp(firebaseConfig);

// 2. Inicializas la base de datos y LA EXPORTAS como 'db'
export const db = getDatabase(app); 

// 3. CORREGIDO: Exporta las funciones correctas desde el CDN de la base de datos
export { ref, push, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
