import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap'
import { ArrowLeft, Save } from 'lucide-react'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { Cargando, ErrorCarga } from '../../componentes/EstadosPantalla'
import { ErrorApi } from '../../api/cliente'
import { useSesion } from '../../sesion/contexto'
import { hoyGuatemala } from '../../utilidades/fechas'
import AvisoTipoTrabajo from './AvisoTipoTrabajo'
import {
  useContratistasDeEmpresa,
  useCrearSolicitud,
  useEmpresasActivas,
  useEquiposDeEmpresa,
  useTiposTrabajoActivos,
  useZonasActivas,
} from './nueva-solicitud.api'

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

// Mismas reglas que crearSolicitudSchema del backend, con mensajes para el usuario
const esquema = z
  .object({
    empresa_id: z.string().min(1, 'Elige la empresa'),
    tipo_trabajo_id: z.string().min(1, 'Elige el tipo de trabajo'),
    descripcion_actividad: z
      .string()
      .trim()
      .min(5, 'Describe la actividad (al menos 5 caracteres)')
      .max(2000, 'Máximo 2000 caracteres'),
    fecha_inicio: z.string().min(1, 'Indica la fecha de inicio'),
    fecha_fin: z.string().min(1, 'Indica la fecha de fin'),
    hora_inicio: z.string().regex(HORA, 'Hora no válida'),
    hora_fin: z.string().regex(HORA, 'Hora no válida'),
    contratistas: z.array(z.string()).min(1, 'Elige al menos un contratista'),
    zonas: z.array(z.string()).min(1, 'Elige al menos una zona'),
    equipos: z.array(z.string()),
  })
  .refine((d) => d.fecha_fin >= d.fecha_inicio, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['fecha_fin'],
  })
  .refine((d) => d.hora_fin > d.hora_inicio, {
    message: 'La hora de fin debe ser posterior a la de inicio',
    path: ['hora_fin'],
  })

type Formulario = z.infer<typeof esquema>

/** Lista de casillas para elegir varios elementos */
function ListaChequeo({
  nombre,
  opciones,
  valor,
  alCambiar,
  invalido,
  deshabilitado,
}: {
  nombre: string
  opciones: { valor: string; etiqueta: ReactNode }[]
  valor: string[]
  alCambiar: (nuevo: string[]) => void
  invalido?: boolean
  deshabilitado?: boolean
}) {
  return (
    <div className={`border rounded p-2${invalido ? ' border-danger' : ''}`} style={{ maxHeight: 240, overflowY: 'auto' }}>
      {opciones.map((o) => (
        <Form.Check
          key={o.valor}
          type="checkbox"
          id={`${nombre}-${o.valor}`}
          label={o.etiqueta}
          checked={valor.includes(o.valor)}
          disabled={deshabilitado}
          onChange={(e) => alCambiar(e.target.checked ? [...valor, o.valor] : valor.filter((v) => v !== o.valor))}
        />
      ))}
    </div>
  )
}

function MensajeCampo({ mensaje }: { mensaje?: string }) {
  return mensaje ? <div className="small text-danger mt-1">{mensaje}</div> : null
}

