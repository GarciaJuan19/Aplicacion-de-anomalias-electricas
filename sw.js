self.addEventListener('fetch', (event) => {
    // Esto cumple con el requisito mínimo de conectividad
    event.respondWith(fetch(event.request));
});