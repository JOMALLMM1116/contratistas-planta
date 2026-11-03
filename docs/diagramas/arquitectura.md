# Diagrama de arquitectura

Monolito modular: un solo contenedor Express sirve la API (`/api`), la Aplicación Web (`/`) y la PWA
(`/pwa`), detrás de nginx con HTTPS, y usa PostgreSQL en la red interna de Docker.

```mermaid
flowchart LR
    subgraph Usuarios["Usuarios"]
        WEB["Navegador<br/>Aplicación Web<br/>(seguridad, administración, garita)"]
        PWA["Teléfono<br/>PWA instalada<br/>(contratista y supervisor)"]
    end

    subgraph Servidor["Droplet DigitalOcean (Docker Engine)"]
        NGINX["nginx<br/>reverse proxy<br/>HTTPS Let's Encrypt"]

        subgraph APP["Contenedor app (Node 24 + Express 5)"]
            API["/api<br/>API REST<br/>módulos del monolito"]
            WEBDIST["/<br/>Aplicación Web<br/>(web/dist)"]
            PWADIST["/pwa<br/>PWA + service worker<br/>(pwa/dist)"]
        end

        MIGRATE["Contenedor migrate<br/>dbmate --wait up<br/>(termina al aplicar)"]
        DB[("PostgreSQL 17<br/>sin puertos publicados")]
        VOLPG[("Volumen pgdata")]
        VOLUP[("Volumen uploads<br/>documentos y evidencias")]
    end

    GHCR["GitHub Container Registry<br/>ghcr.io/jomallmm1116/contratistas-planta"]
    SMTP["Servidor SMTP<br/>recuperación de contraseña<br/>y notificaciones"]

    WEB -- "HTTPS 443" --> NGINX
    PWA -- "HTTPS 443" --> NGINX
    NGINX -- "http://127.0.0.1:3000" --> APP
    API -- "Prisma (cliente)" --> DB
    API -- "archivos" --> VOLUP
    DB --- VOLPG
    MIGRATE -- "migraciones SQL" --> DB
    API -- "correo" --> SMTP
    GHCR -- "docker compose pull" --> APP
```

## Componentes

| Componente | Responsabilidad |
|---|---|
| nginx | Única entrada pública; redirige HTTP a HTTPS y reenvía todo a la aplicación en `127.0.0.1:3000` |
| Contenedor `app` | Monolito modular: API REST, Aplicación Web y PWA en el mismo dominio (sin CORS ni problemas de cookies) |
| Contenedor `migrate` | Aplica las migraciones pendientes antes de iniciar la aplicación y termina |
| PostgreSQL | Base de datos; solo accesible desde la red interna de Docker |
| Volúmenes | `pgdata` (datos) y `uploads` (documentos y evidencias) sobreviven a reinicios y despliegues |
| GHCR | Guarda las imágenes versionadas que publica el pipeline |

## Capas dentro del monolito

```mermaid
flowchart TB
    RUTA["routes<br/>(permiso por acción)"] --> CTRL["controller<br/>(Zod + alcance de la sesión)"]
    CTRL --> SERV["service<br/>(reglas de negocio)"]
    SERV --> OTRO["service de otro módulo<br/>(nunca sus tablas)"]
    SERV --> PRISMA["Prisma / SQL"]
    PRISMA --> BD[("PostgreSQL<br/>funciones, triggers, vistas")]
```
