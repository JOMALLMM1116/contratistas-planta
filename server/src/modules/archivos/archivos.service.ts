import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { paginar } from '../../shared/http/paginacion.js';
import type { Alcance } from '../../shared/seguridad/alcance.js';
import type { ListarArchivos } from './archivos.schemas.js';
import { UPLOADS_DIR } from './archivos.storage.js';

// Alcance por defecto para llamadas internas entre modulos (el controlador siempre pasa el de la sesion)
const INTERNO: Alcance = { tipo: 'interno' };

// BigInt no se serializa a JSON y storage_key es un detalle interno
function serializar<T extends { tamano_bytes: bigint; storage_key: string }>(archivo: T) {
  const { storage_key, tamano_bytes, ...resto } = archivo;
  return { ...resto, tamano_bytes: Number(tamano_bytes) };
}

// ---- Autorizacion por objeto (SEG-01) ----
// Un archivo no tiene dueno directo: pertenece a quien lo subio y a los registros que lo usan
// (documentos, capacitaciones, evidencias de trabajo). Las evidencias de incidentes solo las ve
// el personal interno o quien las subio.
function filtroAlcance(alcance: Alcance, usuarioId: string | null): Prisma.archivosWhereInput {
  const propios: Prisma.archivosWhereInput[] = usuarioId ? [{ subido_por: usuarioId }] : [];

  switch (alcance.tipo) {
    case 'interno':
      return {};
    case 'contratista': {
      const c = alcance.contratistaId;
      return {
        OR: [
          ...propios,
          { documentos: { some: { contratista_id: c } } },
          { contratista_capacitaciones: { some: { contratista_id: c } } },
          {
            evidencias_trabajo: {
              some: { permisos_trabajo: { solicitudes_acceso: { solicitud_contratistas: { some: { contratista_id: c } } } } },
            },
          },
        ],
      };
    }
    case 'empresa': {
      const e = alcance.empresaId;
      return {
        OR: [
          ...propios,
          {
            documentos: {
              some: { OR: [{ empresa_id: e }, { contratistas: { empresa_id: e } }, { equipos: { empresa_id: e } }] },
            },
          },
          { contratista_capacitaciones: { some: { contratistas: { empresa_id: e } } } },
          { evidencias_trabajo: { some: { permisos_trabajo: { solicitudes_acceso: { empresa_id: e } } } } },
        ],
      };
    }
    default:
      // Falla cerrado: ningun archivo
      return { id: { in: [] } };
  }
}

async function leerCabecera(ruta: string) {
  const manejador = await fs.open(ruta, 'r');
  try {
    const buffer = Buffer.alloc(8);
    await manejador.read(buffer, 0, 8, 0);
    return buffer;
  } finally {
    await manejador.close();
  }
}

// Firma real del archivo: el tipo MIME que declara el cliente se puede falsificar
function coincideFirma(mime: string, b: Buffer) {
  switch (mime) {
    case 'application/pdf':
      return b.subarray(0, 4).toString('latin1') === '%PDF';
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return b.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    default:
      return false;
  }
}

function calcularSha256(ruta: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(ruta)
      .on('data', (trozo) => hash.update(trozo))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

function rutaEnDisco(storageKey: string) {
  return path.join(UPLOADS_DIR, path.basename(storageKey));
}

// Si el archivo existe pero no esta en el alcance, responde igual que si no existiera
async function buscar(id: string, alcance: Alcance = INTERNO, usuarioId: string | null = null) {
  const archivo = await prisma.archivos.findFirst({ where: { AND: [{ id }, filtroAlcance(alcance, usuarioId)] } });
  if (!archivo) throw new AppError(404, 'ARCHIVO_NO_ENCONTRADO', `No existe el archivo ${id}`);
  return archivo;
}

export async function listar(filtros: ListarArchivos, alcance: Alcance = INTERNO, usuarioId: string | null = null) {
  const where: Prisma.archivosWhereInput = {};

  if (filtros.buscar) where.nombre_original = { contains: filtros.buscar, mode: 'insensitive' };
  if (filtros.mime_type) where.mime_type = filtros.mime_type;

  const condicion: Prisma.archivosWhereInput = { AND: [where, filtroAlcance(alcance, usuarioId)] };
  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.archivosOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.archivos.count({ where: condicion }),
    prisma.archivos.findMany({ where: condicion, orderBy, ...paginar(filtros) }),
  ]);

  return { datos: datos.map((a) => serializar(a)), total };
}

export async function obtener(id: string, alcance: Alcance = INTERNO, usuarioId: string | null = null) {
  return serializar(await buscar(id, alcance, usuarioId));
}

// Multer ya guardo el archivo en disco: aqui se verifica y se registra en la base
export async function registrar(archivo: Express.Multer.File, subidoPor: string) {
  try {
    const cabecera = await leerCabecera(archivo.path);
    if (!coincideFirma(archivo.mimetype, cabecera)) {
      throw new AppError(415, 'CONTENIDO_NO_COINCIDE', 'El contenido del archivo no corresponde a su tipo');
    }

    const sha256 = await calcularSha256(archivo.path);

    // Multer entrega el nombre original como latin1: se recupera el UTF-8 (acentos, enes)
    const nombreOriginal = Buffer.from(archivo.originalname, 'latin1').toString('utf8').slice(0, 255);

    const creado = await prisma.archivos.create({
      data: {
        nombre_original: nombreOriginal,
        mime_type: archivo.mimetype,
        tamano_bytes: BigInt(archivo.size),
        storage_key: archivo.filename,
        sha256,
        subido_por: subidoPor,
      },
    });
    return serializar(creado);
  } catch (err) {
    // Si algo falla no debe quedar un archivo huerfano en disco
    await fs.rm(archivo.path, { force: true });
    throw err;
  }
}

export async function datosDescarga(id: string, alcance: Alcance = INTERNO, usuarioId: string | null = null) {
  const archivo = await buscar(id, alcance, usuarioId);
  const ruta = rutaEnDisco(archivo.storage_key);

  try {
    await fs.access(ruta);
  } catch {
    throw new AppError(404, 'ARCHIVO_FALTANTE_EN_DISCO', 'El archivo no esta en el almacenamiento');
  }

  return { ruta, nombre: archivo.nombre_original };
}

// Borrado real: si un documento o evidencia lo usa, la FK responde 409
export async function eliminar(id: string, alcance: Alcance = INTERNO, usuarioId: string | null = null) {
  const archivo = await buscar(id, alcance, usuarioId);
  await prisma.archivos.delete({ where: { id } });
  await fs.rm(rutaEnDisco(archivo.storage_key), { force: true });
  return serializar(archivo);
}
