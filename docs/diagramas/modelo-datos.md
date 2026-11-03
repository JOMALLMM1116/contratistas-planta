# Modelo de datos

Diagrama entidad-relación de PostgreSQL, obtenido del esquema real (`server/prisma/schema.prisma`,
generado por introspección de las migraciones de `db/migrations/`). Se divide por áreas para que sea
legible; las tablas que aparecen en más de un área son las mismas.

Convenciones: catálogos con clave `int` (identidad) y registros transaccionales con `uuid`; estados como
texto con `CHECK`; fechas `timestamptz` (o `date` / `time` donde corresponde).

## 1. Seguridad y usuarios

```mermaid
erDiagram
    roles ||--o{ rol_permisos : "tiene"
    permisos ||--o{ rol_permisos : "asignado en"
    roles ||--o{ usuarios : "rol de"
    empresas_contratistas |o--o{ usuarios : "externos de"
    usuarios ||--o{ sesiones : "abre"
    usuarios ||--o{ tokens_recuperacion_password : "solicita"
    usuarios |o--o| contratistas : "cuenta de"

    roles {
        int id PK
        varchar codigo UK
        varchar nombre
        boolean es_interno
    }
    permisos {
        int id PK
        varchar codigo UK
    }
    rol_permisos {
        int rol_id PK,FK
        int permiso_id PK,FK
    }
    usuarios {
        uuid id PK
        citext email UK
        text password_hash
        int rol_id FK
        uuid empresa_id FK
        boolean activo
        smallint intentos_fallidos
        timestamptz bloqueado_hasta
    }
    sesiones {
        uuid id PK
        uuid usuario_id FK
        char token_hash UK
        timestamptz expira_en
        timestamptz revocada_en
    }
    tokens_recuperacion_password {
        uuid id PK
        uuid usuario_id FK
        char token_hash UK
        timestamptz expira_en
        timestamptz usado_en
    }
    empresas_contratistas {
        uuid id PK
        varchar nit UK
    }
    contratistas {
        uuid id PK
        uuid usuario_id FK
    }
```

## 2. Empresas, personas y requisitos

```mermaid
erDiagram
    empresas_contratistas ||--o{ contratistas : "emplea"
    empresas_contratistas ||--o{ equipos : "posee"
    tipos_documento ||--o{ documentos : "clasifica"
    contratistas |o--o{ documentos : "dueño"
    empresas_contratistas |o--o{ documentos : "dueño"
    equipos |o--o{ documentos : "dueño"
    archivos ||--o{ documentos : "archivo"
    capacitaciones ||--o{ contratista_capacitaciones : "registrada en"
    contratistas ||--o{ contratista_capacitaciones : "cursa"
    archivos |o--o{ contratista_capacitaciones : "constancia"
    tipos_trabajo ||--o{ requisitos_tipo_trabajo : "exige"
    tipos_documento |o--o{ requisitos_tipo_trabajo : "requisito"
    capacitaciones |o--o{ requisitos_tipo_trabajo : "requisito"
    tipos_trabajo ||--o{ checklist_plantillas : "usa"
    checklist_plantillas ||--o{ checklist_items : "contiene"

    empresas_contratistas {
        uuid id PK
        varchar nit UK
        varchar razon_social
        text estado
    }
    contratistas {
        uuid id PK
        uuid empresa_id FK
        uuid usuario_id FK
        varchar documento_identidad UK
        varchar nombres
        varchar apellidos
        text estado
    }
    equipos {
        uuid id PK
        uuid empresa_id FK
        varchar codigo
        varchar nombre
    }
    tipos_documento {
        int id PK
        varchar codigo UK
        text aplica_a
        boolean requiere_vencimiento
    }
    documentos {
        uuid id PK
        int tipo_documento_id FK
        uuid contratista_id FK
        uuid empresa_id FK
        uuid equipo_id FK
        uuid archivo_id FK
        date fecha_vencimiento
        text estado_revision
    }
    archivos {
        uuid id PK
        varchar nombre_original
        varchar mime_type
        text storage_key UK
        char sha256
        uuid subido_por FK
    }
    capacitaciones {
        int id PK
        varchar codigo UK
        int vigencia_meses
    }
    contratista_capacitaciones {
        uuid id PK
        uuid contratista_id FK
        int capacitacion_id FK
        date fecha_realizacion
        date fecha_vencimiento
        text estado_revision
    }
    tipos_trabajo {
        int id PK
        varchar codigo UK
        boolean requiere_permiso_trabajo
        boolean requiere_evaluacion_riesgo
    }
    requisitos_tipo_trabajo {
        int id PK
        int tipo_trabajo_id FK
        int tipo_documento_id FK
        int capacitacion_id FK
        boolean obligatorio
    }
    checklist_plantillas {
        int id PK
        int tipo_trabajo_id FK
        boolean activa
    }
    checklist_items {
        int id PK
        int plantilla_id FK
        smallint orden
        boolean obligatorio
    }
```

