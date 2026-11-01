import type { Request, Response } from 'express';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { respuestaPaginada } from '../../shared/http/paginacion.js';
import * as usuariosService from './usuarios.service.js';
import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  listarUsuariosSchema,
  usuarioIdSchema,
} from './usuarios.schemas.js';

export async function listar(req: Request, res: Response) {
  const filtros = listarUsuariosSchema.parse(req.query);
  const { datos, total } = await usuariosService.listar(filtros);
  res.json(respuestaPaginada(datos, total, filtros));
}

export async function obtener(req: Request, res: Response) {
  const { id } = usuarioIdSchema.parse(req.params);
  res.json({ datos: await usuariosService.obtener(id) });
}

export async function crear(req: Request, res: Response) {
  const datos = crearUsuarioSchema.parse(req.body);
  const usuario = await usuariosService.crear(datos);

  // La contrasena nunca se audita
  await registrarAuditoria(req, {
    accion: 'USUARIO_CREADO',
    entidad: 'usuarios',
    entidad_id: usuario.id,
    datos_despues: { email: usuario.email, rol: usuario.roles.codigo, empresa_id: usuario.empresa_id },
  });

  res.status(201).json({ datos: usuario });
}

export async function actualizar(req: Request, res: Response) {
  const { id } = usuarioIdSchema.parse(req.params);
  const datos = actualizarUsuarioSchema.parse(req.body);
  const { usuario, antes, despues } = await usuariosService.actualizar(id, datos);

  await registrarAuditoria(req, {
    accion: antes.rol !== despues.rol ? 'USUARIO_ROL_CAMBIADO' : 'USUARIO_ACTUALIZADO',
    entidad: 'usuarios',
    entidad_id: id,
    datos_antes: antes,
    datos_despues: despues,
  });

  res.json({ datos: usuario });
}

export async function restablecerPassword(req: Request, res: Response) {
  const { id } = usuarioIdSchema.parse(req.params);
  const { usuario, password_temporal } = await usuariosService.restablecerPassword(id);

  await registrarAuditoria(req, {
    accion: 'USUARIO_PASSWORD_RESTABLECIDA',
    entidad: 'usuarios',
    entidad_id: id,
    datos_despues: { debe_cambiar_password: true },
  });

  res.json({ datos: { usuario, password_temporal } });
}