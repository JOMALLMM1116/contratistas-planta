# Contrato de la API

Base: `/api` · Formato: JSON · Nombres de campos: los mismos de la base de datos (snake_case).

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

## Códigos de error comunes

| HTTP | code | Cuándo |
|---|---|---|
| 400 | `VALIDACION` | Algún campo no cumple el esquema |
| 400 | `JSON_INVALIDO` | El cuerpo no es JSON válido |
| 400 | `RESTRICCION_VIOLADA` | Se violó un CHECK de la base |
| 401 | `NO_AUTENTICADO` | Falta sesión o expiró (pendiente: módulo auth) |
| 403 | `SIN_PERMISO` | El rol no tiene el permiso (pendiente: módulo auth) |
| 404 | `NO_ENCONTRADO` / `<ENTIDAD>_NO_ENCONTRADA` | El registro no existe |
| 409 | `REGISTRO_DUPLICADO` | Valor único repetido |
| 409 | `ESTADO_INVALIDO` | La transicion de estado no esta permitida desde el estado actual |
| 409 | `REFERENCIA_INVALIDA` | Referencia a un registro inexistente o en uso |
| 500 | `ERROR_INTERNO` | Error no controlado |

## Listados: parámetros comunes

`pagina` (por defecto 1), `por_pagina` (por defecto 20, máximo 100), `ordenar_por`, `orden` (`asc` | `desc`), y filtros propios de cada módulo.

## Módulos

### Zonas — `/api/zonas` (módulo de ejemplo)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/zonas?buscar=&activa=&nivel_riesgo=&pagina=&por_pagina=&ordenar_por=&orden=` | Listar con filtros y paginación |
| GET | `/api/zonas/:id` | Obtener una zona |
| POST | `/api/zonas` | Crear: `codigo`, `nombre`, `descripcion?`, `nivel_riesgo?` (1–4), `activa?` |
| PATCH | `/api/zonas/:id` | Actualizar parcialmente |
| DELETE | `/api/zonas/:id` | Desactivar (borrado lógico) |

### Usuarios — `/api/usuarios`

Permiso: `usuarios.gestionar` en todas las rutas. Nunca se devuelve `password_hash`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/usuarios?buscar=&rol_id=&activo=&empresa_id=&pagina=&por_pagina=&ordenar_por=&orden=` | Listar. `buscar` busca en nombre y correo. `ordenar_por`: `nombre_completo` (defecto), `email`, `created_at`, `ultimo_acceso` |
| GET | `/api/usuarios/:id` | Obtener un usuario (con su rol y empresa) |
| POST | `/api/usuarios` | Crear: `email`, `nombre_completo`, `rol_id`, `empresa_id?`, `password`. Si el rol es externo (`es_interno = false`), `empresa_id` es obligatorio |
| PATCH | `/api/usuarios/:id` | Actualizar: `nombre_completo?`, `rol_id?`, `empresa_id?`, `activo?` (al menos un campo) |
| POST | `/api/usuarios/:id/restablecer-password` | Sin cuerpo. El servidor genera una contraseña temporal de 12 caracteres, pone `debe_cambiar_password = true` y la devuelve una sola vez en `datos.password_temporal` |

Contraseña: mínimo 8 caracteres, con al menos una letra y un número.
Errores propios: `400 EMPRESA_REQUERIDA`, `404 USUARIO_NO_ENCONTRADO`, `404 ROL_NO_ENCONTRADO`, `409 REGISTRO_DUPLICADO` (correo repetido).

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
4. `*.controller.ts`: valida con `.parse()` y arma la respuesta.
5. `*.routes.ts`: define las rutas.
6. Montarlo en `server/src/routes.ts` con una línea.
7. Documentar sus endpoints en este archivo.