Un documento tiene **exactamente un dueño** (contratista, empresa o equipo), regla `CHECK` de la base.

## 3. Solicitudes y permisos de trabajo

```mermaid
erDiagram
    empresas_contratistas ||--o{ solicitudes_acceso : "solicita"
    tipos_trabajo ||--o{ solicitudes_acceso : "tipo"
    usuarios ||--o{ solicitudes_acceso : "responsable y solicitante"
    solicitudes_acceso ||--o{ solicitud_contratistas : "incluye"
    contratistas ||--o{ solicitud_contratistas : "participa"
    solicitudes_acceso ||--o{ solicitud_zonas : "autoriza"
    zonas ||--o{ solicitud_zonas : "zona"
    solicitudes_acceso ||--o{ solicitud_equipos : "lleva"
    equipos ||--o{ solicitud_equipos : "equipo"
    solicitudes_acceso ||--o{ evaluaciones_riesgo : "evaluada en"
    solicitudes_acceso ||--o{ autorizaciones : "etapas"
    solicitudes_acceso ||--o| permisos_trabajo : "permiso"
    permisos_trabajo ||--o{ evidencias_trabajo : "evidencias"
    archivos ||--o{ evidencias_trabajo : "archivo"
    solicitud_contratistas ||--o{ checklist_respuestas : "responde"
    checklist_items ||--o{ checklist_respuestas : "item"

    solicitudes_acceso {
        uuid id PK
        varchar codigo UK
        uuid empresa_id FK
        int tipo_trabajo_id FK
        uuid responsable_interno_id FK
        uuid solicitada_por FK
        date fecha_inicio
        date fecha_fin
        time hora_inicio
        time hora_fin
        text estado
    }
    solicitud_contratistas {
        uuid solicitud_id PK,FK
        uuid contratista_id PK,FK
    }
    solicitud_zonas {
        uuid solicitud_id PK,FK
        int zona_id PK,FK
    }
    solicitud_equipos {
        uuid solicitud_id PK,FK
        uuid equipo_id PK,FK
    }
    zonas {
        int id PK
        varchar codigo UK
        smallint nivel_riesgo
        boolean activa
    }
    evaluaciones_riesgo {
        uuid id PK
        uuid solicitud_id FK
        uuid evaluador_id FK
        text nivel_riesgo
        text resultado
    }
    autorizaciones {
        uuid id PK
        uuid solicitud_id FK
        smallint etapa
        text decision
        uuid usuario_id FK
    }
    permisos_trabajo {
        uuid id PK
        varchar codigo UK
        uuid solicitud_id FK,UK
        date fecha_inicio
        date fecha_fin
        text estado
        uuid aprobado_por FK
        timestamptz actividad_inicio_en
        timestamptz actividad_fin_en
    }
    evidencias_trabajo {
        uuid id PK
        uuid permiso_trabajo_id FK
        uuid archivo_id FK
        text momento
        uuid registrado_por FK
    }
    checklist_respuestas {
        uuid id PK
        uuid solicitud_id FK
        uuid contratista_id FK
        int item_id FK
        boolean cumple
    }
```

Una solicitud tiene **como máximo un** permiso de trabajo (`solicitud_id` único). Las autorizaciones son
únicas por solicitud y etapa.

## 4. Credenciales y garita

```mermaid
erDiagram
    solicitud_contratistas ||--o{ credenciales : "credencial de"
    permisos_trabajo |o--o{ credenciales : "permiso asociado"
    credenciales ||--o{ validaciones_credencial : "validaciones"
    zonas |o--o{ validaciones_credencial : "zona"
    credenciales ||--o{ registros_acceso : "entradas y salidas"
    solicitud_contratistas ||--o{ registros_acceso : "persona en la solicitud"
    solicitud_zonas ||--o{ registros_acceso : "zona autorizada"
    credenciales ||--o{ pases_impresos : "pases"
    usuarios ||--o{ registros_acceso : "registra"

    credenciales {
        uuid id PK
        uuid solicitud_id FK
        uuid contratista_id FK
        uuid permiso_trabajo_id FK
        varchar codigo_corto UK
        timestamptz expira_en
        text estado
        smallint usos_maximos
        smallint usos_actuales
        uuid emitida_por FK
        uuid revocada_por FK
        text motivo_revocacion
    }
    validaciones_credencial {
        uuid id PK
        uuid credencial_id FK
        text resultado
        int zona_id FK
        uuid validado_por FK
    }
    registros_acceso {
        uuid id PK
        uuid credencial_id FK
        uuid solicitud_id FK
        uuid contratista_id FK
        int zona_id FK
        text tipo
        timestamptz fecha_hora
        uuid registrado_por FK
    }
    pases_impresos {
        uuid id PK
        uuid credencial_id FK
        uuid impreso_por FK
    }
    solicitud_contratistas {
        uuid solicitud_id PK,FK
        uuid contratista_id PK,FK
    }
    solicitud_zonas {
        uuid solicitud_id PK,FK
        int zona_id PK,FK
    }
```

