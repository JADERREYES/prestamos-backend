const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testAPI() {
  console.log('🔍 Probando API...\n');

  try {
    // 1. Probar login de admin
    console.log('1. Probando login admin...');
    const loginRes = await axios.post(`${API_URL}/auth/admin/login`, {
      email: 'admin@popayan2_1q4i.com',
      password: 'Admin123!'
    });
    
    const token = loginRes.data.token;
    const tenantId = loginRes.data.user.tenantId;
    console.log('   ✅ Login exitoso');
    console.log(`   Token: ${token.substring(0, 50)}...`);
    console.log(`   TenantId: ${tenantId}\n`);

    // 2. Probar obtener clientes
    console.log('2. Probando obtener clientes...');
    const clientesRes = await axios.get(`${API_URL}/clientes`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId
      }
    });
    console.log(`   ✅ Clientes encontrados: ${clientesRes.data.length}\n`);

    // 3. Probar crear cliente
    console.log('3. Probando crear cliente...');
    const nuevoCliente = await axios.post(`${API_URL}/clientes`, {
      nombre: 'Cliente Test API',
      cedula: '111222333',
      telefono: '3001112223',
      direccion: 'Calle Test 123'
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId
      }
    });
    console.log(`   ✅ Cliente creado: ${nuevoCliente.data.nombre}\n`);

    // 4. Probar obtener cobradores
    console.log('4. Probando obtener cobradores...');
    const cobradoresRes = await axios.get(`${API_URL}/cobradores`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId
      }
    });
    console.log(`   ✅ Cobradores encontrados: ${cobradoresRes.data.length}\n`);

    // 5. Probar obtener préstamos
    console.log('5. Probando obtener préstamos...');
    const prestamosRes = await axios.get(`${API_URL}/prestamos`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId
      }
    });
    console.log(`   ✅ Préstamos encontrados: ${prestamosRes.data.length}\n`);

    // 6. Probar dashboard
    console.log('6. Probando dashboard...');
    const dashboardRes = await axios.get(`${API_URL}/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId
      }
    });
    console.log(`   ✅ Dashboard stats: Cartera Total: $${dashboardRes.data.stats?.totalCartera?.toLocaleString()}\n`);

    console.log('🎉 Todas las pruebas pasaron exitosamente!');

  } catch (error) {
    console.error('❌ Error en prueba:', error.response?.data || error.message);
  }
}

testAPI();