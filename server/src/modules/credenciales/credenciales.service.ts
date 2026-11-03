import { randomInt } from 'node:crypto';
import type { Request } from 'express';
import QRCode from 'qrcode';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { paginar } from '../../shared/http/paginacion.js';
import * as solicitudesService from '../solicitudes/solicitudes.service.js';
import * as permisosService from '../permisos-trabajo/permisos-trabajo.service.js';
import { firmarTokenCredencial } from './credenciales.token.js';
import type { EmitirCredencial, ListarCredenciales } from './credenciales.schemas.js';

// Sin caracteres que se confunden al leer (O/0, I/1/L)
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generarCodigoCorto() {
  let codigo = '';
  for (let i = 0; i < 8; i++) codigo += ALFABETO[randomInt(ALFABETO.length)];
  return codigo;
}

// Fin de la vigencia: fecha fin + hora fin de la solicitud, en hora de Guatemala (UTC-6, sin horario de verano)
function finDeVigencia(fechaFin: Date, horaFin: string) {
  return new Date(`${fechaFin.toISOString().slice(0, 10)}T${horaFin}:00-06:00`);
}

// Una credencial activa cuya fecha ya paso se reporta como vencida
function conEstadoEfectivo<T extends { estado: string; expira_en: Date }>(c: T) {
  const vencida = c.estado === 'activa' && c.expira_en <= new Date();
  return { ...c, estado_efectivo: vencida ? 'vencida' : c.estado };
}

async function conQr<T extends { id: string; contratista_id: string; solicitud_id: string; expira_en: Date }>(c: T) {
  const token = await firmarTokenCredencial(c);
  const qr = await QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
  return { ...conEstadoEfectivo(c as T & { estado: string }), token, qr };
}

async function buscar(id: string) {
  const credencial = await prisma.credenciales.findUnique({ where: { id } });
  if (!credencial) throw new AppError(404, 'CREDENCIAL_NO_ENCONTRADA', `No existe la credencial ${id}`);
  return credencial;
}

async function estaBloqueado(contratistaId: string) {
  const [fila] = await prisma.$queryRaw<{ bloqueado: boolean }[]>`SELECT fn_contratista_bloqueado(${contratistaId}::uuid) AS bloqueado`;
  return fila?.bloqueado === true;
}

export async function emitir(datos: EmitirCredencial, req: Request) {
  const solicitud = await solicitudesService.obtener(datos.solicitud_id);

  if (solicitud.estado !== 'aprobada') {
    throw new AppError(409, 'SOLICITUD_NO_APROBADA', `Solo se emiten credenciales de solicitudes aprobadas (estado actual: ${solicitud.estado})`);
  }

  const incluido = solicitud.solicitud_contratistas.some((s) => s.contratistas.id === datos.contratista_id);
  if (!incluido) {
    throw new AppError(400, 'CONTRATISTA_NO_EN_SOLICITUD', 'El contratista no esta incluido en la solicitud');
  }

  // Si el tipo de trabajo exige permiso, debe existir y estar vigente
  let permisoId: string | null = null;
  if (solicitud.tipos_trabajo.requiere_permiso_trabajo) {
    const { datos: permisos } = await permisosService.listar({
      solicitud_id: solicitud.id,
      pagina: 1,
      por_pagina: 1,
      ordenar_por: 'emitido_en',
      orden: 'desc',
    });
    const permiso = permisos[0];
    if (!permiso || !['emitido', 'en_ejecucion'].includes(permiso.estado)) {
      throw new AppError(409, 'PERMISO_REQUERIDO', 'Este tipo de trabajo exige un permiso de trabajo emitido');
    }
    permisoId = permiso.id;
  }

  if (await estaBloqueado(datos.contratista_id)) {
    throw new AppError(409, 'CONTRATISTA_BLOQUEADO', 'El contratista o su empresa tienen un bloqueo activo');
  }

  // Documentos y capacitaciones obligatorios al dia (regla: no permitir acceso con documentos vencidos)
  const requisitos = await solicitudesService.requisitos(solicitud.id);
  const delContratista = requisitos.find((r) => r.contratista_id === datos.contratista_id);
  if (delContratista && delContratista.faltantes.length > 0) {
    throw new AppError(409, 'REQUISITOS_INCUMPLIDOS', 'El contratista tiene documentos o capacitaciones pendientes', delContratista.faltantes);
  }

  const expiraEn = finDeVigencia(solicitud.fecha_fin, solicitud.hora_fin);
  if (expiraEn <= new Date()) {
    throw new AppError(409, 'SOLICITUD_FUERA_DE_VIGENCIA', 'La vigencia de la solicitud ya termino');
  }

  const activa = await prisma.credenciales.findFirst({
    where: { solicitud_id: solicitud.id, contratista_id: datos.contratista_id, estado: 'activa' },
    select: { id: true, codigo_corto: true },
  });
  if (activa) {
    throw new AppError(409, 'CREDENCIAL_ACTIVA_EXISTENTE', `Ya existe la credencial activa ${activa.codigo_corto}; revoquela para emitir otra`, { credencial_id: activa.id });
  }

  // El codigo corto es unico: si por azar se repite, se genera otro (hasta 4 intentos)
  let credencial;
  for (let intento = 1; ; intento++) {
    try {
      credencial = await prisma.credenciales.create({
        data: {
          solicitud_id: solicitud.id,
          contratista_id: datos.contratista_id,
          permiso_trabajo_id: permisoId,
          codigo_corto: generarCodigoCorto(),
          expira_en: expiraEn,
          usos_maximos: datos.usos_maximos ?? null,
          emitida_por: req.usuario!.id,
        },
      });
      break;
    } catch (err) {
      const duplicado = (err as { code?: string }).code === 'P2002';
      if (duplicado && intento < 4) continue;
      throw err;
    }
  }

  await registrarAuditoria(req, {
    accion: 'EMITIR_CREDENCIAL',
    entidad: 'credenciales',
    entidad_id: credencial.id,
    datos_despues: {
      codigo_corto: credencial.codigo_corto,
      solicitud: solicitud.codigo,
      contratista_id: credencial.contratista_id,
      expira_en: credencial.expira_en,
      usos_maximos: credencial.usos_maximos,
    },
  });

  return conQr(credencial);
}