export default function NuevaSolicitudPagina() {
  const { perfil } = useSesion()
  const navegar = useNavigate()

  const empresas = useEmpresasActivas()
  const tipos = useTiposTrabajoActivos()
  const zonas = useZonasActivas()
  const crear = useCrearSolicitud()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      empresa_id: '',
      tipo_trabajo_id: '',
      descripcion_actividad: '',
      fecha_inicio: hoyGuatemala(),
      fecha_fin: hoyGuatemala(),
      hora_inicio: '08:00',
      hora_fin: '17:00',
      contratistas: [],
      zonas: [],
      equipos: [],
    },
  })

  const empresaId = watch('empresa_id')
  const tipoId = watch('tipo_trabajo_id')
  const contratistas = useContratistasDeEmpresa(empresaId)
  const equipos = useEquiposDeEmpresa(empresaId)

  // Si cambia la empresa, lo elegido de la empresa anterior ya no vale
  useEffect(() => {
    setValue('contratistas', [])
    setValue('equipos', [])
  }, [empresaId, setValue])

  if (!perfil) return null

  // Responsable interno = quien crea la solicitud: solo personal interno
  if (!perfil.rol.es_interno) {
    return (
      <Alert variant="info">
        Las solicitudes desde la aplicación Web las crea el personal interno de la planta.
      </Alert>
    )
  }

  if (empresas.isPending || tipos.isPending || zonas.isPending) return <Cargando />
  const errorCatalogo = empresas.error ?? tipos.error ?? zonas.error
  if (errorCatalogo) return <ErrorCarga error={errorCatalogo} />

  const tipoElegido = tipos.data?.find((t) => String(t.id) === tipoId)
  const procesando = crear.isPending

  const guardar = handleSubmit((d) => {
    crear.mutate(
      {
        empresa_id: d.empresa_id,
        tipo_trabajo_id: Number(d.tipo_trabajo_id),
        responsable_interno_id: perfil.id,
        descripcion_actividad: d.descripcion_actividad,
        fecha_inicio: d.fecha_inicio,
        fecha_fin: d.fecha_fin,
        hora_inicio: d.hora_inicio,
        hora_fin: d.hora_fin,
        contratistas: d.contratistas,
        zonas: d.zonas.map(Number),
        equipos: d.equipos,
      },
      { onSuccess: (creada) => navegar(`/solicitudes/${creada.id}`) },
    )
  })

  return (
    <>
      <Link to="/solicitudes" className="d-inline-flex align-items-center gap-1 mb-3">
        <ArrowLeft size={16} /> Solicitudes
      </Link>

      <EncabezadoPagina
        titulo="Nueva solicitud de acceso"
        descripcion="Se guarda como borrador. Después revísala y envíala desde su detalle."
      />

      <Form noValidate onSubmit={guardar}>
        {/* Datos generales */}
        <Card className="shadow-sm mb-3">
          <Card.Body>
            <h2 className="h6 mb-3">Datos generales</h2>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group controlId="empresa_id">
                  <Form.Label>Empresa contratista</Form.Label>
                  <Form.Select isInvalid={!!errors.empresa_id} disabled={procesando} {...register('empresa_id')}>
                    <option value="">Elige una empresa</option>
                    {empresas.data?.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.razon_social} (NIT {e.nit})
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.empresa_id?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group controlId="tipo_trabajo_id">
                  <Form.Label>Tipo de trabajo</Form.Label>
                  <Form.Select isInvalid={!!errors.tipo_trabajo_id} disabled={procesando} {...register('tipo_trabajo_id')}>
                    <option value="">Elige el tipo de trabajo</option>
                    {tipos.data?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.tipo_trabajo_id?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>

              {tipoElegido && (
                <Col xs={12}>
                  <AvisoTipoTrabajo
                    requiereEvaluacion={tipoElegido.requiere_evaluacion_riesgo}
                    requierePermiso={tipoElegido.requiere_permiso_trabajo}
                  />
                </Col>
              )}

              <Col md={6}>
                <div className="small text-body-secondary">Responsable interno</div>
                <div>{perfil.nombre_completo}</div>
              </Col>

              <Col xs={12}>
                <Form.Group controlId="descripcion_actividad">
                  <Form.Label>Actividad a realizar</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    isInvalid={!!errors.descripcion_actividad}
                    disabled={procesando}
                    {...register('descripcion_actividad')}
                  />
                  <Form.Control.Feedback type="invalid">{errors.descripcion_actividad?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Vigencia */}
        <Card className="shadow-sm mb-3">
          <Card.Body>
            <h2 className="h6 mb-3">Vigencia</h2>
            <Row className="g-3">
              <Col sm={6} lg={3}>
                <Form.Group controlId="fecha_inicio">
                  <Form.Label>Fecha de inicio</Form.Label>
                  <Form.Control type="date" isInvalid={!!errors.fecha_inicio} disabled={procesando} {...register('fecha_inicio')} />
                  <Form.Control.Feedback type="invalid">{errors.fecha_inicio?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col sm={6} lg={3}>
                <Form.Group controlId="fecha_fin">
                  <Form.Label>Fecha de fin</Form.Label>
                  <Form.Control type="date" isInvalid={!!errors.fecha_fin} disabled={procesando} {...register('fecha_fin')} />
                  <Form.Control.Feedback type="invalid">{errors.fecha_fin?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col sm={6} lg={3}>
                <Form.Group controlId="hora_inicio">
                  <Form.Label>Hora de inicio</Form.Label>
                  <Form.Control type="time" isInvalid={!!errors.hora_inicio} disabled={procesando} {...register('hora_inicio')} />
                  <Form.Control.Feedback type="invalid">{errors.hora_inicio?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col sm={6} lg={3}>
                <Form.Group controlId="hora_fin">
                  <Form.Label>Hora de fin</Form.Label>
                  <Form.Control type="time" isInvalid={!!errors.hora_fin} disabled={procesando} {...register('hora_fin')} />
                  <Form.Control.Feedback type="invalid">{errors.hora_fin?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Personas, zonas y equipos */}
        <Card className="shadow-sm mb-3">
          <Card.Body>
            <h2 className="h6 mb-3">Personas, zonas y equipos</h2>
            <Row className="g-3">
              <Col lg={4}>
                <div className="mb-2">Contratistas</div>
                {empresaId === '' ? (
                  <p className="text-body-secondary small mb-0">Primero elige la empresa.</p>
                ) : contratistas.isPending ? (
                  <Spinner animation="border" size="sm" />
                ) : contratistas.isError ? (
                  <p className="text-danger small mb-0">No se pudieron cargar los contratistas.</p>
                ) : contratistas.data.length === 0 ? (
                  <p className="text-body-secondary small mb-0">La empresa no tiene contratistas activos.</p>
                ) : (
                  <Controller
                    control={control}
                    name="contratistas"
                    render={({ field }) => (
                      <ListaChequeo
                        nombre="contratista"
                        valor={field.value}
                        alCambiar={field.onChange}
                        invalido={!!errors.contratistas}
                        deshabilitado={procesando}
                        opciones={contratistas.data.map((c) => ({
                          valor: c.id,
                          etiqueta: (
                            <>
                              {c.nombres} {c.apellidos}
                              <span className="small text-body-secondary"> · {c.documento_identidad}</span>
                            </>
                          ),
                        }))}
                      />
                    )}
                  />
                )}
                <MensajeCampo mensaje={errors.contratistas?.message} />
              </Col>

              <Col lg={4}>
                <div className="mb-2">Zonas</div>
                <Controller
                  control={control}
                  name="zonas"
                  render={({ field }) => (
                    <ListaChequeo
                      nombre="zona"
                      valor={field.value}
                      alCambiar={field.onChange}
                      invalido={!!errors.zonas}
                      deshabilitado={procesando}
                      opciones={(zonas.data ?? []).map((z) => ({
                        valor: String(z.id),
                        etiqueta: (
                          <>
                            <span className="fw-semibold">{z.codigo}</span> {z.nombre}
                            <span className="small text-body-secondary"> · riesgo {z.nivel_riesgo}</span>
                          </>
                        ),
                      }))}
                    />
                  )}
                />
                <MensajeCampo mensaje={errors.zonas?.message} />
              </Col>

              <Col lg={4}>
                <div className="mb-2">
                  Equipos <span className="text-body-secondary">(opcional)</span>
                </div>
                {empresaId === '' ? (
                  <p className="text-body-secondary small mb-0">Primero elige la empresa.</p>
                ) : equipos.isPending ? (
                  <Spinner animation="border" size="sm" />
                ) : equipos.isError ? (
                  <p className="text-danger small mb-0">No se pudieron cargar los equipos.</p>
                ) : equipos.data.length === 0 ? (
                  <p className="text-body-secondary small mb-0">La empresa no tiene equipos registrados.</p>
                ) : (
                  <Controller
                    control={control}
                    name="equipos"
                    render={({ field }) => (
                      <ListaChequeo
                        nombre="equipo"
                        valor={field.value}
                        alCambiar={field.onChange}
                        deshabilitado={procesando}
                        opciones={equipos.data.map((eq) => ({
                          valor: eq.id,
                          etiqueta: (
                            <>
                              <span className="fw-semibold">{eq.codigo}</span> {eq.nombre}
                            </>
                          ),
                        }))}
                      />
                    )}
                  />
                )}
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {crear.error && (
          <Alert variant="danger">
            {crear.error instanceof ErrorApi ? crear.error.message : 'No se pudo crear la solicitud.'}
          </Alert>
        )}

        <div className="d-flex flex-wrap justify-content-end gap-2">
          <Link to="/solicitudes" className={`btn btn-outline-secondary${procesando ? ' disabled' : ''}`}>
            Cancelar
          </Link>
          <Button type="submit" disabled={procesando} className="d-inline-flex align-items-center gap-2">
            {procesando ? <Spinner animation="border" size="sm" /> : <Save size={16} />}
            Guardar borrador
          </Button>
        </div>
      </Form>
    </>
  )
}
