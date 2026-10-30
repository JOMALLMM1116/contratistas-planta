import type { Request } from 'express';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { evaluarCredencial, type Evaluacion } from '../credenciales/credenciales.validacion.js';
import type { Validar } from './garita.schemas.js';

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
