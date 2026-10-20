# PROYECTO FINAL – DESARROLLO WEB

**Universidad Mariano Gálvez de Guatemala | Desarrollo Web**

**Valor:** 20 puntos | **Fecha:** Martes 03 de noviembre
**Tecnología y lenguaje de programación:** LIBRE

> **Propósito.** El proyecto final debe demostrar que el estudiante puede diseñar, construir, asegurar, contenerizar y desplegar una solución de software completa. No se calificará un lenguaje específico; se calificará la arquitectura, la funcionalidad, la seguridad, la calidad técnica, el uso de contenedores, la automatización y el despliegue real en nube.

| Elemento | Requisito |
|---|---|
| Modalidades | Aplicación Web + PWA instalable |
| Infraestructura | Docker + Registry + despliegue real en nube |
| Seguridad | Autenticación, roles/permisos, tokens, secretos, auditoría |
| Integración | Arquitectura libre: REST, MVC, GraphQL, gRPC, servicios, monolito modular u otra justificada |

---

## 1. Reglas generales del proyecto

- Cada equipo seleccionará uno de los tres casos propuestos. *(Caso asignado: **Proyecto B**).*
- El lenguaje y framework son libres. La elección deberá justificarse técnicamente.
- La solución deberá incluir una Aplicación Web y una PWA instalable, ambas integradas al mismo sistema y utilizando la misma información central.
- No es obligatorio utilizar una API REST. Se permite cualquier arquitectura coherente con el problema.
- La solución deberá utilizar una base de datos persistente y un modelo relacional correctamente diseñado.
- Los componentes que lo permitan deberán estar contenerizados.
- La solución deberá estar publicada en un entorno real de nube utilizando una estrategia de despliegue coherente con la arquitectura seleccionada.
- No se aceptará como entrega final una solución que funcione únicamente en localhost o Docker Desktop.
- El sistema deberá incluir seguridad, control de acceso, auditoría y al menos un caso real de token de validación.
- Durante la defensa se solicitará un cambio pequeño que deberá llegar a producción mediante el flujo de CI/CD.

---

## Proyecto B – Plataforma de Contratistas, Permisos de Trabajo y Acceso a Planta

### Descripción

Una planta industrial, empresa de energía, centro logístico o instalación crítica recibe diariamente contratistas y personal externo. Antes de ingresar, cada persona debe cumplir requisitos, capacitaciones, documentos y autorizaciones. Además, ciertos trabajos requieren permisos temporales y validaciones adicionales.

### Escenario

Un contratista solicita acceso para ejecutar una actividad específica. El sistema debe verificar documentos vigentes, capacitaciones, empresa contratista, responsable interno, equipo asignado y permiso de trabajo. Al aprobarse, se genera una credencial temporal o token de acceso que puede validarse en la entrada de la instalación.

### Módulos mínimos

- Usuarios, roles y permisos
- Empresas contratistas
- Contratistas / técnicos
- Documentos y vencimientos
- Capacitaciones y certificaciones
- Solicitudes de acceso
- Áreas o zonas de planta
- Permisos de trabajo
- Evaluación de riesgos
- Equipos y herramientas
- Autorizaciones
- Credenciales temporales
- Ingresos y salidas
- Incidentes
- Notificaciones
- Reportes
- Auditoría

### Aplicación Web

Orientada a seguridad industrial, administración y responsables internos.

- Registrar empresas y contratistas.
- Revisar y aprobar documentos.
- Crear requisitos por tipo de trabajo.
- Autorizar solicitudes de acceso.
- Emitir permisos de trabajo.
- Consultar personas dentro de la instalación.
- Bloquear accesos por documentos vencidos o incidencias.
- Consultar historial por empresa o contratista.
- Gestionar incidentes y auditoría.

La aplicación Web también deberá cubrir la **operación de garita o recepción**: validar credenciales/QR, registrar entradas y salidas, revisar restricciones e imprimir pases temporales cuando corresponda.

### PWA

Orientada al contratista y al supervisor de campo.

- Consultar requisitos y estado de solicitud.
- Subir documentos o fotografías.
- Completar checklist previo al trabajo.
- Presentar credencial o QR temporal.
- Confirmar inicio y cierre de actividad.
- Registrar evidencias de trabajo.
- Recibir alertas por documentos próximos a vencer.

### Reglas de negocio obligatorias

- No permitir acceso si existen documentos obligatorios vencidos.
- No permitir un permiso fuera de su fecha y horario de vigencia.
- No permitir ingreso a zonas no autorizadas.
- Registrar quién aprobó cada permiso.
- Mantener historial de cambios y revocaciones.
- Toda autorización debe ser verificable desde el backend.

### Uso de tokens

- Credencial temporal mediante QR o token firmado.
- El token deberá tener fecha/hora de expiración.
- Debe asociarse a una persona y solicitud específica.
- Puede revocarse antes del vencimiento.
- La validación deberá responder si el acceso es **válido, vencido, revocado o ya utilizado** según la regla del proyecto.

