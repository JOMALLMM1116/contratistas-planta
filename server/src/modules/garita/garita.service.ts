import type { Request } from 'express';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { paginar } from '../../shared/http/paginacion.js';
import { evaluarCredencial, type Evaluacion } from '../credenciales/credenciales.validacion.js';
import type { Movimientos, Salida, Validar } from './garita.schemas.js';

// Respuesta para la pantalla de garita: resultado, motivo y a quien corresponde
function respuesta(e: Evaluacion) {
  return {
    resultado: e.resultado,
    permitido: e.resultado === 'valido',
    motivo: e.motivo,
    zona: { id: e.zona.id, codigo: e.zona.codigo, nombre: e.zona.nombre },
    credencial: e.credencial
      ? {
          id: e.credencial.id,
          codigo_corto: e.credencial.codigo_corto,
          estado: e.credencial.estado,
          expira_en: e.credencial.expira_en,
          usos_maximos: e.credencial.usos_maximos,
          usos_actuales: e.credencial.usos_actuales,
        }
      : null,
    contratista: e.contratista,
    empresa: e.empresa,
    solicitud: e.solicitud,
  };
}

// Bitacora de cada validacion, sea cual sea el resultado
async function registrarValidacion(e: Evaluacion, req: Request) {
  await prisma.validaciones_credencial.create({
    data: {
      credencial_id: e.credencial?.id ?? null,
      resultado: e.resultado,
      motivo: e.motivo,
      zona_id: e.zona.id,
      validado_por: req.usuario!.id,
      ip: req.ip ?? null,
    },
  });
}

export async function validar(datos: Validar, req: Request) {
  const evaluacion = await evaluarCredencial(datos);
  await registrarValidacion(evaluacion, req);
  return respuesta(evaluacion);
}

export async function entrada(datos: Validar, req: Request) {
  let evaluacion = await evaluarCredencial(datos);

  if (evaluacion.resultado !== 'valido' || !evaluacion.credencial) {
    await registrarValidacion(evaluacion, req);
    return { registrado: false, ...respuesta(evaluacion) };
  }

  const credencial = evaluacion.credencial;

  // No se registra una segunda entrada sin haber registrado la salida
  const ultimo = await prisma.registros_acceso.findFirst({
    where: { contratista_id: credencial.contratista_id },
    orderBy: { fecha_hora: 'desc' },
    select: { tipo: true, zona_id: true, fecha_hora: true },
  });
  if (ultimo?.tipo === 'entrada') {
    throw new AppError(409, 'CONTRATISTA_YA_DENTRO', 'El contratista ya tiene un ingreso sin salida registrada', ultimo);
  }

  const usuarioId = req.usuario!.id;

  const resultado = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.user_id', ${usuarioId}, true) AS usuario, set_config('app.motivo', ${'Ingreso registrado en garita'}, true) AS motivo`;

    // Consumo atomico de un uso: solo procede si sigue activa y le quedan usos.
    // Si se agota, pasa a "usada" (el trigger guarda el cambio en el historial).
    const filas = await tx.$queryRaw<{ estado: string; usos_actuales: number }[]>`
      UPDATE credenciales
         SET usos_actuales = usos_actuales + 1,
             estado   = CASE WHEN usos_maximos IS NOT NULL AND usos_actuales + 1 >= usos_maximos THEN 'usada' ELSE estado END,
             usada_en = CASE WHEN usos_maximos IS NOT NULL AND usos_actuales + 1 >= usos_maximos THEN now() ELSE usada_en END
       WHERE id = ${credencial.id}::uuid
         AND estado = 'activa'
         AND (usos_maximos IS NULL OR usos_actuales < usos_maximos)
      RETURNING estado, usos_actuales`;

    if (filas.length === 0) return null;

    const registro = await tx.registros_acceso.create({
      data: {
        credencial_id: credencial.id,
        solicitud_id: credencial.solicitud_id,
        contratista_id: credencial.contratista_id,
        zona_id: evaluacion.zona.id,
        tipo: 'entrada',
        registrado_por: usuarioId,
      },
    });
    return { registro, credencial: filas[0]! };
  });

  // Otro guardia consumio el ultimo uso un instante antes
  if (!resultado) {
    evaluacion = { ...evaluacion, resultado: 'usado', motivo: 'La credencial ya fue utilizada' };
    await registrarValidacion(evaluacion, req);
    return { registrado: false, ...respuesta(evaluacion) };
  }

  await registrarValidacion(evaluacion, req);
  await registrarAuditoria(req, {
    accion: 'REGISTRAR_ENTRADA',
    entidad: 'registros_acceso',
    entidad_id: resultado.registro.id,
    datos_despues: {
      credencial: credencial.codigo_corto,
      zona: evaluacion.zona.codigo,
      usos_actuales: resultado.credencial.usos_actuales,
      estado_credencial: resultado.credencial.estado,
    },
  });

  const base = respuesta(evaluacion);
  return {
    registrado: true,
    ...base,
    credencial: base.credencial && {
      ...base.credencial,
      estado: resultado.credencial.estado,
      usos_actuales: resultado.credencial.usos_actuales,
    },
    registro: resultado.registro,
  };
}

