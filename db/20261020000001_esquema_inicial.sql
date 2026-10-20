-- migrate:up
-- =============================================================================
-- PROYECTO B - Plataforma de Contratistas, Permisos de Trabajo y Acceso a Planta
-- Esquema PostgreSQL 17 - Migracion inicial (dbmate)
--
-- Convenciones:
--   * Catalogos: integer GENERATED ALWAYS AS IDENTITY
--   * Tablas transaccionales: uuid (gen_random_uuid())
--   * Estados: text + CHECK (facil de modificar sin ALTER TYPE)
--   * Fechas/horas: timestamptz; zona de negocio America/Guatemala
--     (la base queda configurada con esa zona horaria, ver seccion 0)
--
-- -----------------------------------------------------------------------------
-- MIGRACIONES: dbmate
-- -----------------------------------------------------------------------------
-- Los archivos SQL de db/migrations/ son la FUENTE DE VERDAD del modelo.
-- Se aplican con dbmate (registra lo aplicado en la tabla schema_migrations):
--
--       dbmate up         # aplica migraciones pendientes
--       dbmate rollback   # revierte la ultima migracion
--
-- Para cambiar el esquema: crear una migracion NUEVA (dbmate new <nombre>),
-- nunca editar una migracion ya aplicada en produccion.
--
-- -----------------------------------------------------------------------------
-- COMPATIBILIDAD CON PRISMA ORM
-- -----------------------------------------------------------------------------
-- Prisma se usa UNICAMENTE como cliente ORM, generado por introspeccion:
--
--       npx prisma db pull        # genera/actualiza prisma/schema.prisma
--       npx prisma generate       # genera el cliente tipado
--
--   1. NUNCA ejecutar `prisma migrate dev`, `prisma migrate reset` ni
--      `prisma db push` contra esta base. Prisma no modela CHECK, indices
--      parciales/de expresion, funciones, triggers ni vistas; esos comandos
--      los verian como "drift" e intentarian ELIMINARLOS.
--   2. `prisma db pull` es seguro: conserva en la base (aunque no los
--      represente) los CHECK, el indice de expresion y los indices parciales.
--   3. Los comentarios `-- @prisma:` marcan objetos que solo existen en SQL.
--
-- -----------------------------------------------------------------------------
-- USUARIO Y MOTIVO PARA EL HISTORIAL DE ESTADOS
-- -----------------------------------------------------------------------------
-- El trigger de historial lee app.user_id y app.motivo. SET LOCAL no acepta
-- parametros, por eso el backend debe usar set_config(..., true) DENTRO de la
-- misma transaccion interactiva de Prisma:
--
--   await prisma.$transaction(async (tx) => {
--     await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
--     await tx.$executeRaw`SELECT set_config('app.motivo', ${motivo}, true)`;
--     await tx.permisos_trabajo.update({ ... });
--   });
-- =============================================================================

CREATE EXTENSION citext;

-- -----------------------------------------------------------------------------
-- 0. Zona horaria, funciones utilitarias y secuencias
-- -----------------------------------------------------------------------------
-- Toda sesion nueva usara la hora de Guatemala (current_date, now()::date, etc.)
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'America/Guatemala');
END $$;

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE SEQUENCE seq_solicitud START 1;
CREATE SEQUENCE seq_permiso   START 1;
CREATE SEQUENCE seq_incidente START 1;

-- -----------------------------------------------------------------------------
-- 1. Seguridad: roles, permisos, usuarios, sesiones
-- -----------------------------------------------------------------------------
CREATE TABLE roles (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      varchar(40)  NOT NULL UNIQUE,
  nombre      varchar(80)  NOT NULL,
  descripcion text,
  es_interno  boolean      NOT NULL DEFAULT true   -- false = rol del lado contratista
);

CREATE TABLE permisos (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      varchar(60) NOT NULL UNIQUE,
  descripcion text
);

