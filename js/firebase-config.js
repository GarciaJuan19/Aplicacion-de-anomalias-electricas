import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

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

let messaging = null;
isSupported().then((soportado) => {
    if (soportado) {
        messaging = getMessaging(app);
    } else {
        console.warn('⚠️ Firebase Messaging no es compatible con este navegador.');
    }
}).catch((error) => {
    console.warn('⚠️ Error al verificar soporte de Messaging:', error);
});

export {
    auth,
    db,
    storage,
    messaging,
    getToken,
    onMessage
};