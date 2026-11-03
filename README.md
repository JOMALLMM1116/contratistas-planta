# Control Planta – Plataforma de Contratistas, Permisos de Trabajo y Acceso a Planta

Proyecto Final del curso **Desarrollo Web (036)** – Universidad Mariano Gálvez de Guatemala.
Caso asignado: **Proyecto B**.

Sistema para controlar el ingreso de contratistas a una instalación industrial: empresas, contratistas,
documentos y capacitaciones con vencimiento, solicitudes de acceso con evaluación de riesgo y
autorizaciones por etapas, permisos de trabajo, credenciales temporales con QR firmado, operación de
garita, incidentes, bloqueos, reportes y auditoría.

| Aplicación | URL |
|---|---|
| Aplicación Web (seguridad industrial, administración, responsables internos y garita) | https://planta.jomadev.online |
| PWA instalable (contratista y supervisor de campo) | https://planta.jomadev.online/pwa/ |
| Estado del servicio | https://planta.jomadev.online/api/health |

---

## Índice

- [Control Planta – Plataforma de Contratistas, Permisos de Trabajo y Acceso a Planta](#control-planta--plataforma-de-contratistas-permisos-de-trabajo-y-acceso-a-planta)
  - [Índice](#índice)
  - [1. Arquitectura](#1-arquitectura)
  - [2. Tecnologías](#2-tecnologías)
  - [3. Funcionalidades](#3-funcionalidades)
    - [3.1 Aplicación Web](#31-aplicación-web)
    - [3.2 PWA](#32-pwa)
    - [3.3 Reglas de negocio](#33-reglas-de-negocio)
  - [4. Credencial temporal y garita](#4-credencial-temporal-y-garita)
    - [Token](#token)
    - [Validación en garita](#validación-en-garita)
  - [5. Seguridad](#5-seguridad)
  - [6. Base de datos](#6-base-de-datos)
  - [7. Ejecución local](#7-ejecución-local)
    - [Requisitos](#requisitos)
    - [Pasos](#pasos)
  - [8. Usuarios de demostración](#8-usuarios-de-demostración)
  - [9. Pruebas automáticas](#9-pruebas-automáticas)
  - [10. Docker y registry](#10-docker-y-registry)
    - [Imagen](#imagen)
    - [Compose](#compose)
    - [Registry](#registry)
  - [11. CI/CD](#11-cicd)
  - [12. Producción](#12-producción)
  - [13. Estructura del repositorio](#13-estructura-del-repositorio)
  - [14. Dependencias y avisos conocidos](#14-dependencias-y-avisos-conocidos)
  - [15. Limitaciones conocidas](#15-limitaciones-conocidas)
  - [16. Documentación adicional](#16-documentación-adicional)

---

## 1. Arquitectura

**Monolito modular**: un solo proceso Node.js (Express 5 + TypeScript) que expone la API REST en `/api`,
sirve la Aplicación Web en `/` y la PWA en `/pwa`, todo desde el mismo dominio y la misma imagen Docker.

```
                Internet (HTTPS, Let's Encrypt)
                              │
                         ┌────▼────┐
                         │  nginx  │  reverse proxy (puertos 80 → 443)
                         └────┬────┘
                              │ http://127.0.0.1:3000
              ┌───────────────▼────────────────┐
              │   Contenedor "app" (Express 5)  │
              │   /api   → API REST (módulos)   │
              │   /      → Aplicación Web       │
              │   /pwa   → PWA + service worker │
              └───────────────┬────────────────┘
                              │ red interna de Docker
                     ┌────────▼────────┐
                     │ PostgreSQL 17   │  sin puertos publicados
                     └─────────────────┘
```

**Por qué un monolito modular:** el dominio está muy acoplado (una solicitud depende de documentos,
capacitaciones, zonas, permisos de trabajo y credenciales, y la validación en garita lo consulta todo en
una sola operación). Un monolito modular mantiene fronteras claras entre módulos sin la latencia ni los
problemas de consistencia de los microservicios, y simplifica Docker, CI/CD y el despliegue. Al servir
Web, PWA y API desde el mismo dominio no hay problemas de CORS ni de cookies entre subdominios.

**Regla del monolito:** cada módulo vive en `server/src/modules/<modulo>` con sus `routes`, `controller`,
`service` y `schemas` (Zod). Un módulo **no** consulta las tablas de otro: llama a su `service`.

---

## 2. Tecnologías

| Capa | Tecnologías |
|---|---|
| Backend | Node.js 24, TypeScript, Express 5, Zod 4, Prisma 7 (solo como cliente, con `@prisma/adapter-pg`), argon2id, jose (JWT), qrcode, pdfkit, exceljs, multer, nodemailer, node-cron, pino, helmet, cors, express-rate-limit, cookie-parser |
| Base de datos | PostgreSQL 17, migraciones SQL con **dbmate** |
| Aplicación Web | React 19, Vite 8, TypeScript, React Router 7, TanStack Query 5, React-Bootstrap + Bootstrap 5.3 (tema Sass propio, claro/oscuro), React Hook Form + Zod, lucide-react, Recharts, html5-qrcode |
| PWA | React 19, Vite 8, TypeScript, vite-plugin-pwa (Workbox), mismo tema y sesión que la Web |
| Pruebas | Vitest + Supertest contra la API y una base de datos real |
| Contenedores | Docker (Dockerfile multi-stage), Docker Compose |
| Registry | GitHub Container Registry (GHCR) |
| CI/CD | GitHub Actions |
| Nube | DigitalOcean (droplet con Docker Engine), nginx, Let's Encrypt (Certbot) |

---

## 3. Funcionalidades

### 3.1 Aplicación Web

| Área | Funcionalidad |
|---|---|
| Acceso | Inicio de sesión, recuperación y restablecimiento de contraseña por correo, menú según permisos, tema claro/oscuro |
| Inicio | Dashboard con datos reales y gráficas (para quien tiene permiso de reportes); bienvenida con accesos para los demás roles |
| Solicitudes | Lista con búsqueda, filtros y paginación; creación con contratistas, zonas y equipos; requisitos por contratista; evaluación de riesgo; autorizaciones por etapas; rechazo y cancelación con motivo |
| Credenciales | Emisión desde la solicitud aprobada (usos ilimitados, un solo ingreso u otra cantidad), QR, código corto, impresión de pase en PDF y revocación con motivo. Lista general con filtros por estado, contratista y solicitud, disponible también para garita (ver QR e imprimir pases) |
| Permisos de trabajo | Emisión desde solicitudes cuyo tipo de trabajo lo exige, detalle y revocación |
| Garita | Validación por cámara, código manual o lector USB; registro de entrada y salida; personas dentro por zona; movimientos con filtros |
| Personal | Empresas contratistas y contratistas |
| Cumplimiento | Documentos y capacitaciones con revisión y vencimientos |
| Seguridad | Incidentes (abierto → en investigación → cerrado) y bloqueos de contratistas o empresas |
| Administración | Reportes con exportación a Excel y PDF, auditoría e historial de estados, usuarios y roles |

### 3.2 PWA

| Funcionalidad | Detalle |
|---|---|
| Instalable | Manifest, íconos, service worker con alcance `/pwa/` y modo `standalone` |
| Acceso | Mismo inicio de sesión y misma sesión que la Web; el personal interno recibe un aviso para usar la Web |
| Mi credencial | Credenciales activas con su solicitud y zonas autorizadas; **QR a pantalla completa** (fondo blanco, código corto y la pantalla no se apaga mientras está abierto) |
| Solicitudes | Lista con filtro por estado y detalle: vigencia, horario, zonas, personas, equipos y **requisitos faltantes** de cada persona, con acceso directo a sus documentos |
| Documentos | Subir documentos con la **cámara** del teléfono o eligiendo un PDF o imagen; estado de revisión, motivo de rechazo y avisos de vencimiento |
| Permiso de trabajo | Desde el detalle de la solicitud: **checklist** de seguridad (cada contratista responde el suyo), **iniciar y cerrar la actividad** y **evidencias** con foto o archivo (inicio, durante y cierre) |
| Supervisor de campo | Ve las solicitudes, documentos y permisos de **su empresa** y puede responder el checklist de su cuadrilla |
| Navegación | Barra inferior tipo aplicación móvil (Mi credencial, Solicitudes, Documentos y Cuenta) y cierre de sesión |

### 3.3 Reglas de negocio

| Regla del enunciado | Cómo se cumple |
|---|---|
| No permitir acceso con documentos obligatorios vencidos | Función de base de datos `fn_requisitos_incumplidos`; se verifica al aprobar, al emitir la credencial y en cada validación de garita |
| No permitir un permiso fuera de su fecha y horario | Función `fn_permiso_vigente` (hora de Guatemala) |
| No permitir ingreso a zonas no autorizadas | Validación en garita y clave foránea compuesta `registros_acceso (solicitud_id, zona_id) → solicitud_zonas`: la base de datos impide registrar un acceso a una zona no autorizada |
| Registrar quién aprobó cada permiso | El usuario de cada acción sale **siempre de la sesión**, nunca del cuerpo de la petición |
| Mantener historial de cambios y revocaciones | Triggers que escriben `historial_estados`; la revocación exige quién, cuándo y motivo |
| Toda autorización verificable desde el backend | Cada ruta exige su permiso; la validación de la credencial se hace completa en el servidor |

---

## 4. Credencial temporal y garita

### Token

| Característica | Detalle |
|---|---|
| Formato | JWT firmado HS256 con audiencia `credencial` (distinta a la de la sesión) |
| Asociación | `jti` = id de la credencial, `sub` = contratista, e id de la solicitud |
| Expiración | Fin de la vigencia de la solicitud (fecha y hora fin, hora de Guatemala) |
| Código corto | 8 caracteres sin letras ni números confundibles, para escribir a mano |
| Usos | Ilimitados durante la vigencia, o un número máximo (al agotarse responde "ya utilizado") |
| Revocación | En cualquier momento antes del vencimiento, con motivo; su estado se guarda en la base de datos |

### Validación en garita

Cada lectura devuelve uno de estos resultados, evaluados en este orden:

`invalido` → `revocado` → `usado` → `vencido` → `bloqueado` → `documentos_vencidos` → `fuera_de_horario` → `zona_no_autorizada` → **`valido`**

- **Un QR aislado no es una autorización:** cada ingreso vuelve a consultar en el servidor el estado de la
  credencial, los bloqueos, los documentos, el horario y la zona.
- Validar no consume usos; **registrar la entrada** sí, con una actualización atómica (dos guardias a la
  vez no pueden usar el mismo último uso).
- La salida no exige credencial válida: nadie debe quedar sin poder salir.
- La pantalla de garita **falla cerrado**: si la respuesta del servidor no tiene el formato esperado, no se
  autoriza.
- Cada validación queda registrada; el pase temporal en PDF registra la impresión en auditoría.

---

## 5. Seguridad

| Control | Detalle |
|---|---|
| Contraseñas | Hash **argon2id** (parámetros OWASP); mínimo 8 caracteres con letra y número |
| Sesión | JWT de acceso (15 min) y refresh aleatorio (7 días) en cookies `HttpOnly`, `SameSite=Strict` y `Secure` en producción. En la base solo se guarda el hash del refresh. Nunca se guardan tokens en el almacenamiento del navegador |
| Rotación y robo de sesión | Cada renovación invalida el refresh anterior; si reaparece uno ya usado, se cierran todas las sesiones del usuario |
| Fuerza bruta | 5 intentos fallidos bloquean la cuenta 15 minutos; límite de intentos por IP en inicio de sesión y recuperación |
| Recuperación de contraseña | Token de un solo uso, 30 minutos, hash en la base; misma respuesta exista o no el correo; la pantalla borra el token de la barra de direcciones al leerlo |
| Permisos | Permiso por acción en cada ruta; cada acceso denegado queda en auditoría |
| **Autorización por objeto** (OWASP A01) | Además de la acción, se valida **sobre qué registros**: el personal interno ve todo según sus permisos; un supervisor de campo solo lo de su empresa; un contratista solo lo suyo. Un registro fuera de alcance responde `404` (no revela que existe) y crear a nombre de otro responde `403`. Se aplica a solicitudes, archivos, documentos, contratistas, equipos, empresas, permisos de trabajo y capacitaciones, con pruebas automáticas |
| Validaciones | Zod en el servidor y en los formularios |
| Auditoría | Tabla de **solo inserción** (triggers bloquean actualizar, borrar y truncar), con inicio y cierre de sesión, accesos denegados, emisiones, revocaciones, entradas, salidas, pases y cambios de usuarios |
| Archivos | Solo PDF, JPG y PNG; se verifica la firma real del archivo (no solo el tipo declarado), SHA-256 y nombres aleatorios en disco |
| HTTP | helmet (cabeceras y CSP), CORS con lista blanca, `trust proxy`, HTTPS obligatorio en nginx |
| PWA | El service worker solo guarda los archivos de la aplicación; **nunca** respuestas de `/api/` (sesiones, credenciales ni archivos privados) |
| Secretos | `.env` fuera de Git; en el servidor con permisos `600`; en GitHub como secretos cifrados |

---

## 6. Base de datos

- **PostgreSQL 17**. La fuente de verdad del modelo son las migraciones SQL de `db/migrations/`,
  aplicadas con **dbmate**.
- **Prisma se usa solo como cliente** (`prisma db pull` + `prisma generate`). No se usa `prisma migrate`
  ni `db push`, porque borrarían lo que Prisma no representa (índices parciales, triggers, funciones y vistas).
- Para cambiar el esquema se crea una **migración nueva**; nunca se edita una ya aplicada.

| Característica | Detalle |
|---|---|
| Claves | Catálogos con `integer` identidad; registros transaccionales con `uuid` |
| Integridad | Claves foráneas (incluidas compuestas), `CHECK` en todos los estados, índices únicos parciales (por ejemplo, una sola credencial activa por persona y solicitud) |
| Funciones | `fn_requisitos_incumplidos`, `fn_permiso_vigente`, `fn_contratista_bloqueado` |
| Triggers | Historial automático de estados (solicitud, permiso, credencial, incidente) e inmutabilidad de auditoría e historial |
| Vistas | Personas dentro de la instalación y documentos por vencer |
| Zona horaria | Reglas de horario y vencimiento en hora de Guatemala |
| Códigos | Automáticos: `SA-AAAA-00001` (solicitudes), `PT-AAAA-00001` (permisos), `INC-AAAA-00001` (incidentes) |

---

## 7. Ejecución local

### Requisitos

Git, Node.js 24, Docker Desktop (abierto) y un editor (VS Code).

### Pasos

Desde la raíz del repositorio, en PowerShell:

```powershell
# 1. Variables de entorno (usa tus propios valores; el .env nunca se sube a Git)
Copy-Item .env.example .env
#    Edita .env: POSTGRES_PASSWORD (la misma clave dentro de DATABASE_URL), JWT_SECRET (32 caracteres o más)
#    y DEMO_PASSWORD. El correo (SMTP) es opcional: sin él, los correos se escriben en el log.

# 2. Base de datos y migraciones
docker compose up -d
docker compose run --rm dbmate --wait up

# 3. Backend
npm --prefix server ci
npm --prefix server run db:generate
npm --prefix server run db:seed
npm --prefix server run db:seed:flujo
npm --prefix server run dev            # API en http://localhost:3000
```

En otras terminales:

```powershell
npm --prefix web ci
npm --prefix web run dev               # Web en http://localhost:5173

npm --prefix pwa ci
npm --prefix pwa run dev               # PWA en http://localhost:5174/pwa/
```

En desarrollo, Vite reenvía `/api` al backend, así que Web, PWA y API se comportan como en el mismo
dominio. Para probar la PWA como en producción (con service worker): compilar con
`npm --prefix pwa run build` y abrir `http://localhost:3000/pwa/` con el backend encendido.

Generar un `JWT_SECRET` aleatorio en PowerShell:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

---

## 8. Usuarios de demostración

El script `npm --prefix server run db:seed` crea **un usuario por rol** (administrador, seguridad
industrial, responsable interno, garita, supervisor de campo y contratista), una empresa y un contratista
de demostración. Todos usan la contraseña definida en la variable **`DEMO_PASSWORD`** del `.env`: quien
quiera probar el sistema en su equipo debe poner **su propia contraseña** en esa variable antes de
ejecutar el seed.

`npm --prefix server run db:seed:flujo` agrega una solicitud aprobada con documentos y capacitación al
día, lista para emitir la credencial y probar la garita.

Los accesos al entorno de producción se entregan por separado.

| Rol | Aplicación | Puede, entre otras cosas |
|---|---|---|
| Administrador | Web | Todo, incluidos usuarios y roles |
| Seguridad industrial | Web | Revisar documentos, evaluar riesgos, autorizar, emitir y revocar permisos y credenciales, bloqueos, incidentes, reportes y auditoría |
| Responsable interno | Web | Crear y autorizar solicitudes, reportar incidentes, reportes |
| Garita | Web | Validar credenciales, registrar entradas y salidas, imprimir pases, ver personas dentro |
| Supervisor de campo | PWA | Lo de su empresa: solicitudes, documentos, checklist, actividad y evidencias |
| Contratista | PWA | Lo suyo: su credencial con QR, documentos, checklist, actividad y evidencias |

---

## 9. Pruebas automáticas

```powershell
cd server
npm test
```

- **55 pruebas** en 7 archivos (Vitest + Supertest) contra la API y una base de datos real.
- Requieren las migraciones aplicadas y los dos seeds.
- Cubren autenticación y sesión, credenciales y garita, usuarios, auditoría, incidentes, bloqueos,
  vencimientos y **autorización por objeto** (con una segunda empresa creada solo para la prueba y
  eliminada al terminar).
- Al ejecutarlas en local se revocan las credenciales activas del contratista de demostración (las
  pruebas preparan un escenario limpio); se puede emitir otra desde la Web.

---

## 10. Docker y registry

### Imagen

`Dockerfile` multi-stage que produce **una sola imagen** con el backend, la Web y la PWA:

| Etapa | Qué hace |
|---|---|
| `deps` | Dependencias del backend |
| `build` | Cliente de Prisma y compilación de TypeScript |
| `prod-deps` | Solo dependencias de producción |
| `web-build` | Compila la Aplicación Web |
| `pwa-build` | Compila la PWA (manifest y service worker) |
| `runtime` | `node:24-bookworm-slim`, usuario sin privilegios (`node`), `HEALTHCHECK` a `/api/health` |

### Compose

| Archivo | Uso |
|---|---|
| `docker-compose.yml` | Desarrollo: PostgreSQL 17 y dbmate (perfil `tools`) |
| `docker-compose.prod.yml` | Producción: `postgres` (sin puertos publicados), `migrate` (dbmate aplica migraciones y termina) y `app` (escucha solo en `127.0.0.1:3000`, detrás de nginx) |

### Registry

Imágenes en **GitHub Container Registry**: `ghcr.io/jomallmm1116/contratistas-planta`.

| Etiqueta | Significado |
|---|---|
| `sha-xxxxxxx` | Versión exacta de cada commit (la que se despliega) |
| `develop` | Última versión de la rama `develop` |
| `latest` | Última versión de la rama `main` |

---

## 11. CI/CD

Archivo `.github/workflows/ci-cd.yml` (GitHub Actions), en cada *pull request* y *push* a `develop` y `main`:

| Job | Cuándo | Qué hace |
|---|---|---|
| `pruebas` | PR y push | PostgreSQL de servicio, dependencias, cliente de Prisma, `typecheck`, migraciones con dbmate, seeds y pruebas |
| `imagen` | Solo push, si pasan las pruebas | Construye la imagen (con caché) y la publica en GHCR con sus etiquetas |
| `desplegar` | Solo push, si se publicó la imagen | Por SSH copia el compose y las migraciones, fija la versión exacta en el `.env` del servidor, descarga la imagen, aplica migraciones, reinicia la aplicación, espera a que responda y verifica el sitio público con HTTPS |

**Flujo de un cambio hasta producción:** rama `feature/...` desde `develop` → pull request → pruebas en
verde → merge → el pipeline publica la imagen y despliega en producción en pocos minutos.

Ramas: `main` (producción final) y `develop` (integración), ambas protegidas: solo se integran por pull request.

---

## 12. Producción

| Elemento | Detalle |
|---|---|
| Servidor | Droplet de DigitalOcean con Docker Engine |
| Entrada | nginx como reverse proxy hacia `127.0.0.1:3000`, redirección permanente de HTTP a HTTPS |
| Certificado | Let's Encrypt (Certbot) con renovación automática |
| Firewall | Solo SSH, HTTP y HTTPS |
| Datos | Volúmenes de Docker para PostgreSQL y para los archivos subidos |
| Reinicio | Los contenedores se levantan solos tras reiniciar el servidor |

---

## 13. Estructura del repositorio

```
contratistas-planta/
├── .github/workflows/ci-cd.yml    Pipeline: pruebas → imagen → despliegue
├── db/migrations/                 Migraciones SQL (fuente de verdad del modelo)
├── docs/                          Enunciado, herramientas, contrato de la API y diagramas (docs/diagramas)
├── server/                        Backend (Express 5 + TypeScript)
│   ├── prisma/schema.prisma       Generado por introspección de la base
│   ├── src/modules/               Un módulo por área: auth, usuarios, roles, empresas-contratistas,
│   │                              contratistas, equipos, archivos, documentos, tipos-documento,
│   │                              capacitaciones, contratista-capacitaciones, zonas, tipos-trabajo,
│   │                              requisitos-tipo-trabajo, checklist-plantillas, solicitudes,
│   │                              permisos-trabajo, credenciales, garita, incidentes, bloqueos,
│   │                              notificaciones, reportes, auditoria
│   ├── src/shared/                Configuración, base de datos, errores, middlewares, seguridad, auditoría
│   ├── src/scripts/               Seeds de demostración
│   └── tests/                     Pruebas automáticas
├── web/                           Aplicación Web (React + Vite)
├── pwa/                           PWA (React + Vite + vite-plugin-pwa)
├── Dockerfile                     Imagen única: backend, Web y PWA
├── docker-compose.yml             Desarrollo
├── docker-compose.prod.yml        Producción
└── .env.example                   Plantilla de variables de entorno
```

---

## 14. Dependencias y avisos conocidos

| Proyecto | Estado |
|---|---|
| Backend | `npm audit` sin vulnerabilidades. Se fuerzan versiones seguras con `overrides` en `server/package.json`: `uuid` dentro de `exceljs` y `minimatch` (aviso GHSA-g3hv-75wg-m249) |
| Web | Sin vulnerabilidades |
| PWA | `npm audit --omit=dev`: **0** (lo que llega al navegador). `npm audit` completo muestra avisos moderados y bajos en la cadena `vite-plugin-pwa → workbox-build` (`deepmerge`, `glob`, `minimatch`, `ejs`), herramientas que **solo se usan al compilar** y no forman parte de la imagen final. La "solución" automática bajaría `vite-plugin-pwa` a una versión antigua con cambios incompatibles, por eso no se aplica |

---

## 15. Limitaciones conocidas

| Limitación | Mitigación actual |
|---|---|
| No hay token CSRF adicional | Cookies `HttpOnly` con `SameSite=Strict`, CORS con lista blanca y API bajo el mismo dominio |
| Un token de acceso ya emitido sigue siendo válido hasta 15 minutos después de cerrar sesión o cambiar la contraseña | Vida corta del token de acceso; el refresh sí se revoca de inmediato |
| Cuando un administrador cierra las sesiones de un usuario, el siguiente intento de renovación de ese usuario se registra en auditoría como `REFRESH_REUTILIZADO` | El resultado es el correcto (debe volver a iniciar sesión); solo la etiqueta del evento es imprecisa |
| Después de un despliegue que cambia el contenido de la sesión, quien tenía la sesión abierta puede ver listas vacías hasta renovarla | Volver a iniciar sesión (como máximo 15 minutos) |
| Sin cola de sincronización offline | El service worker guarda la aplicación para abrirla sin red; las operaciones requieren conexión |
| Instalación de la PWA en Android | Probada con **Google Chrome** |

---

## 16. Documentación adicional

| Documento | Contenido |
|---|---|
| [`docs/diagramas/arquitectura.md`](docs/diagramas/arquitectura.md) | **Diagrama de arquitectura**: componentes, despliegue y capas del monolito |
| [`docs/diagramas/modelo-datos.md`](docs/diagramas/modelo-datos.md) | **Modelo de base de datos**: diagrama entidad-relación por áreas, claves compuestas, funciones y vistas |
| [`docs/diagramas/flujo-garita.md`](docs/diagramas/flujo-garita.md) | Flujo de acceso: solicitud, credencial, QR en la PWA y validación en garita |
| [`docs/diagramas/ci-cd.md`](docs/diagramas/ci-cd.md) | Pipeline de CI/CD hasta producción |
| `docs/Proyecto_Final_Desarrollo_Web_Proyecto_B.md` | Enunciado del proyecto |
| `docs/Herramientas_Proyecto_B.md` | Herramientas planificadas por área |
| `docs/api.md` | Contrato de la API (formato de respuestas, errores y módulos) |

Los diagramas están escritos en Mermaid: GitHub los dibuja al abrir cada archivo.

Formato común de la API:

```json
{ "datos": { } }
{ "datos": [ ], "meta": { "total": 42, "pagina": 1, "por_pagina": 20, "total_paginas": 3 } }
{ "error": { "code": "VALIDACION", "message": "Los datos enviados no son validos", "detalles": [ ] } }
```