CREATE TABLE rol_permisos (
  rol_id     integer NOT NULL REFERENCES roles(id)    ON DELETE CASCADE,
  permiso_id integer NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

-- El bloqueo de una empresa se maneja SOLO en la tabla bloqueos (seccion 9).
-- estado aqui indica unicamente si la empresa esta dada de alta o de baja.
CREATE TABLE empresas_contratistas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nit              varchar(20)  NOT NULL UNIQUE,
  razon_social     varchar(200) NOT NULL,
  nombre_contacto  varchar(150),
  email_contacto   citext,
  telefono         varchar(30),
  direccion        text,
  estado           text NOT NULL DEFAULT 'activa'
                   CHECK (estado IN ('activa','inactiva')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 citext NOT NULL UNIQUE,
  password_hash         text   NOT NULL,                 -- argon2id / bcrypt
  nombre_completo       varchar(150) NOT NULL,
  rol_id                integer NOT NULL REFERENCES roles(id),
  empresa_id            uuid REFERENCES empresas_contratistas(id), -- solo usuarios externos
  activo                boolean NOT NULL DEFAULT true,
  intentos_fallidos     smallint NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
  bloqueado_hasta       timestamptz,
  ultimo_acceso         timestamptz,
  debe_cambiar_password boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_usuarios_rol     ON usuarios(rol_id);
CREATE INDEX ix_usuarios_empresa ON usuarios(empresa_id);

-- Refresh tokens / control de sesion (se guarda solo el hash SHA-256)
CREATE TABLE sesiones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  char(64) NOT NULL UNIQUE,
  creada_en   timestamptz NOT NULL DEFAULT now(),
  expira_en   timestamptz NOT NULL,
  revocada_en timestamptz,
  ip          inet,
  user_agent  text,
  CHECK (expira_en > creada_en)
);
-- @prisma: indice parcial (WHERE); solo existe en SQL.
CREATE INDEX ix_sesiones_usuario ON sesiones(usuario_id) WHERE revocada_en IS NULL;

-- Recuperacion de contrasena (token de un solo uso con expiracion)
CREATE TABLE tokens_recuperacion_password (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expira_en  timestamptz NOT NULL,
  usado_en   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_tokens_rec_usuario ON tokens_recuperacion_password(usuario_id);

-- -----------------------------------------------------------------------------
-- 2. Contratistas, equipos, archivos
-- -----------------------------------------------------------------------------
-- Igual que empresas: el bloqueo de una persona vive en la tabla bloqueos.
CREATE TABLE contratistas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES empresas_contratistas(id),
  usuario_id          uuid UNIQUE REFERENCES usuarios(id),   -- cuenta para la PWA
  documento_identidad varchar(30) NOT NULL UNIQUE,           -- DPI / pasaporte
  nombres             varchar(100) NOT NULL,
  apellidos           varchar(100) NOT NULL,
  email               citext,
  telefono            varchar(30),
  cargo               varchar(100),
  estado              text NOT NULL DEFAULT 'activo'
                      CHECK (estado IN ('activo','inactivo')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_contratistas_empresa ON contratistas(empresa_id);
-- @prisma: indice de expresion (lower(...)); solo existe en SQL.
CREATE INDEX ix_contratistas_nombre  ON contratistas(lower(apellidos), lower(nombres));

-- Los equipos no tienen fila en bloqueos; su bloqueo se maneja con estado.
CREATE TABLE equipos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas_contratistas(id),
  codigo        varchar(40)  NOT NULL,
  nombre        varchar(150) NOT NULL,
  tipo          varchar(80),
  marca         varchar(80),
  modelo        varchar(80),
  numero_serie  varchar(80),
  estado        text NOT NULL DEFAULT 'activo'
                CHECK (estado IN ('activo','inactivo','bloqueado')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

-- Metadatos de archivos reales (la ubicacion fisica va en storage_key:
-- ruta en filesystem/volumen o key de bucket S3/Spaces; credenciales en variables de entorno)
CREATE TABLE archivos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_original varchar(255) NOT NULL,
  mime_type       varchar(100) NOT NULL,
  tamano_bytes    bigint NOT NULL CHECK (tamano_bytes > 0),
  storage_key     text NOT NULL UNIQUE,
  sha256          char(64),
  subido_por      uuid REFERENCES usuarios(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. Documentos, vencimientos y capacitaciones
-- -----------------------------------------------------------------------------
CREATE TABLE tipos_documento (
  id                      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                  varchar(40)  NOT NULL UNIQUE,
  nombre                  varchar(120) NOT NULL,
  aplica_a                text NOT NULL CHECK (aplica_a IN ('contratista','empresa','equipo')),
  requiere_vencimiento    boolean NOT NULL DEFAULT true,
  dias_alerta_vencimiento integer NOT NULL DEFAULT 30 CHECK (dias_alerta_vencimiento >= 0)
);

CREATE TABLE documentos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento_id integer NOT NULL REFERENCES tipos_documento(id),
  contratista_id    uuid REFERENCES contratistas(id)          ON DELETE CASCADE,
  empresa_id        uuid REFERENCES empresas_contratistas(id) ON DELETE CASCADE,
  equipo_id         uuid REFERENCES equipos(id)               ON DELETE CASCADE,
  numero            varchar(60),
  fecha_emision     date,
  fecha_vencimiento date,
  archivo_id        uuid NOT NULL REFERENCES archivos(id),
  estado_revision   text NOT NULL DEFAULT 'pendiente'
                    CHECK (estado_revision IN ('pendiente','aprobado','rechazado')),
  revisado_por      uuid REFERENCES usuarios(id),
  revisado_en       timestamptz,
  observaciones     text,
  subido_por        uuid REFERENCES usuarios(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- El documento pertenece a exactamente una entidad
  CONSTRAINT ck_documento_un_dueno
    CHECK (num_nonnulls(contratista_id, empresa_id, equipo_id) = 1),
  CONSTRAINT ck_documento_fechas
    CHECK (fecha_vencimiento IS NULL OR fecha_emision IS NULL OR fecha_vencimiento >= fecha_emision),
  -- Si ya fue revisado, debe constar quien y cuando
  CONSTRAINT ck_documento_revision
    CHECK (estado_revision = 'pendiente' OR (revisado_por IS NOT NULL AND revisado_en IS NOT NULL))
);
CREATE INDEX ix_doc_contratista ON documentos(contratista_id, tipo_documento_id);
CREATE INDEX ix_doc_empresa     ON documentos(empresa_id, tipo_documento_id);
CREATE INDEX ix_doc_equipo      ON documentos(equipo_id);
-- @prisma: los dos indices siguientes son parciales (WHERE); solo en SQL.
CREATE INDEX ix_doc_vencimiento ON documentos(fecha_vencimiento) WHERE estado_revision = 'aprobado';
CREATE INDEX ix_doc_pendientes  ON documentos(created_at)        WHERE estado_revision = 'pendiente';

CREATE TABLE capacitaciones (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo         varchar(40)  NOT NULL UNIQUE,
  nombre         varchar(150) NOT NULL,
  descripcion    text,
  vigencia_meses integer CHECK (vigencia_meses IS NULL OR vigencia_meses > 0)
);

CREATE TABLE contratista_capacitaciones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contratista_id    uuid NOT NULL REFERENCES contratistas(id) ON DELETE CASCADE,
  capacitacion_id   integer NOT NULL REFERENCES capacitaciones(id),
  fecha_realizacion date NOT NULL,
  fecha_vencimiento date,
  archivo_id        uuid REFERENCES archivos(id),
  estado_revision   text NOT NULL DEFAULT 'pendiente'
                    CHECK (estado_revision IN ('pendiente','aprobado','rechazado')),
  revisado_por      uuid REFERENCES usuarios(id),
  revisado_en       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha_realizacion),
  CHECK (estado_revision = 'pendiente' OR (revisado_por IS NOT NULL AND revisado_en IS NOT NULL)),
  UNIQUE (contratista_id, capacitacion_id, fecha_realizacion)
);
CREATE INDEX ix_cc_contratista ON contratista_capacitaciones(contratista_id, capacitacion_id);

-- -----------------------------------------------------------------------------
-- 4. Zonas, tipos de trabajo y requisitos
-- -----------------------------------------------------------------------------
CREATE TABLE zonas (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo       varchar(30)  NOT NULL UNIQUE,
  nombre       varchar(120) NOT NULL,
  descripcion  text,
  nivel_riesgo smallint NOT NULL DEFAULT 1 CHECK (nivel_riesgo BETWEEN 1 AND 4),
  activa       boolean NOT NULL DEFAULT true
);

CREATE TABLE tipos_trabajo (
  id                         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                     varchar(40)  NOT NULL UNIQUE,
  nombre                     varchar(120) NOT NULL,
  descripcion                text,
  requiere_permiso_trabajo   boolean NOT NULL DEFAULT true,
  requiere_evaluacion_riesgo boolean NOT NULL DEFAULT true,
  activo                     boolean NOT NULL DEFAULT true
);

-- Requisitos configurables por tipo de trabajo (documento O capacitacion)
CREATE TABLE requisitos_tipo_trabajo (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_trabajo_id   integer NOT NULL REFERENCES tipos_trabajo(id) ON DELETE CASCADE,
  tipo_documento_id integer REFERENCES tipos_documento(id),
  capacitacion_id   integer REFERENCES capacitaciones(id),
  obligatorio       boolean NOT NULL DEFAULT true,
  CONSTRAINT ck_requisito_uno CHECK (num_nonnulls(tipo_documento_id, capacitacion_id) = 1)
);
-- @prisma: indices unicos parciales (WHERE); solo en SQL. Junto con
--          ck_requisito_uno implementan "documento O capacitacion".
CREATE UNIQUE INDEX ux_req_documento
  ON requisitos_tipo_trabajo(tipo_trabajo_id, tipo_documento_id) WHERE tipo_documento_id IS NOT NULL;
CREATE UNIQUE INDEX ux_req_capacitacion
  ON requisitos_tipo_trabajo(tipo_trabajo_id, capacitacion_id)   WHERE capacitacion_id IS NOT NULL;

CREATE TABLE checklist_plantillas (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_trabajo_id integer NOT NULL REFERENCES tipos_trabajo(id) ON DELETE CASCADE,
  nombre          varchar(150) NOT NULL,
  activa          boolean NOT NULL DEFAULT true
);

CREATE TABLE checklist_items (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plantilla_id integer NOT NULL REFERENCES checklist_plantillas(id) ON DELETE CASCADE,
  orden        smallint NOT NULL,
  descripcion  text NOT NULL,
  obligatorio  boolean NOT NULL DEFAULT true,
  UNIQUE (plantilla_id, orden)
);

-- -----------------------------------------------------------------------------
-- 5. Solicitudes de acceso
-- -----------------------------------------------------------------------------
CREATE TABLE solicitudes_acceso (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                 varchar(20) NOT NULL UNIQUE
                         DEFAULT ('SA-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_solicitud')::text, 5, '0')),
  empresa_id             uuid    NOT NULL REFERENCES empresas_contratistas(id),
  tipo_trabajo_id        integer NOT NULL REFERENCES tipos_trabajo(id),
  responsable_interno_id uuid    NOT NULL REFERENCES usuarios(id),
  solicitada_por         uuid    NOT NULL REFERENCES usuarios(id),
  descripcion_actividad  text    NOT NULL,
  fecha_inicio           date    NOT NULL,
  fecha_fin              date    NOT NULL,
  hora_inicio            time    NOT NULL,
  hora_fin               time    NOT NULL,
  estado                 text    NOT NULL DEFAULT 'borrador'
                         CHECK (estado IN ('borrador','pendiente','en_revision','aprobada',
                                           'rechazada','cancelada','vencida','revocada')),
  motivo_rechazo         text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio),
  CHECK (hora_fin > hora_inicio)          -- turnos que cruzan medianoche = dos solicitudes
);
CREATE INDEX ix_sol_empresa     ON solicitudes_acceso(empresa_id, created_at DESC);
CREATE INDEX ix_sol_estado      ON solicitudes_acceso(estado, fecha_inicio);
CREATE INDEX ix_sol_responsable ON solicitudes_acceso(responsable_interno_id);