// La salida no exige credencial valida: una credencial de un solo uso queda "usada"
// al entrar y la persona igual debe poder salir. Se toma el ultimo ingreso abierto.
export async function salida(datos: Salida, req: Request) {
  const ultimo = await prisma.registros_acceso.findFirst({
    where: { contratista_id: datos.contratista_id },
    orderBy: { fecha_hora: 'desc' },
  });
  if (!ultimo || ultimo.tipo !== 'entrada') {
    throw new AppError(409, 'CONTRATISTA_NO_ESTA_DENTRO', 'El contratista no tiene un ingreso abierto');
  }

  const registro = await prisma.registros_acceso.create({
    data: {
      credencial_id: ultimo.credencial_id,
      solicitud_id: ultimo.solicitud_id,
      contratista_id: ultimo.contratista_id,
      zona_id: ultimo.zona_id,
      tipo: 'salida',
      registrado_por: req.usuario!.id,
      observaciones: datos.observaciones ?? null,
    },
  });

  const minutosDentro = Math.round((registro.fecha_hora.getTime() - ultimo.fecha_hora.getTime()) / 60000);

  await registrarAuditoria(req, {
    accion: 'REGISTRAR_SALIDA',
    entidad: 'registros_acceso',
    entidad_id: registro.id,
    datos_despues: { contratista_id: registro.contratista_id, minutos_dentro: minutosDentro },
  });

  return { registro, entrada_en: ultimo.fecha_hora, minutos_dentro: minutosDentro };
}

type PersonaDentro = {
  contratista_id: string;
  nombres: string;
  apellidos: string;
  documento_identidad: string;
  empresa: string;
  zona_id: number;
  zona_codigo: string;
  zona_nombre: string;
  solicitud: string;
  credencial: string;
  ingreso_en: Date;
  minutos_dentro: number;
};

// Personas dentro de la instalacion ahora mismo (vista v_personas_en_instalacion)
export async function dentro(zonaId?: number) {
  return prisma.$queryRaw<PersonaDentro[]>`
    SELECT p.contratista_id, c.nombres, c.apellidos, c.documento_identidad,
           e.razon_social AS empresa,
           z.id AS zona_id, z.codigo AS zona_codigo, z.nombre AS zona_nombre,
           s.codigo AS solicitud, cr.codigo_corto AS credencial,
           p.ingreso_en,
           floor(extract(epoch FROM now() - p.ingreso_en) / 60)::int AS minutos_dentro
      FROM v_personas_en_instalacion p
      JOIN contratistas c          ON c.id  = p.contratista_id
      JOIN empresas_contratistas e ON e.id  = c.empresa_id
      JOIN zonas z                 ON z.id  = p.zona_id
      JOIN solicitudes_acceso s    ON s.id  = p.solicitud_id
      JOIN credenciales cr         ON cr.id = p.credencial_id
     WHERE (${zonaId ?? null}::int IS NULL OR p.zona_id = ${zonaId ?? null}::int)
     ORDER BY p.ingreso_en`;
}

type Movimiento = {
  id: string;
  tipo: string;
  fecha_hora: Date;
  observaciones: string | null;
  contratista_id: string;
  nombres: string;
  apellidos: string;
  empresa_id: string;
  empresa: string;
  zona: string;
  solicitud: string;
  credencial: string;
  registrado_por: string;
};

// Historial de entradas y salidas por contratista, empresa y fechas (hora de Guatemala)
export async function movimientos(filtros: Movimientos) {
  const contratista = filtros.contratista_id ?? null;
  const empresa = filtros.empresa_id ?? null;
  const desde = filtros.desde ?? null;
  const hasta = filtros.hasta ?? null;
  const { skip, take } = paginar(filtros);

  const [datos, conteo] = await Promise.all([
    prisma.$queryRaw<Movimiento[]>`
      SELECT ra.id, ra.tipo, ra.fecha_hora, ra.observaciones,
             c.id AS contratista_id, c.nombres, c.apellidos,
             e.id AS empresa_id, e.razon_social AS empresa,
             z.codigo AS zona, s.codigo AS solicitud, cr.codigo_corto AS credencial,
             u.email AS registrado_por
        FROM registros_acceso ra
        JOIN contratistas c          ON c.id  = ra.contratista_id
        JOIN empresas_contratistas e ON e.id  = c.empresa_id
        JOIN zonas z                 ON z.id  = ra.zona_id
        JOIN solicitudes_acceso s    ON s.id  = ra.solicitud_id
        JOIN credenciales cr         ON cr.id = ra.credencial_id
        JOIN usuarios u              ON u.id  = ra.registrado_por
       WHERE (${contratista}::uuid IS NULL OR ra.contratista_id = ${contratista}::uuid)
         AND (${empresa}::uuid IS NULL OR c.empresa_id = ${empresa}::uuid)
         AND (${desde}::date IS NULL OR (ra.fecha_hora AT TIME ZONE 'America/Guatemala')::date >= ${desde}::date)
         AND (${hasta}::date IS NULL OR (ra.fecha_hora AT TIME ZONE 'America/Guatemala')::date <= ${hasta}::date)
       ORDER BY ra.fecha_hora DESC
       LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
        FROM registros_acceso ra
        JOIN contratistas c ON c.id = ra.contratista_id
       WHERE (${contratista}::uuid IS NULL OR ra.contratista_id = ${contratista}::uuid)
         AND (${empresa}::uuid IS NULL OR c.empresa_id = ${empresa}::uuid)
         AND (${desde}::date IS NULL OR (ra.fecha_hora AT TIME ZONE 'America/Guatemala')::date >= ${desde}::date)
         AND (${hasta}::date IS NULL OR (ra.fecha_hora AT TIME ZONE 'America/Guatemala')::date <= ${hasta}::date)`,
  ]);

  return { datos, total: conteo[0]?.total ?? 0 };
}
