// firebase-config.js - VERSIÓN ACTUALIZADA
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "AIzaSyAoIzxoN8nYfw9p9XPZCbT_wgUQ0cYunjE",
    authDomain: "fallocero-52d1d.firebaseapp.com",
    projectId: "fallocero-52d1d",
    storageBucket: "fallocero-52d1d.firebasestorage.app",
    messagingSenderId: "931258010793",
    appId: "1:931258010793:web:ff2686911fb9edca4f6db8"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const messaging = getMessaging(app);

export {
    auth,
    db,
    storage,
    messaging,
    getToken,
    onMessage
};