Claves foráneas **compuestas** que hacen cumplir reglas de negocio en la propia base:

| Relación | Regla que garantiza |
|---|---|
| `credenciales (solicitud_id, contratista_id)` → `solicitud_contratistas` | Solo se emite credencial a una persona incluida en la solicitud |
| `credenciales (permiso_trabajo_id, solicitud_id)` → `permisos_trabajo (id, solicitud_id)` | El permiso asociado es de la **misma** solicitud |
| `registros_acceso (solicitud_id, zona_id)` → `solicitud_zonas` | No se puede registrar un acceso a una zona no autorizada |
| `registros_acceso (credencial_id, solicitud_id)` → `credenciales (id, solicitud_id)` | La credencial corresponde a esa solicitud |
| Índice único parcial `ux_credencial_activa` | Una sola credencial **activa** por persona y solicitud |

## 5. Incidentes, bloqueos, avisos y trazabilidad

```mermaid
erDiagram
    contratistas |o--o{ incidentes : "involucrado"
    empresas_contratistas |o--o{ incidentes : "involucrada"
    solicitudes_acceso |o--o{ incidentes : "relacionada"
    zonas |o--o{ incidentes : "ocurrió en"
    incidentes ||--o{ incidente_evidencias : "evidencias"
    archivos ||--o{ incidente_evidencias : "archivo"
    contratistas |o--o{ bloqueos : "bloqueado"
    empresas_contratistas |o--o{ bloqueos : "bloqueada"
    incidentes |o--o{ bloqueos : "origen"
    usuarios ||--o{ notificaciones : "recibe"
    usuarios ||--o{ push_suscripciones : "suscribe"
    usuarios ||--o{ operaciones_sync : "sincroniza"
    usuarios |o--o{ historial_estados : "cambió"

    incidentes {
        uuid id PK
        varchar codigo UK
        uuid contratista_id FK
        uuid empresa_id FK
        uuid solicitud_id FK
        int zona_id FK
        text severidad
        text estado
        uuid reportado_por FK
        uuid cerrado_por FK
    }
    incidente_evidencias {
        uuid incidente_id PK,FK
        uuid archivo_id PK,FK
    }
    bloqueos {
        uuid id PK
        uuid contratista_id FK
        uuid empresa_id FK
        text tipo
        text motivo
        uuid incidente_id FK
        uuid creado_por FK
        timestamptz levantado_en
    }
    notificaciones {
        uuid id PK
        uuid usuario_id FK
        varchar tipo
        timestamptz leida_en
    }
    push_suscripciones {
        uuid id PK
        uuid usuario_id FK
        text endpoint UK
    }
    operaciones_sync {
        uuid client_uuid PK
        uuid usuario_id FK
        varchar tipo
        jsonb payload
    }
    auditoria {
        bigint id PK
        uuid usuario_id
        varchar accion
        varchar entidad
        varchar entidad_id
        text resultado
        jsonb datos_antes
        jsonb datos_despues
        timestamptz created_at
    }
    historial_estados {
        bigint id PK
        varchar entidad
        uuid entidad_id
        text estado_anterior
        text estado_nuevo
        uuid usuario_id FK
        timestamptz created_at
    }
```

| Tabla | Nota |
|---|---|
| `bloqueos` | Exactamente un objetivo: contratista **o** empresa (`CHECK`). Es la única fuente de verdad de los bloqueos |
| `auditoria` | Solo inserción: triggers bloquean actualizar, borrar y truncar. Guarda el correo además del id para conservar la evidencia |
| `historial_estados` | Solo inserción; la escriben triggers al cambiar el estado de solicitudes, permisos, credenciales e incidentes |
| `push_suscripciones`, `operaciones_sync` | Previstas en el modelo para notificaciones push y cola offline; sin uso en esta versión |

## Funciones y vistas de la base

| Objeto | Uso |
|---|---|
| `fn_requisitos_incumplidos(solicitud, contratista)` | Documentos y capacitaciones obligatorios faltantes o vencidos |
| `fn_permiso_vigente(permiso)` | Si el permiso está dentro de su fecha y horario (hora de Guatemala) |
| `fn_contratista_bloqueado(contratista)` | Bloqueo propio o de su empresa |
| `v_personas_en_instalacion` | Personas cuyo último movimiento es una entrada |
| `v_documentos_por_vencer` | Documentos próximos a vencer (avisos y dashboard) |
