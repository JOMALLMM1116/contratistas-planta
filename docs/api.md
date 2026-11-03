# Contrato de la API

Base: `/api` · Formato: JSON · Nombres de campos: los mismos de la base de datos (snake_case).
Todas las rutas exigen sesión, salvo `/api/health` y las públicas de `/api/auth`.

## Respuestas

Listado:
```json
{ "datos": [ ... ], "meta": { "total": 42, "pagina": 1, "por_pagina": 20, "total_paginas": 3 } }
```

Un registro:
```json
{ "datos": { ... } }
```

Error:
```json
{ "error": { "code": "VALIDACION", "message": "Los datos enviados no son validos", "detalles": [ { "campo": "nombre", "mensaje": "..." } ] } }
```

`detalles` solo aparece cuando hay información adicional. Fuera de producción, los errores 500 incluyen
además `tecnico` con el mensaje interno.

## Códigos de error comunes

| HTTP | code | Cuándo |
|---|---|---|
| 400 | `VALIDACION` | Algún campo no cumple el esquema |
| 400 | `JSON_INVALIDO` | El cuerpo no es JSON válido |
| 400 | `RESTRICCION_VIOLADA` | Se violó un CHECK de la base |
| 401 | `NO_AUTENTICADO` | No hay sesión |
| 401 | `SESION_EXPIRADA` | El token de acceso venció: el cliente renueva con `/api/auth/refresh` y reintenta una vez |
| 401 | `SESION_INVALIDA` | Token alterado, sesión revocada o refresh reutilizado |
| 401 | `CREDENCIALES_INVALIDAS` | Correo o contraseña incorrectos (mismo mensaje exista o no el correo) |
| 403 | `SIN_PERMISO` | El rol no tiene el permiso de la acción (queda en auditoría como `ACCESO_DENEGADO`) |
| 403 | `USUARIO_INACTIVO` | La cuenta está desactivada |
| 404 | `RUTA_NO_ENCONTRADA` | La ruta no existe |
| 404 | `NO_ENCONTRADO` / `<ENTIDAD>_NO_ENCONTRADA` | El registro no existe **o está fuera del alcance del usuario** (ver Autorización por objeto) |
| 409 | `REGISTRO_DUPLICADO` | Valor único repetido |
| 409 | `ESTADO_INVALIDO` | La transición de estado no está permitida desde el estado actual |
| 409 | `REFERENCIA_INVALIDA` | Referencia a un registro inexistente o en uso |
| 423 | `USUARIO_BLOQUEADO` | Cuenta bloqueada 15 minutos por 5 intentos fallidos |
| 429 | `DEMASIADOS_INTENTOS` | Límite por IP en inicio de sesión o recuperación |
| 500 | `ERROR_INTERNO` | Error no controlado |

## Listados: parámetros comunes

`pagina` (por defecto 1), `por_pagina` (por defecto 20, máximo 100), `ordenar_por`, `orden` (`asc` | `desc`), y filtros propios de cada módulo.

## Reglas generales

- **El usuario de cada acción sale de la sesión**, nunca del cuerpo: no se envían `usuario_id`,
  `solicitada_por`, `aprobado_por`, `revisado_por`, `subido_por`, `registrado_por`, `emitida_por`,
  `creado_por`, `reportado_por`, `cerrado_por` ni similares. Si llegan, el servidor los reemplaza.
- **Permisos por acción**: cada ruta exige uno de los permisos indicados (basta con uno).
- **Catálogos, empresas, contratistas y equipos**: cualquier usuario con sesión puede consultarlos;
  crear, modificar o desactivar exige el permiso indicado (`GET` libre, `POST`/`PATCH`/`DELETE` con permiso).
- Los cambios de estado quedan en `historial_estados` (consultable en `/api/auditoria/historial`).

## Autorización por objeto

Además del permiso de la acción, el servidor limita **qué registros** puede ver o modificar cada usuario:

| Usuario | Alcance |
|---|---|
| Personal interno (`es_interno = true`) | Todos los registros, según sus permisos |
| Supervisor de campo | Solo lo de **su empresa** |
| Contratista | Solo lo **suyo** (su ficha, sus documentos y capacitaciones, las solicitudes y permisos donde participa, sus archivos y su propio checklist) |