export async function listar(filtros: ListarCredenciales) {
  const where: Prisma.credencialesWhereInput = {};
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.solicitud_id) where.solicitud_id = filtros.solicitud_id;
  if (filtros.contratista_id) where.contratista_id = filtros.contratista_id;

  const orderBy = { [filtros.ordenar_por]: filtros.orden } as Prisma.credencialesOrderByWithRelationInput;

  const [total, datos] = await prisma.$transaction([
    prisma.credenciales.count({ where }),
    prisma.credenciales.findMany({ where, orderBy, ...paginar(filtros) }),
  ]);

  return { datos: datos.map((c) => conEstadoEfectivo(c)), total };
}

export async function obtener(id: string) {
  return conEstadoEfectivo(await buscar(id));
}

// Credenciales del contratista que inicio sesion (las usa la PWA)
export async function mias(req: Request) {
  const contratistaId = req.usuario!.contratista_id;
  if (!contratistaId) return [];

  const datos = await prisma.credenciales.findMany({
    where: { contratista_id: contratistaId },
    orderBy: { emitida_en: 'desc' },
    take: 50,
  });
  return datos.map((c) => conEstadoEfectivo(c));
}

// El token no se guarda: se vuelve a firmar con el mismo jti y la misma expiracion.
// Solo el propio contratista o quien emite o imprime pases puede obtener el QR.
export async function qr(id: string, req: Request) {
  const credencial = await buscar(id);
  const usuario = req.usuario!;

  const esDueno = usuario.contratista_id === credencial.contratista_id;
  const puedeVer = usuario.permisos.some((p) => p === 'credenciales.emitir' || p === 'garita.imprimir_pase');
  if (!esDueno && !puedeVer) {
    await registrarAuditoria(req, {
      accion: 'ACCESO_DENEGADO',
      entidad: 'credenciales',
      entidad_id: id,
      resultado: 'denegado',
      datos_despues: { motivo: 'QR de una credencial ajena' },
    });
    throw new AppError(403, 'SIN_PERMISO', 'No puede ver el QR de una credencial ajena');
  }

  if (conEstadoEfectivo(credencial).estado_efectivo !== 'activa') {
    throw new AppError(409, 'CREDENCIAL_NO_ACTIVA', `La credencial esta ${conEstadoEfectivo(credencial).estado_efectivo}`);
  }

  return conQr(credencial);
}

export async function revocar(id: string, motivo: string, req: Request) {
  const credencial = await buscar(id);
  if (credencial.estado !== 'activa') {
    throw new AppError(409, 'ESTADO_INVALIDO', `Solo se revoca una credencial activa (estado actual: ${credencial.estado})`);
  }

  const usuarioId = req.usuario!.id;
  // set_config dentro de la transaccion: el trigger de historial guarda quien y por que
  const revocada = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.user_id', ${usuarioId}, true) AS usuario, set_config('app.motivo', ${motivo}, true) AS motivo`;
    return tx.credenciales.update({
      where: { id },
      data: { estado: 'revocada', revocada_en: new Date(), revocada_por: usuarioId, motivo_revocacion: motivo },
    });
  });

  await registrarAuditoria(req, {
    accion: 'REVOCAR_CREDENCIAL',
    entidad: 'credenciales',
    entidad_id: id,
    datos_antes: { estado: credencial.estado },
    datos_despues: { estado: 'revocada', motivo },
  });

  return conEstadoEfectivo(revocada);
}
