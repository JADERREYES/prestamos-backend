// diagnostico-rutas.js
const fs = require('fs');
const path = require('path');

console.log('🔍 DIAGNÓSTICO DE RUTAS');
console.log('=======================');

const routesDir = path.join(__dirname, 'src', 'routes');
const files = fs.readdirSync(routesDir);

console.log(`📁 Archivos encontrados en /src/routes: ${files.length}\n`);

files.forEach(file => {
  try {
    const routePath = path.join(routesDir, file);
    const route = require(routePath);
    
    console.log(`📄 ${file}:`);
    console.log(`   - Tipo: ${typeof route}`);
    console.log(`   - Es función? ${typeof route === 'function'}`);
    console.log(`   - Tiene router? ${route?.stack ? '✅ Sí' : '❌ No'}`);
    
    if (!route || typeof route !== 'function') {
      console.log(`   ⚠️  PROBLEMA: ${file} no exporta un router válido`);
      
      // Leer el contenido del archivo para ver si falta module.exports
      const content = fs.readFileSync(routePath, 'utf8');
      if (!content.includes('module.exports')) {
        console.log(`   ❌ ERROR CRÍTICO: Falta 'module.exports' en ${file}`);
      }
    }
    console.log('');
  } catch (error) {
    console.log(`📄 ${file}: ❌ ERROR AL CARGAR - ${error.message}`);
  }
});