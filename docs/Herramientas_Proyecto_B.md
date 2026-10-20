# Herramientas del Proyecto Final – Proyecto B

**Plataforma de Contratistas, Permisos de Trabajo y Acceso a Planta**
Universidad Mariano Gálvez de Guatemala | Desarrollo Web | Entrega: martes 03 de noviembre

> Documento de referencia: `Proyecto_Final_Desarrollo_Web_Proyecto_B.md`
> Decisiones fijas: **PostgreSQL** como base de datos, **sin PHP ni C#**, arquitectura **monolito modular**.

---

## 1. Decisión de arquitectura

| Aspecto | Decisión |
|---|---|
| Arquitectura | Monolito modular (un solo proceso Node.js) |
| Lenguaje único | TypeScript en backend, Aplicación Web y PWA |
| API | REST interna bajo `/api` |
| Aplicación Web | Servida por el monolito en `/` |
| PWA | Servida por el monolito en `/pwa` (manifest y Service Worker con *scope* `/pwa/`) |
| Contenedores en producción | `app` (monolito) + `postgres` |
| Imagen Docker | Una sola, construida con Dockerfile multi-stage |

**Justificación:** el dominio está fuertemente acoplado (una solicitud depende de documentos, capacitaciones, zonas, permisos de trabajo y credenciales, y la validación en garita consulta todo en una sola transacción). Un monolito modular mantiene fronteras claras entre módulos sin la latencia ni los problemas de consistencia de los microservicios, y simplifica Docker, CI/CD y el cambio en vivo de la defensa. Al servir todo desde el mismo dominio se evitan problemas de CORS y de cookies entre subdominios.

---

## 2. Entorno de desarrollo

| Herramienta | Uso |
|---|---|
| Node.js LTS (24) | Entorno de ejecución |
| TypeScript | Lenguaje de todo el proyecto |
| npm | Gestor de paquetes |
| VS Code | Editor |
| Git + GitHub | Control de versiones y repositorio |
| Docker Desktop / WSL | Contenedores en desarrollo |
| Insomnia | Pruebas manuales de la API |

---

## 3. Base de datos

| Herramienta | Uso | Requisito que cubre |
|---|---|---|
| PostgreSQL (17 o 18) | Motor de base de datos relacional | 5.4 Base de datos |
| Prisma ORM | Modelo, migraciones, PK/FK, índices, restricciones | 5.4 Base de datos |
| DBeaver o pgAdmin | Administración y evidencia de persistencia | Defensa punto 4 |

---

## 4. Backend (monolito Express)

| Herramienta | Uso | Requisito que cubre |
|---|---|---|
| Express 5 | Servidor HTTP, API y entrega de los frontends | Arquitectura |
| Zod | Validaciones del lado servidor | 5.3 Seguridad |
| argon2 (o bcrypt) | Hash de contraseñas | 5.3 Seguridad |
| jose (o jsonwebtoken) | JWT de sesión y token firmado de la credencial temporal | Uso de tokens / 5.3 |
| qrcode | Generación del QR de la credencial | Uso de tokens |
| helmet | Cabeceras de seguridad HTTP | 5.3 Seguridad (OWASP) |
| cors | Control de orígenes | 5.3 Seguridad |
| express-rate-limit | Limitar intentos de login y validación | 5.3 Seguridad |
| cookie-parser | Manejo de la sesión en cookie `HttpOnly` | Control de sesión |
| multer | Carga de documentos y fotografías | 5.5 Archivos |
| pino | Logs estructurados | Auditoría y logs |
| nodemailer | Recuperación de contraseña y notificaciones | 5.3 / Notificaciones |
| node-cron | Revisión de documentos próximos a vencer | Alertas de vencimiento |
| exceljs | Exportación de reportes a Excel | 5.1 Reportes |
| pdfkit | Reportes en PDF e impresión de pases temporales | 5.1 Reportes / Garita |
| dotenv | Carga de variables de entorno | Secretos fuera del código |

### Estados de validación del token

La credencial temporal se valida en el backend y responde uno de estos estados: **válido**, **vencido**, **revocado** o **ya utilizado**. El token firmado lleva expiración y un identificador (`jti`) asociado a una persona y a una solicitud; su estado se guarda en la base de datos para permitir la revocación.

---

## 5. Aplicación Web (seguridad industrial, administración y garita)

| Herramienta | Uso | Requisito que cubre |
|---|---|---|
| React + Vite + TypeScript | Interfaz de la aplicación | 5.1 Aplicación Web |
| React Router | Rutas protegidas por rol | 5.1 / 5.3 |
| TanStack Query | Consumo de la API con caché | 5.1 |
| React Hook Form + Zod | Validación de formularios | 5.1 Validaciones |
| React-Bootstrap + Bootstrap 5 | Componentes y diseño responsive | 5.1 Responsive |
| TanStack Table | Búsquedas, filtros y paginación | 5.1 |
| Recharts | Gráficas del dashboard | 5.1 Dashboard |
| html5-qrcode | Escaneo del QR en garita con la cámara | Operación de garita |

