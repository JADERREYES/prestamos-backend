const { nanoid } = require("nanoid");

// ===== TUS FUNCIONES ORIGINALES (sin modificar) =====
function generarPasswordOriginal() {
  return nanoid(8);
}

function generarTenantOriginal(nombre) {
  return nombre
    .toLowerCase()
    .replace(/\s/g, "_") + "_" + nanoid(4);
}

// ===== NUEVAS FUNCIONES AGREGADAS (sin modificar las originales) =====

/**
 * Genera un código único para la empresa (¡ESTA ES LA QUE FALTA!)
 * Formato: EMP-XXXXXX (ej: EMP-ABC123)
 */
function generarCodigoEmpresa() {
  const prefijo = 'EMP';
  const codigo = nanoid(6).toUpperCase();
  return `${prefijo}-${codigo}`;
}

/**
 * Genera un código de empresa con prefijo personalizable
 * @param {string} prefijo - Prefijo para el código (default: 'EMP')
 */
function generarCodigoEmpresaConPrefijo(prefijo = 'EMP') {
  return `${prefijo}-${nanoid(6).toUpperCase()}`;
}

/**
 * Genera un código de empresa numérico (ej: EMP-000001)
 * @param {number} contador - Número para formatear
 */
function generarCodigoEmpresaNumerico(contador) {
  const numero = String(contador).padStart(6, '0');
  return `EMP-${numero}`;
}

/**
 * Genera un código de empresa basado en el nombre
 * @param {string} nombre - Nombre de la empresa
 */
function generarCodigoEmpresaPorNombre(nombre) {
  const prefijo = nombre
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .substring(0, 3);
  return `${prefijo}-${nanoid(4).toUpperCase()}`;
}

/**
 * Genera email para admin basado en tenantId
 * @param {string} tenantId - ID del tenant
 */
function generarEmailAdmin(tenantId) {
  return `admin@${tenantId}.com`;
}

/**
 * Genera email para cobrador basado en tenantId
 * @param {string} tenantId - ID del tenant
 */
function generarEmailCobrador(tenantId) {
  return `cobrador@${tenantId}.com`;
}

/**
 * Genera un tenant ID más elaborado con timestamp
 * Útil para cuando necesitas IDs más largos y únicos
 */
function generarTenantLargo(nombre) {
  return nombre
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Eliminar caracteres especiales
    .substring(0, 15) + '-' + Date.now().toString(36);
}

/**
 * Genera una contraseña más segura con caracteres especiales
 * @param {number} longitud - Longitud de la contraseña (default: 10)
 */
function generarPasswordSegura(longitud = 10) {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < longitud; i++) {
    password += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return password;
}

/**
 * Genera un tenant ID con formato específico para email
 * Ejemplo: "mi_oficina_abc1" -> "mi.oficina@dominio.com"
 */
function generarTenantParaEmail(nombre) {
  return nombre
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10) + '.' + nanoid(4);
}

/**
 * Genera una contraseña legible para humanos (sin caracteres ambiguos)
 * Evita caracteres como 1,l,I,0,O, etc.
 */
function generarPasswordLegible(longitud = 8) {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < longitud; i++) {
    password += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return password;
}

/**
 * Genera un tenant ID usando solo nanoid (sin el nombre)
 */
function generarTenantRandom() {
  return 'tenant_' + nanoid(10);
}

/**
 * Versión mejorada de generarPassword que usa nanoid pero con más caracteres
 */
function generarPasswordNanoid(longitud = 10) {
  return nanoid(longitud);
}

// ===== EXPORTAMOS TODO =====
module.exports = {
  // Tus funciones originales (sin modificar)
  generarPassword: generarPasswordOriginal,
  generarTenant: generarTenantOriginal,
  
  // Funciones para códigos de empresa (NUEVAS)
  generarCodigoEmpresa,                 // <--- ESTA ES LA QUE FALTA
  generarCodigoEmpresaConPrefijo,
  generarCodigoEmpresaNumerico,
  generarCodigoEmpresaPorNombre,
  
  // Funciones para emails
  generarEmailAdmin,
  generarEmailCobrador,
  
  // Nuevas funciones (agregadas anteriormente)
  generarPasswordSegura,
  generarPasswordLegible,
  generarPasswordNanoid,
  generarTenantLargo,
  generarTenantParaEmail,
  generarTenantRandom,
  
  // También exportamos nanoid directamente por si lo necesitas
  nanoid
};