// 1. Al cargar la página, comprueba si el usuario ya lo había activado antes
const temaGuardado = localStorage.getItem('theme');
console.log('Tema cargado desde localStorage:', temaGuardado);

if (temaGuardado === 'dark') {
    document.body.classList.add('dark-mode');
    console.log('Modo oscuro aplicado automáticamente al cargar la página.');
}

// Localizar el botón en el HTML (puede ser 'btn-dark-mode' o 'btn-tema')
// Usamos el operador lógico || por si acaso en tu HTML se llama de una forma u otra
const botonModoOscuro = document.getElementById('btn-dark-mode') || document.getElementById('btn-tema');

// 2. 🛡️ Condicional de seguridad: Solo añadir el listener si el botón existe en la página actual
if (botonModoOscuro) {
    botonModoOscuro.addEventListener('click', () => {
        console.log('¡Se hizo clic en el botón de cambio de modo!');
        
        // Alterna la clase en el body
        document.body.classList.toggle('dark-mode');
        
        // Guardar la preferencia en el almacenamiento local del navegador
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