-- Personas, zonas y equipos incluidos en la solicitud
CREATE TABLE solicitud_contratistas (
  solicitud_id   uuid NOT NULL REFERENCES solicitudes_acceso(id) ON DELETE CASCADE,
  contratista_id uuid NOT NULL REFERENCES contratistas(id),
  PRIMARY KEY (solicitud_id, contratista_id)
);
CREATE INDEX ix_solcon_contratista ON solicitud_contratistas(contratista_id);

CREATE TABLE solicitud_zonas (
  solicitud_id uuid    NOT NULL REFERENCES solicitudes_acceso(id) ON DELETE CASCADE,
  zona_id      integer NOT NULL REFERENCES zonas(id),
  PRIMARY KEY (solicitud_id, zona_id)
);

CREATE TABLE solicitud_equipos (
  solicitud_id uuid NOT NULL REFERENCES solicitudes_acceso(id) ON DELETE CASCADE,
  equipo_id    uuid NOT NULL REFERENCES equipos(id),
  PRIMARY KEY (solicitud_id, equipo_id)
);

-- Checklist previo al trabajo (respondido desde la PWA)
CREATE TABLE checklist_respuestas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id   uuid    NOT NULL,
  contratista_id uuid    NOT NULL,
  item_id        integer NOT NULL REFERENCES checklist_items(id),
  cumple         boolean NOT NULL,
  observacion    text,
  respondido_en  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (solicitud_id, contratista_id)
    REFERENCES solicitud_contratistas(solicitud_id, contratista_id) ON DELETE CASCADE,
  UNIQUE (solicitud_id, contratista_id, item_id)
);

-- -----------------------------------------------------------------------------
-- 6. Evaluacion de riesgos, autorizaciones y permisos de trabajo
-- -----------------------------------------------------------------------------
CREATE TABLE evaluaciones_riesgo (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id           uuid NOT NULL REFERENCES solicitudes_acceso(id) ON DELETE CASCADE,
  evaluador_id           uuid NOT NULL REFERENCES usuarios(id),
  nivel_riesgo           text NOT NULL CHECK (nivel_riesgo IN ('bajo','medio','alto','critico')),
  peligros_identificados text NOT NULL,
  medidas_control        text NOT NULL,
  epp_requerido          text,
  resultado              text NOT NULL CHECK (resultado IN ('aprobada','condicionada','rechazada')),
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_eval_solicitud ON evaluaciones_riesgo(solicitud_id);

-- Decisiones de autorizacion (permite varias etapas de aprobacion)
CREATE TABLE autorizaciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES solicitudes_acceso(id) ON DELETE CASCADE,
  etapa        smallint NOT NULL DEFAULT 1 CHECK (etapa > 0),
  decision     text NOT NULL CHECK (decision IN ('aprobada','rechazada')),
  usuario_id   uuid NOT NULL REFERENCES usuarios(id),
  comentario   text,
  decidido_en  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (solicitud_id, etapa)
);

