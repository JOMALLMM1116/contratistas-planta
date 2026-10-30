import { prisma } from '../shared/db.js';
import { env } from '../shared/config/env.js';
import { hashPassword } from '../shared/seguridad/password.js';

// Empresa contratista de demostracion (para los usuarios externos)
const EMPRESA_DEMO = {
  nit: '1234567-8',
  razon_social: 'Servicios Industriales Demo, S.A.',
  nombre_contacto: 'Contacto Demo',
  email_contacto: 'contacto@empresa.test',
  telefono: '7951-0000',
};

// Un usuario por cada rol de la semilla de la base
const USUARIOS_DEMO = [
  { email: 'admin@planta.test', nombre: 'Administrador Demo', rol: 'admin', externo: false },
  { email: 'seguridad@planta.test', nombre: 'Seguridad Industrial Demo', rol: 'seguridad_industrial', externo: false },
  { email: 'responsable@planta.test', nombre: 'Responsable Interno Demo', rol: 'responsable_interno', externo: false },
  { email: 'garita@planta.test', nombre: 'Garita Demo', rol: 'garita', externo: false },
  { email: 'supervisor@empresa.test', nombre: 'Supervisor de Campo Demo', rol: 'supervisor_campo', externo: true },
  { email: 'contratista@empresa.test', nombre: 'Carlos Demo Contratista', rol: 'contratista', externo: true },
];

async function main() {
  if (!env.DEMO_PASSWORD) {
    throw new Error('Falta DEMO_PASSWORD en el .env');
  }

  const passwordHash = await hashPassword(env.DEMO_PASSWORD);

  const roles = await prisma.roles.findMany();
  const rolPorCodigo = new Map(roles.map((r) => [r.codigo, r.id]));

  const empresa = await prisma.empresas_contratistas.upsert({
    where: { nit: EMPRESA_DEMO.nit },
    update: {},
    create: EMPRESA_DEMO,
  });

  for (const u of USUARIOS_DEMO) {
    const rolId = rolPorCodigo.get(u.rol);
    if (!rolId) throw new Error(`No existe el rol ${u.rol} en la base`);

    await prisma.usuarios.upsert({
      where: { email: u.email },
      // Si ya existe, se restablece la contrasena y se desbloquea
      update: { password_hash: passwordHash, rol_id: rolId, activo: true, intentos_fallidos: 0, bloqueado_hasta: null },
      create: {
        email: u.email,
        password_hash: passwordHash,
        nombre_completo: u.nombre,
        rol_id: rolId,
        empresa_id: u.externo ? empresa.id : null,
      },
    });
    console.log(`  ✔ ${u.rol.padEnd(22)} ${u.email}`);
  }

  // El usuario contratista se vincula con su ficha de contratista (la usa la PWA)
  const usuarioContratista = await prisma.usuarios.findUniqueOrThrow({
    where: { email: 'contratista@empresa.test' },
  });

  await prisma.contratistas.upsert({
    where: { documento_identidad: '1234567890101' },
    update: { usuario_id: usuarioContratista.id },
    create: {
      empresa_id: empresa.id,
      usuario_id: usuarioContratista.id,
      documento_identidad: '1234567890101',
      nombres: 'Carlos',
      apellidos: 'Demo Contratista',
      email: 'contratista@empresa.test',
      cargo: 'Tecnico electricista',
    },
  });

  console.log('Datos de demostracion listos.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