---

## Requisitos técnicos comunes obligatorios

### 5.1 Aplicación Web

- Autenticación y autorización.
- Dashboard con datos reales.
- CRUD de módulos principales.
- Búsquedas, filtros y paginación.
- Validaciones de formularios.
- Reportes y exportación cuando aplique.
- Diseño responsive.
- Manejo adecuado de errores.

### 5.2 PWA

- Manifest válido.
- Service Worker.
- Iconos.
- Instalación como aplicación.
- Modo standalone.
- Diseño responsive.
- Publicación en una URL real.
- Debe ejecutar al menos una operación de negocio real.
- Se valorará funcionamiento offline o cola de sincronización en los casos donde tenga sentido.

### 5.3 Seguridad

- Autenticación.
- Roles y permisos.
- Contraseñas con hash.
- Protección de rutas y operaciones.
- Control de sesión.
- Recuperación de contraseña o mecanismo equivalente.
- Validaciones del lado servidor.
- HTTPS.
- Auditoría.
- Al menos un caso real de token con expiración.

### 5.4 Base de datos

- Primary Keys y Foreign Keys.
- Integridad referencial.
- Índices relevantes.
- Restricciones.
- Tipos de datos apropiados.
- Relaciones no triviales.
- Modelo coherente con el dominio seleccionado.

### 5.5 Archivos

- El sistema debe manejar archivos o evidencias reales.
- La estrategia puede utilizar filesystem, object storage o servicio equivalente.
- Las credenciales de almacenamiento no deben quedar hardcodeadas.

### 5.6 Docker

- Dockerfile para los servicios que correspondan.
- `docker-compose.yml` para levantar el entorno de desarrollo o integración.
- Imágenes versionadas.
- Publicación en un registry.

### 5.7 Nube y producción

- Deploy real en Azure, AWS, DigitalOcean, Google Cloud u otro proveedor. Puede utilizarse una VM, PaaS, servicio administrado de contenedores o arquitectura equivalente; Kubernetes no es requisito.
- Acceso público por Internet.
- HTTPS con certificado válido.
- No se aceptará únicamente localhost o Docker Desktop.

### 5.8 CI/CD

- Pipeline con build y pruebas.
- Construcción de imagen.
- Publicación en registry.
- Despliegue o actualización automatizada.
- Durante la defensa se solicitará un cambio pequeño que deberá llegar a producción.

---

## Tecnologías permitidas

El lenguaje de programación no forma parte de la calificación. Se permite cualquier stack técnicamente adecuado.

| Área | Ejemplos permitidos |
|---|---|
| Backend/Web | .NET, Java, Python, Node.js/TypeScript, PHP, Ruby u otro |
| Frontend/PWA | React, Angular, Vue, Blazor, Svelte u otro |
| Base de datos | SQL Server, PostgreSQL, MySQL/MariaDB u otra justificada |

La arquitectura también es libre. Puede utilizar REST, GraphQL, gRPC, MVC tradicional, monolito modular, microservicios, BFF u otra aproximación. El equipo deberá justificar su decisión.

---

## Entregables

- Repositorio Git con código fuente.
- README con instrucciones de ejecución.
- Diagrama de arquitectura.
- Modelo de base de datos.
- Aplicación Web publicada.
- PWA publicada e instalable.
- Dockerfiles y `docker-compose.yml`.
- Imágenes publicadas en registry.
- Pipeline CI/CD.
- URL o URLs de producción.
- Usuario de demostración por rol.
- Evidencia de auditoría, logs y seguridad.

---

## Defensa y demostración

1. Mostrar login y control de permisos.
2. Ejecutar un flujo de negocio completo del proyecto elegido.
3. Instalar y utilizar la PWA.
4. Mostrar persistencia real en base de datos.
5. Mostrar contenedores e imágenes en registry.
6. Mostrar la aplicación desde su URL pública con HTTPS.
7. Mostrar auditoría y/o logs.
8. Realizar un cambio solicitado por el docente y desplegarlo mediante CI/CD.

---

## 9. Rúbrica de evaluación – 20 puntos

| Criterio | Puntos |
|---|---:|
| Funcionalidad y complejidad de módulos | 3.0 |
| Aplicación Web | 3.0 |
| PWA publicada e instalable | 3.0 |
| Base de datos y modelo de información | 1.5 |
| Seguridad, roles, permisos y tokens | 3.0 |
| Docker + Compose + Registry | 2.0 |
| Deploy real + HTTPS | 2.0 |
| CI/CD y actualización | 1.0 |
| Auditoría, archivos, validaciones y logs | 1.0 |
| Documentación y defensa | 0.5 |
| **TOTAL** | **20.0** |

> **Nota final:** se evaluará la capacidad de integrar una solución Web + PWA completa y operativa. El proyecto no se considera terminado únicamente porque compile; debe ejecutarse, estar asegurado, contenerizado cuando corresponda, desplegado y demostrarse en producción.