CREATE TABLE permisos_trabajo (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                 varchar(20) NOT NULL UNIQUE
                         DEFAULT ('PT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_permiso')::text, 5, '0')),
  solicitud_id           uuid NOT NULL UNIQUE REFERENCES solicitudes_acceso(id),
  fecha_inicio           date NOT NULL,
  fecha_fin              date NOT NULL,
  hora_inicio            time NOT NULL,
  hora_fin               time NOT NULL,
  condiciones_especiales text,
  estado                 text NOT NULL DEFAULT 'emitido'
                         CHECK (estado IN ('emitido','en_ejecucion','cerrado','revocado','vencido')),
  aprobado_por           uuid NOT NULL REFERENCES usuarios(id),   -- regla: quien aprobo
  emitido_en             timestamptz NOT NULL DEFAULT now(),
  actividad_inicio_en    timestamptz,
  actividad_inicio_por   uuid REFERENCES usuarios(id),
  actividad_fin_en       timestamptz,
  actividad_fin_por      uuid REFERENCES usuarios(id),
  revocado_por           uuid REFERENCES usuarios(id),
  revocado_en            timestamptz,
  motivo_revocacion      text,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  -- Permite que credenciales verifique que el permiso es de SU misma solicitud
  UNIQUE (id, solicitud_id),
  CHECK (fecha_fin >= fecha_inicio),
  CHECK (hora_fin > hora_inicio),
  CHECK (actividad_fin_en IS NULL OR actividad_inicio_en IS NULL OR actividad_fin_en >= actividad_inicio_en),
  CHECK (estado <> 'revocado'
         OR (revocado_por IS NOT NULL AND revocado_en IS NOT NULL AND motivo_revocacion IS NOT NULL))
);
CREATE INDEX ix_pt_estado ON permisos_trabajo(estado, fecha_inicio, fecha_fin);

CREATE TABLE evidencias_trabajo (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permiso_trabajo_id uuid NOT NULL REFERENCES permisos_trabajo(id) ON DELETE CASCADE,
  archivo_id         uuid NOT NULL REFERENCES archivos(id),
  momento            text NOT NULL DEFAULT 'durante' CHECK (momento IN ('inicio','durante','cierre')),
  descripcion        text,
  registrado_por     uuid NOT NULL REFERENCES usuarios(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_evid_permiso ON evidencias_trabajo(permiso_trabajo_id);

-- -----------------------------------------------------------------------------
-- 7. Credenciales temporales (token / QR) y validaciones
-- -----------------------------------------------------------------------------
-- El JWT firmado lleva: jti = credenciales.id, sub = contratista_id,
-- solicitud_id, exp. El QR contiene unicamente el token.
-- La BD guarda el estado para poder revocar o marcar como usado.
CREATE TABLE credenciales (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- = jti
  solicitud_id       uuid NOT NULL,
  contratista_id     uuid NOT NULL,
  permiso_trabajo_id uuid,
  codigo_corto       varchar(12) NOT NULL UNIQUE,                  -- validacion manual / pase impreso
  emitida_en         timestamptz NOT NULL DEFAULT now(),
  expira_en          timestamptz NOT NULL,
  estado             text NOT NULL DEFAULT 'activa'
                     CHECK (estado IN ('activa','usada','revocada','vencida')),
  usos_maximos       smallint CHECK (usos_maximos IS NULL OR usos_maximos > 0), -- NULL = ilimitado en vigencia
  usos_actuales      smallint NOT NULL DEFAULT 0 CHECK (usos_actuales >= 0),
  usada_en           timestamptz,
  emitida_por        uuid NOT NULL REFERENCES usuarios(id),
  revocada_en        timestamptz,
  revocada_por       uuid REFERENCES usuarios(id),
  motivo_revocacion  text,
  -- La persona debe estar incluida en la solicitud
  FOREIGN KEY (solicitud_id, contratista_id)
    REFERENCES solicitud_contratistas(solicitud_id, contratista_id),
  -- Si hay permiso de trabajo, debe ser el de la MISMA solicitud
  FOREIGN KEY (permiso_trabajo_id, solicitud_id)
    REFERENCES permisos_trabajo(id, solicitud_id),
  UNIQUE (id, solicitud_id),
  CHECK (expira_en > emitida_en),
  CHECK (estado <> 'revocada'
         OR (revocada_en IS NOT NULL AND revocada_por IS NOT NULL AND motivo_revocacion IS NOT NULL))
);
-- Una sola credencial activa por persona y solicitud
-- @prisma: indice unico parcial (WHERE). Prisma NO lo representa; vive solo en
--          el SQL. No usar `prisma migrate`/`db push` o Prisma intentara borrarlo.
CREATE UNIQUE INDEX ux_credencial_activa
  ON credenciales(solicitud_id, contratista_id) WHERE estado = 'activa';
CREATE INDEX ix_cred_contratista ON credenciales(contratista_id);
CREATE INDEX ix_cred_permiso     ON credenciales(permiso_trabajo_id);
-- @prisma: indice parcial; solo en SQL.
CREATE INDEX ix_cred_expira      ON credenciales(expira_en) WHERE estado = 'activa';

-- Bitacora de cada validacion en garita (valida o no)
CREATE TABLE validaciones_credencial (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credencial_id uuid REFERENCES credenciales(id),   -- NULL si el token ni siquiera es reconocible
  resultado     text NOT NULL
                CHECK (resultado IN ('valido','vencido','revocado','usado','invalido',
                                     'bloqueado','documentos_vencidos','fuera_de_horario',
                                     'zona_no_autorizada')),
  motivo        text,
  zona_id       integer REFERENCES zonas(id),
  validado_por  uuid REFERENCES usuarios(id),
  ip            inet,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_val_credencial ON validaciones_credencial(credencial_id, created_at DESC);
CREATE INDEX ix_val_fecha      ON validaciones_credencial(created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. Ingresos y salidas
-- -----------------------------------------------------------------------------
CREATE TABLE registros_acceso (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credencial_id  uuid    NOT NULL,
  solicitud_id   uuid    NOT NULL,
  contratista_id uuid    NOT NULL,
  zona_id        integer NOT NULL,
  tipo           text    NOT NULL CHECK (tipo IN ('entrada','salida')),
  fecha_hora     timestamptz NOT NULL DEFAULT now(),
  registrado_por uuid    NOT NULL REFERENCES usuarios(id),
  observaciones  text,
  FOREIGN KEY (credencial_id, solicitud_id) REFERENCES credenciales(id, solicitud_id),
  FOREIGN KEY (solicitud_id, contratista_id)
    REFERENCES solicitud_contratistas(solicitud_id, contratista_id),
  -- La BD impide registrar acceso a una zona que la solicitud no autorizo
  FOREIGN KEY (solicitud_id, zona_id) REFERENCES solicitud_zonas(solicitud_id, zona_id)
);
CREATE INDEX ix_acc_contratista ON registros_acceso(contratista_id, fecha_hora DESC);
CREATE INDEX ix_acc_zona        ON registros_acceso(zona_id, fecha_hora DESC);
CREATE INDEX ix_acc_fecha       ON registros_acceso(fecha_hora DESC);

CREATE TABLE pases_impresos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credencial_id uuid NOT NULL REFERENCES credenciales(id),
  impreso_por   uuid NOT NULL REFERENCES usuarios(id),
  impreso_en    timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 9. Incidentes y bloqueos
-- -----------------------------------------------------------------------------
CREATE TABLE incidentes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo               varchar(20) NOT NULL UNIQUE
                       DEFAULT ('INC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_incidente')::text, 5, '0')),
  contratista_id       uuid REFERENCES contratistas(id),
  empresa_id           uuid REFERENCES empresas_contratistas(id),
  solicitud_id         uuid REFERENCES solicitudes_acceso(id),
  zona_id              integer REFERENCES zonas(id),
  severidad            text NOT NULL CHECK (severidad IN ('leve','moderado','grave','critico')),
  descripcion          text NOT NULL,
  fecha_ocurrencia     timestamptz NOT NULL DEFAULT now(),
  estado               text NOT NULL DEFAULT 'abierto'
                       CHECK (estado IN ('abierto','en_investigacion','cerrado')),
  acciones_correctivas text,
  reportado_por        uuid NOT NULL REFERENCES usuarios(id),
  cerrado_por          uuid REFERENCES usuarios(id),
  cerrado_en           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (contratista_id IS NOT NULL OR empresa_id IS NOT NULL OR solicitud_id IS NOT NULL),
  CHECK (estado <> 'cerrado' OR (cerrado_por IS NOT NULL AND cerrado_en IS NOT NULL))
);
CREATE INDEX ix_inc_contratista ON incidentes(contratista_id);
CREATE INDEX ix_inc_empresa     ON incidentes(empresa_id);
CREATE INDEX ix_inc_estado      ON incidentes(estado, fecha_ocurrencia DESC);

CREATE TABLE incidente_evidencias (
  incidente_id uuid NOT NULL REFERENCES incidentes(id) ON DELETE CASCADE,
  archivo_id   uuid NOT NULL REFERENCES archivos(id),
  PRIMARY KEY (incidente_id, archivo_id)
);

-- UNICA fuente de verdad de bloqueos de personas y empresas.
-- Bloqueo activo = levantado_en IS NULL
CREATE TABLE bloqueos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contratista_id       uuid REFERENCES contratistas(id),
  empresa_id           uuid REFERENCES empresas_contratistas(id),
  tipo                 text NOT NULL CHECK (tipo IN ('documento_vencido','incidente','manual')),
  motivo               text NOT NULL,
  incidente_id         uuid REFERENCES incidentes(id),
  creado_por           uuid NOT NULL REFERENCES usuarios(id),
  creado_en            timestamptz NOT NULL DEFAULT now(),
  levantado_por        uuid REFERENCES usuarios(id),
  levantado_en         timestamptz,
  motivo_levantamiento text,
  CONSTRAINT ck_bloqueo_objetivo  CHECK (num_nonnulls(contratista_id, empresa_id) = 1),
  CONSTRAINT ck_bloqueo_levantado CHECK ((levantado_en IS NULL) = (levantado_por IS NULL))
);
-- @prisma: indices parciales (bloqueo activo); solo en SQL.
CREATE INDEX ix_bloq_contratista ON bloqueos(contratista_id) WHERE levantado_en IS NULL;
CREATE INDEX ix_bloq_empresa     ON bloqueos(empresa_id)     WHERE levantado_en IS NULL;

