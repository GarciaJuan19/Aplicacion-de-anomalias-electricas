// Al cargar la página, comprueba si el usuario ya lo había activado antes
const temaGuardado = localStorage.getItem('theme');
console.log('Tema cargado desde localStorage:', temaGuardado);

if (temaGuardado === 'dark') {
    document.body.classList.add('dark-mode');
    console.log('Modo oscuro aplicado automáticamente al cargar la página.');
}
const botonModoOscuro = document.getElementById('btn-dark-mode') || document.getElementById('btn-tema');

if (botonModoOscuro) {
    botonModoOscuro.addEventListener('click', () => {
        console.log('¡Se hizo clic en el botón de cambio de modo!');

        document.body.classList.toggle('dark-mode');

        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            console.log('Modo oscuro ACTIVADO. Guardado en localStorage.');
        } else {
            localStorage.setItem('theme', 'light');
            console.log('Modo oscuro DESACTIVADO (Modo Claro). Guardado en localStorage.');
        }
    });
} else {
    console.log('ℹ️ No se detectó botón de modo oscuro en esta página. Listener omitido de forma segura.');
}