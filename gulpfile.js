const { src, dest, watch, series } = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const fs = require('fs');
const path = require('path');

// Compilar SCSS
function compileSass() {

    const inputFile = './scss/main.scss';
    const outputFolder = './css';

    // Crear la carpeta css si no existe
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
        console.log('✔ Carpeta css creada.');
    }

    // Verificar que exista main.scss
    if (!fs.existsSync(path.resolve(inputFile))) {
        console.error('❌ No se encontró el archivo: scss/main.scss');
        return Promise.resolve();
    }

    console.log('🔄 Compilando SCSS...');

    return src(inputFile, { allowEmpty: false })
        .pipe(sourcemaps.init())
        .pipe(
            sass({
                outputStyle: 'expanded'
            }).on('error', function (err) {
                console.error('\n❌ Error de Sass:\n');
                console.error(err.formatted || err.message);
                this.emit('end');
            })
        )
        .pipe(rename('style.css'))
        .pipe(sourcemaps.write('.'))
        .pipe(dest(outputFolder));
}

// Observar cambios
function watchFiles() {

    console.log('👀 Observando cambios en SCSS...');

    watch('./scss/**/*.scss', compileSass)
        .on('change', function (file) {
            console.log(`📄 Modificado: ${file}`);
        });
}

// Build
const build = series(compileSass);

// Exportaciones
exports.compileSass = compileSass;
exports.build = build;
exports.watch = watchFiles;
exports.default = series(compileSass, watchFiles);