- Un registro fuera de alcance responde **404** (no revela que existe); en los listados simplemente no aparece.
- Crear o registrar a nombre de otro (otra empresa u otro contratista) responde **403**.
- Se aplica en solicitudes, archivos, documentos, contratistas, equipos, empresas, permisos de trabajo y capacitaciones.

## Módulos

### Salud — `/api/health`

Público. Lo usan Docker, el pipeline y el monitoreo.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | `{ estado, servicio, entorno, baseDatos, uptimeSegundos, fecha }`. Responde `503` con `estado: "degradado"` si la base no responde |

### Autenticación — `/api/auth`

La sesión viaja en cookies `HttpOnly` (`cp_access` 15 minutos y `cp_refresh` 7 días, con `path=/api/auth`),
`SameSite=Strict` y `Secure` en producción. El cliente no guarda tokens.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | Público (10 intentos por IP cada 15 min) | `{ email, password }` → cookies y `{ datos: { usuario } }`. 5 intentos fallidos bloquean la cuenta 15 minutos |
| POST | `/api/auth/refresh` | Público (cookie `cp_refresh`) | Rota el refresh y devuelve `{ datos: { usuario } }`. Si reaparece un refresh ya usado, se cierran todas las sesiones del usuario |
| POST | `/api/auth/logout` | Público | Revoca la sesión y borra las cookies |
| GET | `/api/auth/me` | Sesión | Perfil actualizado desde la base: `id`, `email`, `nombre_completo`, `rol` (`codigo`, `nombre`, `es_interno`), `permisos`, `empresa_id`, `contratista_id` |
| POST | `/api/auth/recuperar` | Público (5 por IP cada 15 min) | `{ email }`. Misma respuesta exista o no el correo. Envía un enlace `APP_URL/restablecer?token=...` válido 30 minutos y de un solo uso |
| POST | `/api/auth/restablecer` | Público (5 por IP cada 15 min) | `{ token, password }`. Cierra todas las sesiones del usuario |
| POST | `/api/auth/cambiar-password` | Sesión | `{ actual, nueva }`. Cierra todas las sesiones |

### Catálogos

Consultar: cualquier sesión. Crear, modificar y desactivar: `requisitos.gestionar`. Los campos de cada
uno están en su `server/src/modules/<modulo>/<modulo>.schemas.ts`.

| Recurso | Rutas |
|---|---|
| Zonas (módulo de ejemplo) | `GET /api/zonas?buscar=&activa=&nivel_riesgo=`, `GET /:id`, `POST` (`codigo`, `nombre`, `descripcion?`, `nivel_riesgo?` 1–4, `activa?`), `PATCH /:id`, `DELETE /:id` (desactivar) |
| Tipos de trabajo | `GET /api/tipos-trabajo`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` (desactivar) |
| Tipos de documento | `GET /api/tipos-documento` (filtro `aplica_a`: `contratista`, `empresa` o `equipo`), `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` |
| Capacitaciones (catálogo) | `GET /api/capacitaciones`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` |
| Requisitos por tipo de trabajo | `GET /api/requisitos-tipo-trabajo`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`. Cada requisito es un tipo de documento **o** una capacitación |
| Plantillas de checklist | `GET /api/checklist-plantillas`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` (desactivar); ítems: `POST /:id/items`, `PATCH /:id/items/:itemId`, `DELETE /:id/items/:itemId` |

### Empresas, contratistas y equipos

Consultar: cualquier sesión (con autorización por objeto). Escritura: el permiso indicado.

| Recurso | Escritura | Rutas |
|---|---|---|
| Empresas contratistas | `empresas.gestionar` | `GET /api/empresas-contratistas`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` (desactivar) |
| Contratistas | `contratistas.gestionar` | `GET /api/contratistas` (filtros `empresa_id`, `estado`, `buscar`), `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` (desactivar) |
| Equipos | `contratistas.gestionar` | `GET /api/equipos` (filtros `empresa_id`, `estado`), `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` (desactivar) |

### Archivos — `/api/archivos`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/archivos` | `documentos.subir` o `evidencias.registrar` | `multipart/form-data`, campo `archivo`. Solo PDF, JPG y PNG; se verifica la firma real del archivo y se calcula SHA-256. El permiso se revisa **antes** de escribir en disco. Devuelve el `id` para vincularlo a un documento, capacitación, evidencia o incidente |
| GET | `/api/archivos`, `/api/archivos/:id` | Sesión (alcance) | Metadatos |
| GET | `/api/archivos/:id/descargar` | Sesión (alcance) | Descarga el archivo |
| DELETE | `/api/archivos/:id` | `documentos.revisar` | Eliminar |

