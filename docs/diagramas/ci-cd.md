# Diagrama de CI/CD

Pipeline de GitHub Actions (`.github/workflows/ci-cd.yml`). Un cambio llega a producción solo por
pull request y con todas las pruebas en verde.

```mermaid
flowchart TD
    DEV["Rama feature/...<br/>creada desde develop"] --> PR["Pull request<br/>hacia develop o main"]
    PR --> P1

    subgraph PRUEBAS["Job 1: pruebas (en PR y en push)"]
        P1["PostgreSQL 17 de servicio"] --> P2["npm ci"]
        P2 --> P3["prisma generate"]
        P3 --> P4["typecheck"]
        P4 --> P5["Migraciones con dbmate"]
        P5 --> P6["Seeds de demostración"]
        P6 --> P7["Vitest + Supertest"]
    end

    P7 -->|"falla"| ROJO["PR en rojo:<br/>no se integra"]
    P7 -->|"pasa"| MERGE["Merge a develop o main<br/>(evento push)"]

    MERGE --> I1

    subgraph IMAGEN["Job 2: imagen (solo push)"]
        I1["Docker Buildx con caché"] --> I2["Imagen multi-stage:<br/>backend + Web + PWA"]
        I2 --> I3["Publicar en GHCR<br/>sha-xxxxxxx · develop · latest"]
    end

    I3 --> D1

    subgraph DESPLIEGUE["Job 3: desplegar (solo push, uno a la vez)"]
        D1["SSH al droplet"] --> D2["Copiar docker-compose.prod.yml<br/>y migraciones"]
        D2 --> D3["APP_TAG=sha-xxxxxxx<br/>en el .env del servidor"]
        D3 --> D4["docker compose pull app"]
        D4 --> D5["docker compose up -d<br/>(migrate y reinicio)"]
        D5 --> D6{"¿/api/health responde<br/>en 60 s?"}
        D6 -->|"no"| D7["Mostrar logs<br/>y marcar error"]
        D6 -->|"sí"| D8["docker image prune"]
    end

    D8 --> V["Verificar<br/>https://planta.jomadev.online/api/health"]
    V --> OK["Versión en producción"]
```

| Etiqueta de la imagen | Significado |
|---|---|
| `sha-xxxxxxx` | Versión exacta de cada commit (la que se despliega y queda en el `.env` del servidor) |
| `develop` | Última versión de la rama `develop` |
| `latest` | Última versión de la rama `main` |
