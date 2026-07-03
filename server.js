// server.js
const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Servir la raíz del proyecto para que los HTML, JS y CSS sean públicos
app.use(express.static(__dirname));

// REEMPLAZA CON LAS LLAVES QUE GENERASTE EN TU TERMINAL
const publicVapidKey = 'BFKV1nkeE2T0dUsiwi1a9HCK9CNxJC8Et3v5r9_qdhDo1hGp_WinzJe-KZZU3buOt3nBzvt2nPJyfx9O-EfoRP8';
const privateVapidKey = '0uuBFuNHHcguD22BLONZdcXEJV1rdDNDObT-7e3NkdQ';

webpush.setVapidDetails(
  'mailto:soporte@anomaliaselectricas.com',
  publicVapidKey,
  privateVapidKey
);

// Array temporal en memoria para almacenar las suscripciones de los usuarios
let subscripcionesGlobales = [];

// 1. Ruta para registrar un nuevo dispositivo / usuario
app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  
  if (!subscripcionesGlobales.some(sub => sub.endpoint === subscription.endpoint)) {
    subscripcionesGlobales.push(subscription);
  }
  
  res.status(201).json({ status: 'success', message: 'Dispositivo registrado.' });
});

// 2. Ruta que se llamará automáticamente cuando cambie el estado de un reporte
app.post('/api/reporte/cambiar-estado', async (req, res) => {
  const { idReporte, ubicacion, nuevoEstado } = req.body;

  // Estructura del mensaje de notificación push
  const payload = JSON.stringify({
    title: `⚡ Estado de Anomalía Cambiado`,
    body: `El reporte #${idReporte} en "${ubicacion}" pasó al estado: ${nuevoEstado.toUpperCase()}.`,
    url: `/mis-reportes.html?id=${idReporte}` // Redirige al usuario a su sección de reportes
  });

  // Enviar en paralelo la notificación a todos los usuarios
  const promesasEnvio = subscripcionesGlobales.map(sub => {
    return webpush.sendNotification(sub, payload).catch(err => {
      // Limpieza: si un usuario bloqueó los permisos o expiró el token, remover de la lista
      if (err.statusCode === 410 || err.statusCode === 404) {
        subscripcionesGlobales = subscripcionesGlobales.filter(s => s.endpoint !== sub.endpoint);
      }
    });
  });

  await Promise.all(promesasEnvio);
  res.json({ success: true, totalNotificados: subscripcionesGlobales.length });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Servidor PWA escuchando en http://localhost:${PORT}`));