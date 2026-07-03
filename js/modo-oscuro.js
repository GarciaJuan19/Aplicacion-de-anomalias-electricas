// Localizar el botón en el HTML
const botonModoOscuro = document.getElementById('btn-dark-mode');

// 1. Al cargar la página, comprueba si el usuario ya lo había activado antes
const temaGuardado = localStorage.getItem('theme');
console.log('Tema cargado desde localStorage:', temaGuardado);

if (temaGuardado === 'dark') {
  document.body.classList.add('dark-mode');
  console.log('Modo oscuro aplicado automáticamente al cargar la página.');
}

// 2. Escuchar el click del botón para alternar el modo oscuro
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