### Documentos — `/api/documentos`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/documentos`, `/:id` | Sesión (alcance) | Listar y obtener |
| POST | `/api/documentos` | `documentos.subir` o `documentos.revisar` | `{ tipo_documento_id, archivo_id, numero?, fecha_emision?, fecha_vencimiento? }` y exactamente un dueño: `contratista_id`, `empresa_id` o `equipo_id`. Queda `pendiente` de revisión |
| PATCH | `/api/documentos/:id` | `documentos.subir` o `documentos.revisar` | Actualizar |
| POST | `/api/documentos/:id/revision` | `documentos.revisar` | `{ decision: "aprobado" \| "rechazado", observaciones? }` (obligatorio si rechaza) |
| DELETE | `/api/documentos/:id` | `documentos.revisar` | Eliminar |

### Capacitaciones de contratistas — `/api/contratista-capacitaciones`

Mismas rutas y permisos que documentos: `GET /`, `GET /:id`, `POST` y `PATCH /:id` (`documentos.subir` o
`documentos.revisar`), `POST /:id/revision` y `DELETE /:id` (`documentos.revisar`).

### Solicitudes de acceso — `/api/solicitudes`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/solicitudes` | `solicitudes.ver` (alcance) | Listar (filtros `estado`, `buscar`) |
| GET | `/api/solicitudes/:id` | `solicitudes.ver` (alcance) | Detalle con contratistas, zonas, equipos, evaluaciones y autorizaciones |
| GET | `/api/solicitudes/:id/requisitos` | `solicitudes.ver` (alcance) | Por contratista: documentos y capacitaciones obligatorios faltantes o vencidos |
| POST | `/api/solicitudes` | `solicitudes.crear` | Crear en `borrador`. Campos en `solicitudes.schemas.ts`. Un supervisor solo puede crear para su empresa |
| PATCH / DELETE | `/api/solicitudes/:id` | `solicitudes.crear` | Modificar o eliminar (en borrador) |
| POST | `/api/solicitudes/:id/enviar` | `solicitudes.crear` | `borrador` → `pendiente`. Exige al menos un contratista (`409 SIN_CONTRATISTAS`) |
| POST | `/api/solicitudes/:id/evaluacion-riesgo` | `riesgos.evaluar` | `{ nivel_riesgo, peligros_identificados, medidas_control, epp_requerido?, resultado }` |
| POST | `/api/solicitudes/:id/autorizaciones` | `solicitudes.autorizar` | `{ decision: "aprobada" \| "rechazada", comentario? }` (obligatorio si rechaza). Según el riesgo, una o dos etapas, con personas distintas; aprobar exige requisitos al día |
| POST | `/api/solicitudes/:id/cancelar` | `solicitudes.crear` | `{ motivo }` |

### Permisos de trabajo — `/api/permisos-trabajo`