-- -----------------------------------------------------------------------------
-- 10. Notificaciones, push y sincronizacion offline
-- -----------------------------------------------------------------------------
CREATE TABLE notificaciones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo       varchar(50)  NOT NULL,             -- documento_por_vencer, solicitud_aprobada, ...
  titulo     varchar(150) NOT NULL,
  mensaje    text NOT NULL,
  entidad    varchar(40),
  entidad_id uuid,
  leida_en   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- @prisma: indice parcial; solo en SQL.
CREATE INDEX ix_notif_no_leidas ON notificaciones(usuario_id, created_at DESC) WHERE leida_en IS NULL;

-- Suscripciones Web Push de la PWA
CREATE TABLE push_suscripciones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotencia de la cola offline de la PWA: el cliente genera un UUID por
-- operacion; si se reenvia, el backend detecta el duplicado.
CREATE TABLE operaciones_sync (
  client_uuid uuid PRIMARY KEY,
  usuario_id  uuid NOT NULL REFERENCES usuarios(id),
  tipo        varchar(50) NOT NULL,             -- confirmar_inicio, checklist, evidencia, ...
  payload     jsonb NOT NULL,
  resultado   text NOT NULL CHECK (resultado IN ('ok','error','duplicada')),
  error       text,
  recibida_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_sync_usuario ON operaciones_sync(usuario_id, recibida_en DESC);

-- -----------------------------------------------------------------------------
-- 11. Auditoria e historial de estados (solo insercion)
-- -----------------------------------------------------------------------------
-- Sin FK a usuarios a proposito: la auditoria debe sobrevivir a cualquier cambio.
CREATE TABLE auditoria (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id     uuid,
  usuario_email  varchar(255),
  accion         varchar(60) NOT NULL,          -- LOGIN, LOGIN_FALLIDO, APROBAR_PERMISO, VALIDAR_QR, ...
  entidad        varchar(60),
  entidad_id     varchar(60),
  resultado      text NOT NULL DEFAULT 'ok' CHECK (resultado IN ('ok','denegado','error')),
  datos_antes    jsonb,
  datos_despues  jsonb,
  ip             inet,
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_aud_fecha   ON auditoria(created_at DESC);
CREATE INDEX ix_aud_usuario ON auditoria(usuario_id, created_at DESC);
CREATE INDEX ix_aud_entidad ON auditoria(entidad, entidad_id);
CREATE INDEX ix_aud_accion  ON auditoria(accion);

CREATE TABLE historial_estados (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidad         varchar(40) NOT NULL,         -- solicitud, permiso_trabajo, credencial, incidente
  entidad_id      uuid NOT NULL,
  estado_anterior text,
  estado_nuevo    text NOT NULL,
  motivo          text,
  usuario_id      uuid REFERENCES usuarios(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_hist_entidad ON historial_estados(entidad, entidad_id, created_at);

-- @prisma: todo lo que sigue (FUNCIONES, TRIGGERS, VISTAS) NO se representa en
--          schema.prisma. Prisma lo ignora en `db pull`.
CREATE FUNCTION fn_solo_insercion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo insercion', TG_TABLE_NAME;
END $$;

-- Bloquea UPDATE y DELETE fila por fila
CREATE TRIGGER trg_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();

CREATE TRIGGER trg_historial_inmutable
  BEFORE UPDATE OR DELETE ON historial_estados
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();

-- Bloquea TRUNCATE (los triggers por fila no lo detienen)
CREATE TRIGGER trg_auditoria_no_truncate
  BEFORE TRUNCATE ON auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION fn_solo_insercion();

CREATE TRIGGER trg_historial_no_truncate
  BEFORE TRUNCATE ON historial_estados
  FOR EACH STATEMENT EXECUTE FUNCTION fn_solo_insercion();

-- Registro automatico de cada cambio de estado
CREATE FUNCTION fn_historial_estado() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_usuario uuid;
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    -- Si app.user_id no es un UUID valido (o esta vacio) se registra NULL
    -- en lugar de abortar la transaccion por un error de casteo.
    BEGIN
      v_usuario := NULLIF(current_setting('app.user_id', true), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_usuario := NULL;
    END;
    INSERT INTO historial_estados(entidad, entidad_id, estado_anterior, estado_nuevo, motivo, usuario_id)
    VALUES (TG_ARGV[0], NEW.id, OLD.estado, NEW.estado,
            NULLIF(current_setting('app.motivo', true), ''),
            v_usuario);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_hist_solicitud AFTER UPDATE OF estado ON solicitudes_acceso
  FOR EACH ROW EXECUTE FUNCTION fn_historial_estado('solicitud');
CREATE TRIGGER trg_hist_permiso AFTER UPDATE OF estado ON permisos_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_historial_estado('permiso_trabajo');
CREATE TRIGGER trg_hist_credencial AFTER UPDATE OF estado ON credenciales
  FOR EACH ROW EXECUTE FUNCTION fn_historial_estado('credencial');
CREATE TRIGGER trg_hist_incidente AFTER UPDATE OF estado ON incidentes
  FOR EACH ROW EXECUTE FUNCTION fn_historial_estado('incidente');

-- -----------------------------------------------------------------------------
-- 12. Triggers updated_at
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['empresas_contratistas','usuarios','contratistas','equipos',
                           'documentos','solicitudes_acceso','permisos_trabajo','incidentes']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 13. Funciones de reglas de negocio (apoyo al backend)
-- -----------------------------------------------------------------------------
-- Requisitos obligatorios (documentos y capacitaciones) que NO cumple una persona
-- para una solicitud. Si devuelve filas -> no se debe permitir el acceso.
-- Si la persona no esta incluida en la solicitud, devuelve una fila tipo 'solicitud'
-- (antes devolvia vacio, lo que se interpretaba como "cumple todo").
-- La fecha por defecto es la de Guatemala, sin depender de la zona de la sesion.
-- (Los requisitos de tipo 'equipo' se validan en el backend por equipo asignado.)
CREATE FUNCTION fn_requisitos_incumplidos(
  p_solicitud   uuid,
  p_contratista uuid,
  p_fecha       date DEFAULT (now() AT TIME ZONE 'America/Guatemala')::date
) RETURNS TABLE (tipo text, referencia_id integer, nombre text, motivo text)
LANGUAGE sql STABLE AS $$
  SELECT 'solicitud'::text, NULL::integer, 'Pertenencia a la solicitud'::text,
         'el contratista no esta incluido en la solicitud'::text
  WHERE NOT EXISTS (
    SELECT 1 FROM solicitud_contratistas sc
    WHERE sc.solicitud_id = p_solicitud AND sc.contratista_id = p_contratista
  )
  UNION ALL
  SELECT 'documento'::text, td.id, td.nombre::text, 'faltante, no aprobado o vencido'::text
  FROM solicitudes_acceso s
  JOIN solicitud_contratistas sc
       ON sc.solicitud_id = s.id AND sc.contratista_id = p_contratista
  JOIN contratistas c ON c.id = sc.contratista_id
  JOIN requisitos_tipo_trabajo r
       ON r.tipo_trabajo_id = s.tipo_trabajo_id AND r.obligatorio AND r.tipo_documento_id IS NOT NULL
  JOIN tipos_documento td ON td.id = r.tipo_documento_id AND td.aplica_a IN ('contratista','empresa')
  WHERE s.id = p_solicitud
    AND NOT EXISTS (
      SELECT 1 FROM documentos d
      WHERE d.tipo_documento_id = td.id
        AND d.estado_revision = 'aprobado'
        AND (d.fecha_vencimiento IS NULL OR d.fecha_vencimiento >= p_fecha)
        AND ( (td.aplica_a = 'contratista' AND d.contratista_id = c.id)
           OR (td.aplica_a = 'empresa'     AND d.empresa_id     = c.empresa_id) )
    )
  UNION ALL
  SELECT 'capacitacion'::text, cap.id, cap.nombre::text, 'faltante, no aprobada o vencida'::text
  FROM solicitudes_acceso s
  JOIN solicitud_contratistas sc
       ON sc.solicitud_id = s.id AND sc.contratista_id = p_contratista
  JOIN requisitos_tipo_trabajo r
       ON r.tipo_trabajo_id = s.tipo_trabajo_id AND r.obligatorio AND r.capacitacion_id IS NOT NULL
  JOIN capacitaciones cap ON cap.id = r.capacitacion_id
  WHERE s.id = p_solicitud
    AND NOT EXISTS (
      SELECT 1 FROM contratista_capacitaciones cc
      WHERE cc.contratista_id = p_contratista
        AND cc.capacitacion_id = cap.id
        AND cc.estado_revision = 'aprobado'
        AND (cc.fecha_vencimiento IS NULL OR cc.fecha_vencimiento >= p_fecha)
    );
$$;

-- Un permiso esta vigente si esta emitido/en ejecucion y "ahora" cae dentro de
-- su rango de fechas y de su horario (hora local de Guatemala).
CREATE FUNCTION fn_permiso_vigente(
  p_permiso uuid,
  p_ahora   timestamptz DEFAULT now()
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM permisos_trabajo p
    WHERE p.id = p_permiso
      AND p.estado IN ('emitido','en_ejecucion')
      AND (p_ahora AT TIME ZONE 'America/Guatemala')::date BETWEEN p.fecha_inicio AND p.fecha_fin
      AND (p_ahora AT TIME ZONE 'America/Guatemala')::time BETWEEN p.hora_inicio  AND p.hora_fin
  );
$$;

-- Una persona esta bloqueada si tiene un bloqueo activo propio o de su empresa.
CREATE FUNCTION fn_contratista_bloqueado(p_contratista uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM contratistas c
    JOIN bloqueos b
      ON b.levantado_en IS NULL
     AND (b.contratista_id = c.id OR b.empresa_id = c.empresa_id)
    WHERE c.id = p_contratista
  );
$$;

-- -----------------------------------------------------------------------------
-- 14. Vistas
-- -----------------------------------------------------------------------------
-- Personas actualmente dentro de la instalacion (ultimo movimiento = entrada)
CREATE VIEW v_personas_en_instalacion AS
SELECT u.contratista_id, u.credencial_id, u.solicitud_id, u.zona_id, u.fecha_hora AS ingreso_en
FROM (
  SELECT DISTINCT ON (ra.contratista_id)
         ra.contratista_id, ra.credencial_id, ra.solicitud_id, ra.zona_id, ra.tipo, ra.fecha_hora
  FROM registros_acceso ra
  ORDER BY ra.contratista_id, ra.fecha_hora DESC
) u
WHERE u.tipo = 'entrada';

-- Documentos aprobados proximos a vencer (alimenta notificaciones y dashboard).
-- Usa la fecha de Guatemala de forma explicita.
CREATE VIEW v_documentos_por_vencer AS
WITH hoy AS (
  SELECT (now() AT TIME ZONE 'America/Guatemala')::date AS fecha
)
SELECT d.id AS documento_id, d.tipo_documento_id, td.nombre AS tipo_documento,
       d.contratista_id, d.empresa_id, d.equipo_id, d.fecha_vencimiento,
       (d.fecha_vencimiento - h.fecha) AS dias_restantes
FROM documentos d
JOIN tipos_documento td ON td.id = d.tipo_documento_id
CROSS JOIN hoy h
WHERE d.estado_revision = 'aprobado'
  AND d.fecha_vencimiento IS NOT NULL
  AND d.fecha_vencimiento BETWEEN h.fecha AND h.fecha + td.dias_alerta_vencimiento;

-- -----------------------------------------------------------------------------
-- 15. Datos semilla (catalogos, roles y permisos)
--     Los usuarios de demostracion se crean con el script de seed del backend,
--     porque requieren password_hash generado por la aplicacion.
-- -----------------------------------------------------------------------------
INSERT INTO roles (codigo, nombre, es_interno) VALUES
  ('admin',               'Administrador',              true),
  ('seguridad_industrial','Seguridad Industrial',       true),
  ('responsable_interno', 'Responsable Interno',        true),
  ('garita',              'Garita / Recepcion',         true),
  ('supervisor_campo',    'Supervisor de Campo',        false),
  ('contratista',         'Contratista / Tecnico',      false);

INSERT INTO permisos (codigo, descripcion) VALUES
  ('usuarios.gestionar',         'Crear y administrar usuarios'),
  ('roles.gestionar',            'Administrar roles y permisos'),
  ('empresas.gestionar',         'Registrar y editar empresas contratistas'),
  ('contratistas.gestionar',     'Registrar y editar contratistas'),
  ('documentos.subir',           'Subir documentos y fotografias'),
  ('documentos.revisar',         'Revisar y aprobar documentos'),
  ('requisitos.gestionar',       'Definir requisitos por tipo de trabajo'),
  ('solicitudes.crear',          'Crear solicitudes de acceso'),
  ('solicitudes.ver',            'Consultar solicitudes'),
  ('solicitudes.autorizar',      'Autorizar o rechazar solicitudes'),
  ('permisos_trabajo.emitir',    'Emitir permisos de trabajo'),
  ('permisos_trabajo.revocar',   'Revocar permisos de trabajo'),
  ('riesgos.evaluar',            'Registrar evaluaciones de riesgo'),
  ('credenciales.emitir',        'Emitir credenciales temporales'),
  ('credenciales.revocar',       'Revocar credenciales'),
  ('garita.validar',             'Validar credenciales / QR'),
  ('garita.registrar_acceso',    'Registrar entradas y salidas'),
  ('garita.imprimir_pase',       'Imprimir pases temporales'),
  ('accesos.ver_personas_dentro','Ver personas dentro de la instalacion'),
  ('bloqueos.gestionar',         'Bloquear y desbloquear accesos'),
  ('incidentes.gestionar',       'Gestionar incidentes'),
  ('incidentes.reportar',        'Reportar incidentes'),
  ('reportes.ver',               'Ver reportes y dashboard'),
  ('auditoria.ver',              'Consultar auditoria'),
  ('checklist.completar',        'Completar checklist previo'),
  ('actividad.confirmar',        'Confirmar inicio y cierre de actividad'),
  ('evidencias.registrar',       'Registrar evidencias de trabajo'),
  ('notificaciones.ver',         'Ver notificaciones');

-- admin: todos los permisos
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p WHERE r.codigo = 'admin';

-- resto de roles
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM (VALUES
  ('seguridad_industrial','empresas.gestionar'),
  ('seguridad_industrial','contratistas.gestionar'),
  ('seguridad_industrial','documentos.revisar'),
  ('seguridad_industrial','requisitos.gestionar'),
  ('seguridad_industrial','solicitudes.ver'),
  ('seguridad_industrial','solicitudes.autorizar'),
  ('seguridad_industrial','permisos_trabajo.emitir'),
  ('seguridad_industrial','permisos_trabajo.revocar'),
  ('seguridad_industrial','riesgos.evaluar'),
  ('seguridad_industrial','credenciales.emitir'),
  ('seguridad_industrial','credenciales.revocar'),
  ('seguridad_industrial','accesos.ver_personas_dentro'),
  ('seguridad_industrial','bloqueos.gestionar'),
  ('seguridad_industrial','incidentes.gestionar'),
  ('seguridad_industrial','reportes.ver'),
  ('seguridad_industrial','auditoria.ver'),
  ('seguridad_industrial','notificaciones.ver'),
  ('responsable_interno','solicitudes.crear'),
  ('responsable_interno','solicitudes.ver'),
  ('responsable_interno','solicitudes.autorizar'),
  ('responsable_interno','incidentes.reportar'),
  ('responsable_interno','reportes.ver'),
  ('responsable_interno','notificaciones.ver'),
  ('garita','garita.validar'),
  ('garita','garita.registrar_acceso'),
  ('garita','garita.imprimir_pase'),
  ('garita','accesos.ver_personas_dentro'),
  ('garita','incidentes.reportar'),
  ('garita','notificaciones.ver'),
  ('supervisor_campo','documentos.subir'),
  ('supervisor_campo','solicitudes.crear'),
  ('supervisor_campo','solicitudes.ver'),
  ('supervisor_campo','checklist.completar'),
  ('supervisor_campo','actividad.confirmar'),
  ('supervisor_campo','evidencias.registrar'),
  ('supervisor_campo','incidentes.reportar'),
  ('supervisor_campo','notificaciones.ver'),
  ('contratista','documentos.subir'),
  ('contratista','solicitudes.ver'),
  ('contratista','checklist.completar'),
  ('contratista','actividad.confirmar'),
  ('contratista','evidencias.registrar'),
  ('contratista','notificaciones.ver')
) AS m(rol, permiso)
JOIN roles r    ON r.codigo = m.rol
JOIN permisos p ON p.codigo = m.permiso;

INSERT INTO tipos_documento (codigo, nombre, aplica_a, requiere_vencimiento, dias_alerta_vencimiento) VALUES
  ('DPI',            'Documento de identidad',                 'contratista', true,  30),
  ('SEGURO_VIDA',    'Seguro de vida / accidentes',            'contratista', true,  30),
  ('EXAMEN_MEDICO',  'Examen medico de aptitud',               'contratista', true,  15),
  ('POLIZA_RC',      'Poliza de responsabilidad civil',        'empresa',     true,  30),
  ('SOLVENCIA_IGSS', 'Solvencia IGSS',                         'empresa',     true,  15),
  ('CERT_EQUIPO',    'Certificacion de equipo / herramienta',  'equipo',      true,  30);

INSERT INTO capacitaciones (codigo, nombre, vigencia_meses) VALUES
  ('INDUCCION_SSO',  'Induccion de seguridad y salud ocupacional', 12),
  ('TRABAJO_ALTURA', 'Trabajo en alturas',                         12),
  ('ESPACIOS_CONF',  'Espacios confinados',                        12),
  ('PRIMEROS_AUX',   'Primeros auxilios',                          24);

INSERT INTO zonas (codigo, nombre, nivel_riesgo) VALUES
  ('Z-ADM',  'Edificio administrativo', 1),
  ('Z-BOD',  'Bodegas',                 2),
  ('Z-PROD', 'Area de produccion',      3),
  ('Z-SUBE', 'Subestacion electrica',   4);

INSERT INTO tipos_trabajo (codigo, nombre, requiere_permiso_trabajo, requiere_evaluacion_riesgo) VALUES
  ('MANT_GENERAL',    'Mantenimiento general',  false, false),
  ('TRABAJO_ALTURAS', 'Trabajo en alturas',     true,  true),
  ('TRABAJO_CALIENTE','Trabajo en caliente',    true,  true);

INSERT INTO requisitos_tipo_trabajo (tipo_trabajo_id, tipo_documento_id, capacitacion_id, obligatorio)
SELECT tt.id, td.id, NULL, true
FROM tipos_trabajo tt CROSS JOIN tipos_documento td
WHERE td.codigo IN ('DPI','SEGURO_VIDA','POLIZA_RC');

INSERT INTO requisitos_tipo_trabajo (tipo_trabajo_id, tipo_documento_id, capacitacion_id, obligatorio)
SELECT tt.id, NULL, c.id, true
FROM tipos_trabajo tt
JOIN capacitaciones c ON c.codigo = 'INDUCCION_SSO'
WHERE tt.codigo IN ('MANT_GENERAL','TRABAJO_ALTURAS','TRABAJO_CALIENTE');

INSERT INTO requisitos_tipo_trabajo (tipo_trabajo_id, tipo_documento_id, capacitacion_id, obligatorio)
SELECT tt.id, NULL, c.id, true
FROM tipos_trabajo tt
JOIN capacitaciones c ON c.codigo = 'TRABAJO_ALTURA'
WHERE tt.codigo = 'TRABAJO_ALTURAS';


-- migrate:down
DROP VIEW v_documentos_por_vencer;
DROP VIEW v_personas_en_instalacion;

DROP TABLE
  historial_estados, auditoria, operaciones_sync, push_suscripciones, notificaciones,
  bloqueos, incidente_evidencias, incidentes, pases_impresos, registros_acceso,
  validaciones_credencial, credenciales, evidencias_trabajo, permisos_trabajo,
  autorizaciones, evaluaciones_riesgo, checklist_respuestas, solicitud_equipos,
  solicitud_zonas, solicitud_contratistas, solicitudes_acceso, checklist_items,
  checklist_plantillas, requisitos_tipo_trabajo, tipos_trabajo, zonas,
  contratista_capacitaciones, capacitaciones, documentos, tipos_documento, archivos,
  equipos, contratistas, tokens_recuperacion_password, sesiones, usuarios,
  empresas_contratistas, rol_permisos, permisos, roles;

DROP FUNCTION fn_contratista_bloqueado(uuid);
DROP FUNCTION fn_permiso_vigente(uuid, timestamptz);
DROP FUNCTION fn_requisitos_incumplidos(uuid, uuid, date);
DROP FUNCTION fn_historial_estado();
DROP FUNCTION fn_solo_insercion();
DROP FUNCTION set_updated_at();

DROP SEQUENCE seq_incidente;
DROP SEQUENCE seq_permiso;
DROP SEQUENCE seq_solicitud;

DROP EXTENSION citext;

DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I RESET timezone', current_database());
END $$;