---

## 6. PWA (contratista y supervisor de campo)

| Herramienta | Uso | Requisito que cubre |
|---|---|---|
| React + Vite + TypeScript | Interfaz de la PWA | 5.2 PWA |
| vite-plugin-pwa (Workbox) | Manifest, Service Worker, iconos y modo standalone | 5.2 PWA |
| Dexie (IndexedDB) | Cola offline del checklist y evidencias, con sincronización | 5.2 Offline (valorado) |
| `<input type="file" capture>` | Captura de fotos desde el teléfono | Evidencias de trabajo |
| React-Bootstrap + Bootstrap 5 | Diseño responsive móvil | 5.2 Responsive |

---

## 7. Archivos y evidencias

| Herramienta | Uso | Requisito que cubre |
|---|---|---|
| Volumen de Docker en el droplet | Almacenamiento en filesystem de documentos y fotos | 5.5 Archivos |
| DigitalOcean Spaces (opcional) | Object storage compatible con S3 | 5.5 Archivos |
| Variables de entorno / GitHub Secrets | Credenciales fuera del código | 5.5 Sin hardcode |

---

## 8. Pruebas

| Herramienta | Uso | Requisito que cubre |
|---|---|---|
| Vitest | Pruebas unitarias de servicios y reglas de negocio | 5.8 Pruebas |
| Supertest | Pruebas de endpoints (login, validación del token) | 5.8 Pruebas |
| Insomnia | Pruebas manuales y colección de la API | Documentación |

---

## 9. Docker y registry

| Herramienta | Uso | Requisito que cubre |
|---|---|---|
| Docker | Contenerización | 5.6 Docker |
| Dockerfile multi-stage | Compila web, PWA y servidor en una sola imagen | 5.6 Dockerfile |
| Docker Compose | Levanta `app` + `postgres` en desarrollo y producción | 5.6 Compose |
| Docker Hub (o GitHub Container Registry) | Publicación de imágenes versionadas por tag o SHA | 5.6 Registry |

---

## 10. Nube y producción

| Herramienta | Uso | Requisito que cubre |
|---|---|---|
| DigitalOcean (droplet con Docker Engine) | Servidor en la nube | 5.7 Deploy real |
| Dominio propio | URL pública del sistema | 5.7 Acceso público |
| nginx | Reverse proxy hacia el contenedor `app` | 5.7 |
| Let's Encrypt / Certbot | Certificado HTTPS válido | 5.7 HTTPS |

---

## 11. CI/CD

| Herramienta | Uso | Requisito que cubre |
|---|---|---|
| GitHub Actions | Pipeline automatizado | 5.8 CI/CD |
| Etapas del pipeline | Instalar → compilar → probar → construir imagen → publicar en registry → desplegar | 5.8 CI/CD |
| Despliegue por SSH | `docker compose pull && docker compose up -d` en el droplet | 5.8 Actualización automatizada |

---

## 12. Documentación y diseño

| Herramienta | Uso | Entregable |
|---|---|---|
| draw.io o Eraser | Diagrama de arquitectura | Diagrama de arquitectura |
| DBeaver / Prisma | Diagrama entidad-relación | Modelo de base de datos |
| Figma | Mockups de la Web y la PWA | Diseño de interfaz |
| README.md | Instrucciones, URLs y usuarios de demostración por rol | README |

---

## 13. Estructura del repositorio

```
contratistas-planta/
├── server/                 # Monolito Express (TypeScript)
│   ├── src/
│   │   ├── modules/        # Un módulo por área del dominio
│   │   │   ├── auth/
│   │   │   ├── usuarios/
│   │   │   ├── empresas/
│   │   │   ├── contratistas/
│   │   │   ├── documentos/
│   │   │   ├── capacitaciones/
│   │   │   ├── solicitudes/
│   │   │   ├── zonas/
│   │   │   ├── permisos-trabajo/
│   │   │   ├── riesgos/
│   │   │   ├── equipos/
│   │   │   ├── credenciales/
│   │   │   ├── accesos/    # Ingresos y salidas (garita)
│   │   │   ├── incidentes/
│   │   │   ├── notificaciones/
│   │   │   ├── reportes/
│   │   │   └── auditoria/
│   │   ├── shared/         # Middlewares, errores, logger, config
│   │   └── app.ts
│   ├── prisma/schema.prisma
│   └── tests/
├── web/                    # React + Vite (admin, seguridad, garita)
├── pwa/                    # React + Vite + vite-plugin-pwa
├── Dockerfile              # Multi-stage: compila web, pwa y server
├── docker-compose.yml      # app + postgres
└── .github/workflows/deploy.yml
```

Cada módulo contiene sus `routes`, `controller`, `service` y `schemas` (Zod). Regla del monolito modular: un módulo no consulta directamente las tablas de otro, sino que llama a su `service`.