Consultar: `solicitudes.ver` o `permisos_trabajo.emitir` (con alcance). Una solicitud tiene como máximo un permiso.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/permisos-trabajo`, `/:id` | Ver | Listar (filtro `solicitud_id`) y obtener; el detalle indica si está `vigente` |
| POST | `/api/permisos-trabajo` | `permisos_trabajo.emitir` | `{ solicitud_id, condiciones_especiales? }` |
| POST | `/api/permisos-trabajo/:id/iniciar` | `actividad.confirmar` | `emitido` → `en_ejecucion`. Exige permiso vigente, sin bloqueos y checklist completo |
| POST | `/api/permisos-trabajo/:id/cerrar` | `actividad.confirmar` | `en_ejecucion` → `cerrado`. `{ observaciones? }` |
| POST | `/api/permisos-trabajo/:id/revocar` | `permisos_trabajo.revocar` | `{ motivo }` |
| GET | `/api/permisos-trabajo/:id/checklist` | Ver | Ítems por contratista con sus respuestas, pendientes y si está completo |
| POST | `/api/permisos-trabajo/:id/checklist` | `checklist.completar` | `{ respuestas: [{ contratista_id, item_id, cumple, observacion? }] }`. Un contratista solo responde el suyo (`403`) |
| GET | `/api/permisos-trabajo/:id/evidencias` | Ver | Listar |
| POST | `/api/permisos-trabajo/:id/evidencias` | `evidencias.registrar` | `{ archivo_id, momento: "inicio" \| "durante" \| "cierre", descripcion? }` |
| DELETE | `/api/permisos-trabajo/:id/evidencias/:evidenciaId` | `evidencias.registrar` | Quitar |

### Credenciales — `/api/credenciales`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/credenciales/mias` | Sesión | Credenciales del contratista con sesión (PWA) |
| GET | `/api/credenciales` | `credenciales.emitir`, `credenciales.revocar` o `garita.validar` | Listar (filtros `estado`, `contratista_id`, `solicitud_id`). Cada una trae `estado_efectivo` (calculado: vencida, usada, revocada o activa) |
| GET | `/api/credenciales/:id` | Igual que listar | Obtener |
| GET | `/api/credenciales/:id/qr` | El propio contratista o personal autorizado | QR como `data:image/png;base64,...` y datos de la credencial |
| POST | `/api/credenciales` | `credenciales.emitir` | `{ solicitud_id, contratista_id, usos_maximos? }` (1–50; vacío = ilimitado durante la vigencia). Devuelve el token firmado, el `codigo_corto` de 8 caracteres y el QR |
| POST | `/api/credenciales/:id/revocar` | `credenciales.revocar` | `{ motivo }` |

Antes de emitir se verifica: solicitud aprobada, persona incluida, permiso de trabajo vigente si el tipo
lo exige, sin bloqueos, requisitos al día y sin otra credencial activa para esa persona y solicitud.

El token es un JWT HS256 con audiencia `credencial`: `jti` = id de la credencial, `sub` = contratista,
id de la solicitud y expiración al fin de la vigencia (hora de Guatemala).

### Garita — `/api/garita`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/garita/validar` | `garita.validar` | `{ token \| codigo, zona_id }`. Siempre `200` con `resultado`, `permitido`, `motivo`, `credencial`, `contratista`, `empresa` y `solicitud`. **No consume usos** |
| POST | `/api/garita/entrada` | `garita.registrar_acceso` | Igual que validar; si es válido registra la entrada (`201`) consumiendo un uso de forma atómica; si no, `200` con el motivo. `409 CONTRATISTA_YA_DENTRO` |
| POST | `/api/garita/salida` | `garita.registrar_acceso` | `{ contratista_id, observaciones? }`. No exige credencial válida. `409 CONTRATISTA_NO_ESTA_DENTRO` |
| GET | `/api/garita/dentro?zona_id=` | `accesos.ver_personas_dentro` | Personas dentro, con minutos de permanencia |
| GET | `/api/garita/movimientos?contratista_id=&empresa_id=&desde=&hasta=` | `accesos.ver_personas_dentro` o `reportes.ver` | Entradas y salidas, paginado |
| GET | `/api/garita/pase/:id` | `garita.imprimir_pase` | Pase temporal en PDF (solo credencial activa y vigente); registra la impresión |

Resultados de la validación, en el orden en que se evalúan:

`invalido` → `revocado` → `usado` → `vencido` → `bloqueado` → `documentos_vencidos` → `fuera_de_horario` → `zona_no_autorizada` → `valido`

### Notificaciones — `/api/notificaciones`

Permiso `notificaciones.ver`; cada usuario ve solo las suyas.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/notificaciones` | Listar |
| GET | `/api/notificaciones/conteo` | Cantidad sin leer |
| PATCH | `/api/notificaciones/:id/leida` | Marcar una como leída |
| POST | `/api/notificaciones/marcar-leidas` | Marcar todas |

### Reportes — `/api/reportes`

Permiso `reportes.ver` (incluso para consultar).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/reportes/dashboard?dias=` | Indicadores y series del dashboard |
| GET | `/api/reportes/:tipo?formato=json\|excel\|pdf` | `tipo`: `solicitudes`, `permisos`, `vencimientos` o `contratistas`. Filtros: `empresa_id`, `estado`, `desde`, `hasta`, `dias` |

