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

## Cómo crear un módulo nuevo

1. Copiar `server/src/modules/zonas/` con el nombre del módulo.
2. `*.schemas.ts`: esquemas Zod de crear, actualizar, id y listar.
3. `*.service.ts`: lógica y consultas Prisma. Ningún módulo consulta tablas de otro: llama a su service.
4. `*.controller.ts`: valida con `.parse()` y arma la respuesta.
5. `*.routes.ts`: define las rutas.
6. Montarlo en `server/src/routes.ts` con una línea.
7. Documentar sus endpoints en este archivo.