### Usuarios — `/api/usuarios`

Permiso: `usuarios.gestionar` en todas las rutas. Nunca se devuelve `password_hash`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/usuarios?buscar=&rol_id=&activo=&empresa_id=&pagina=&por_pagina=&ordenar_por=&orden=` | Listar. `buscar` busca en nombre y correo. `ordenar_por`: `nombre_completo` (defecto), `email`, `created_at`, `ultimo_acceso` |
| GET | `/api/usuarios/:id` | Obtener un usuario (con su rol y empresa) |
| POST | `/api/usuarios` | Crear: `email`, `nombre_completo`, `rol_id`, `empresa_id?`, `password`. Si el rol es externo (`es_interno = false`), `empresa_id` es obligatorio; si es interno, se guarda sin empresa |
| PATCH | `/api/usuarios/:id` | Actualizar: `nombre_completo?`, `rol_id?`, `empresa_id?`, `activo?` (al menos un campo) |
| POST | `/api/usuarios/:id/restablecer-password` | Sin cuerpo. El servidor genera una contraseña temporal de 12 caracteres, pone `debe_cambiar_password = true`, quita el bloqueo por intentos y la devuelve una sola vez en `datos.password_temporal` |

Contraseña: mínimo 8 caracteres, con al menos una letra y un número.
Al desactivar un usuario, cambiarle el rol o restablecer su contraseña, se cierran todas sus sesiones.
Nadie puede desactivarse, cambiarse el rol ni restablecerse la contraseña a sí mismo.
Errores propios: `400 EMPRESA_REQUERIDA`, `404 USUARIO_NO_ENCONTRADO`, `404 ROL_NO_ENCONTRADO`, `409 REGISTRO_DUPLICADO` (correo repetido), `409 OPERACION_SOBRE_SI_MISMO`.

### Roles — `/api/roles`

Permiso: `usuarios.gestionar`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/roles` | Lista de roles con `id`, `codigo`, `nombre`, `descripcion`, `es_interno` y `permisos` (`[{ codigo, descripcion }]`), para los selectores del frontend |

### Auditoría — `/api/auditoria`

Permiso: `auditoria.ver`. Solo lectura: las tablas son de solo inserción.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/auditoria?desde=&hasta=&usuario_email=&accion=&entidad=&resultado=&pagina=&por_pagina=` | Listar, de la más reciente a la más antigua. `desde` y `hasta` son fechas `YYYY-MM-DD` en hora de Guatemala (todo el día incluido). `resultado`: `ok`, `denegado` o `error`. `usuario_email` y `accion` buscan por coincidencia parcial; `entidad` es exacta |
| GET | `/api/auditoria/historial?entidad=&entidad_id=` | Cambios de estado de un registro (más reciente primero), con `usuario` (`id`, `email`, `nombre_completo`). `entidad_id` debe ser un UUID. Sin cambios responde `[]` |

Valores de `entidad` en el historial: `solicitud`, `permiso_trabajo`, `credencial`, `incidente`, `documento` y `contratista_capacitacion`.
Errores propios: `400 VALIDACION` (fechas invertidas, `resultado` inválido, `entidad_id` que no es UUID).

### Incidentes — `/api/incidentes`

Permisos: crear con `incidentes.reportar`; el resto con `incidentes.gestionar`. `reportado_por` y `cerrado_por` salen de la sesión: no se envían.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/incidentes?estado=&severidad=&empresa_id=&contratista_id=&desde=&hasta=&pagina=&por_pagina=&ordenar_por=&orden=` | Listar. `estado`: `abierto`, `en_investigacion`, `cerrado`. `severidad`: `leve`, `moderado`, `grave`, `critico`. `empresa_id` incluye los incidentes de sus contratistas. `ordenar_por`: `fecha_ocurrencia` (defecto), `created_at`, `codigo` |
| GET | `/api/incidentes/:id` | Obtener (con `contratista`, `empresa`, `solicitud`, `zona`, usuarios y `evidencias`) |
| POST | `/api/incidentes` | Crear: `severidad`, `descripcion`, al menos uno de `contratista_id`, `empresa_id` o `solicitud_id`; opcionales `zona_id`, `fecha_ocurrencia`, `archivos` (IDs de archivos ya subidos) |
| PATCH | `/api/incidentes/:id` | Actualizar: `severidad?`, `descripcion?`, `zona_id?`, `fecha_ocurrencia?`, `acciones_correctivas?` |
| POST | `/api/incidentes/:id/investigar` | `abierto` → `en_investigacion`. Cuerpo opcional: `motivo?` |
| POST | `/api/incidentes/:id/cerrar` | `en_investigacion` → `cerrado`. Cuerpo opcional: `motivo?`, `acciones_correctivas?` |
| POST | `/api/incidentes/:id/evidencias` | Vincular un archivo ya subido: `archivo_id` |
| DELETE | `/api/incidentes/:id/evidencias/:archivoId` | Quitar el vínculo (el archivo se conserva) |
| DELETE | `/api/incidentes/:id` | Eliminar. Solo un incidente `abierto` |

Los cambios de estado quedan en el historial (`entidad = incidente`).
Errores propios: `409 ESTADO_INVALIDO` (transición no permitida), `404 INCIDENTE_NO_ENCONTRADO`, `404 EVIDENCIA_NO_ENCONTRADA`, `409 REGISTRO_DUPLICADO` (archivo ya vinculado).

### Bloqueos — `/api/bloqueos`

Permiso: `bloqueos.gestionar` en todas las rutas. `creado_por` y `levantado_por` salen de la sesión. La garita respeta los bloqueos: una credencial responde `bloqueado` mientras haya uno activo sobre el contratista o su empresa.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/bloqueos?activo=&tipo=&empresa_id=&contratista_id=&pagina=&por_pagina=&ordenar_por=&orden=` | Listar. `activo=true` solo activos, `activo=false` historial (levantados), sin valor todos. `tipo`: `documento_vencido`, `incidente`, `manual`. `ordenar_por`: `creado_en` (defecto), `levantado_en` |
| GET | `/api/bloqueos/:id` | Obtener (incluye `activo`, `contratista`, `empresa`, `incidente` y usuarios) |
| POST | `/api/bloqueos` | Bloquear: `tipo`, `motivo`, exactamente uno de `contratista_id` o `empresa_id`, y `incidente_id?` |
| POST | `/api/bloqueos/:id/levantar` | Levantar: `motivo` (obligatorio) |

Los bloqueos no se eliminan: se levantan, para conservar el historial.
Errores propios: `404 BLOQUEO_NO_ENCONTRADO`, `404 INCIDENTE_NO_ENCONTRADO`, `409 BLOQUEO_YA_LEVANTADO`.

### Revisión de vencimientos — `/api/notificaciones/revision`

Permiso: `usuarios.gestionar` (solo admin).

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/notificaciones/revision` | Ejecuta a mano la revisión que corre a diario (6:00, hora de Guatemala). Genera avisos de documentos y capacitaciones por vencer o vencidos, y marca como vencidos los permisos `emitido`, las solicitudes `aprobada` con `fecha_fin` pasada y las credenciales `activa` con `expira_en` pasado. Devuelve `documentos`, `capacitaciones`, `permisos_vencidos`, `notificaciones_permisos`, `solicitudes_vencidas` y `credenciales_vencidas` |

## Cómo crear un módulo nuevo

1. Copiar `server/src/modules/zonas/` con el nombre del módulo.
2. `*.schemas.ts`: esquemas Zod de crear, actualizar, id y listar.
3. `*.service.ts`: lógica y consultas Prisma. Ningún módulo consulta tablas de otro: llama a su service.
4. `*.controller.ts`: valida con `.parse()`, toma el usuario de `req.usuario` (nunca del cuerpo), aplica el alcance (`alcanceDe`) y arma la respuesta.
5. `*.routes.ts`: define las rutas con `requierePermiso(...)` en cada acción.
6. Montarlo en `server/src/routes.ts` **después** de `apiRouter.use(requiereAuth)`.
7. Registrar en auditoría las acciones sensibles con `registrarAuditoria`.
8. Documentar sus endpoints en este archivo.
