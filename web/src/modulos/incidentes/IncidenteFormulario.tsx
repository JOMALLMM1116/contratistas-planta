import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap'
import { api, ErrorApi } from '../../api/cliente'
import type { RespuestaPaginada } from '../../api/tipos'
import SelectorContratistaEmpresa, { type Objetivo } from '../../componentes/SelectorContratistaEmpresa'
import { ahoraLocal, TEXTO_SEVERIDAD } from './ayudas'
import type { DatosIncidente, Severidad, ZonaOpcion } from './tipos'

interface Props {
  mostrar: boolean
  procesando: boolean
  /** Error devuelto por el backend al guardar */
  error: unknown
  alGuardar: (datos: DatosIncidente) => void
  alCancelar: () => void
}

export default function IncidenteFormulario({ mostrar, procesando, error, alGuardar, alCancelar }: Props) {
  const [tipo, setTipo] = useState<'contratista' | 'empresa'>('contratista')
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null)
  const [severidad, setSeveridad] = useState<Severidad>('leve')
  const [zonaId, setZonaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState('')
  const [intentado, setIntentado] = useState(false)

  // Cada vez que se abre, empieza limpio
  useEffect(() => {
    if (!mostrar) return
    setTipo('contratista')
    setObjetivo(null)
    setSeveridad('leve')
    setZonaId('')
    setDescripcion('')
    setFecha('')
    setIntentado(false)
  }, [mostrar])

  const zonas = useQuery({
    queryKey: ['zonas-selector'],
    queryFn: () => api.get<RespuestaPaginada<ZonaOpcion>>('/zonas', { por_pagina: 100, activa: true, ordenar_por: 'codigo' }),
    staleTime: 5 * 60_000,
    enabled: mostrar,
  })

  const errorObjetivo = intentado && !objetivo ? 'Selecciona a quién afecta el incidente.' : undefined
  const errorDescripcion = intentado && descripcion.trim().length < 5 ? 'Describe lo ocurrido (al menos 5 caracteres).' : undefined

  function cambiarTipo(nuevo: 'contratista' | 'empresa') {
    setTipo(nuevo)
    setObjetivo(null)
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (!objetivo || descripcion.trim().length < 5) return

    alGuardar({
      ...(objetivo.tipo === 'contratista' ? { contratista_id: objetivo.id } : { empresa_id: objetivo.id }),
      ...(zonaId ? { zona_id: Number(zonaId) } : {}),
      severidad,
      descripcion: descripcion.trim(),
      // El campo da la hora local del navegador; el backend la guarda con zona horaria
      ...(fecha ? { fecha_ocurrencia: new Date(fecha).toISOString() } : {}),
    })
  }

  return (
    <Modal show={mostrar} onHide={procesando ? undefined : alCancelar} backdrop={procesando ? 'static' : true} size="lg" fullscreen="sm-down" centered>
      <Form onSubmit={enviar} noValidate>
        <Modal.Header closeButton={!procesando}>
          <Modal.Title as="h2" className="h5">
            Reportar incidente
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Row className="g-3">
            <Col xs={12}>
              <Form.Label as="legend" className="form-label">
                ¿A quién afecta?<span className="text-danger"> *</span>
              </Form.Label>
              <div className="mb-2">
                <Form.Check
                  inline
                  type="radio"
                  id="incidente-tipo-contratista"
                  name="incidente-tipo"
                  label="Contratista"
                  checked={tipo === 'contratista'}
                  onChange={() => cambiarTipo('contratista')}
                  disabled={procesando}
                />
                <Form.Check
                  inline
                  type="radio"
                  id="incidente-tipo-empresa"
                  name="incidente-tipo"
                  label="Empresa"
                  checked={tipo === 'empresa'}
                  onChange={() => cambiarTipo('empresa')}
                  disabled={procesando}
                />
              </div>
              <SelectorContratistaEmpresa tipo={tipo} valor={objetivo} error={errorObjetivo} deshabilitado={procesando} alCambiar={setObjetivo} />
            </Col>

            <Col xs={12} md={6}>
              <Form.Group controlId="incidente-severidad">
                <Form.Label>
                  Severidad<span className="text-danger"> *</span>
                </Form.Label>
                <Form.Select value={severidad} onChange={(e) => setSeveridad(e.target.value as Severidad)} disabled={procesando}>
                  {(Object.keys(TEXTO_SEVERIDAD) as Severidad[]).map((clave) => (
                    <option key={clave} value={clave}>
                      {TEXTO_SEVERIDAD[clave]}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} md={6}>
              <Form.Group controlId="incidente-zona">
                <Form.Label>Zona</Form.Label>
                <Form.Select value={zonaId} onChange={(e) => setZonaId(e.target.value)} disabled={procesando}>
                  <option value="">Sin zona</option>
                  {(zonas.data?.datos ?? []).map((zona) => (
                    <option key={zona.id} value={zona.id}>
                      {zona.codigo} · {zona.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} md={6}>
              <Form.Group controlId="incidente-fecha">
                <Form.Label>Fecha y hora en que ocurrió</Form.Label>
                <Form.Control type="datetime-local" value={fecha} max={ahoraLocal()} onChange={(e) => setFecha(e.target.value)} disabled={procesando} />
                <Form.Text className="text-body-secondary">Si lo dejas vacío, se usa el momento del reporte.</Form.Text>
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="incidente-descripcion">
                <Form.Label>
                  Descripción<span className="text-danger"> *</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  maxLength={2000}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  isInvalid={!!errorDescripcion}
                  disabled={procesando}
                />
                <Form.Control.Feedback type="invalid">{errorDescripcion}</Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          {error ? (
            <Alert variant="danger" className="py-2 mt-3 mb-0">
              {error instanceof ErrorApi ? error.message : 'No se pudo guardar. Intenta de nuevo.'}
            </Alert>
          ) : null}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={alCancelar} disabled={procesando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={procesando} className="d-inline-flex align-items-center gap-2">
            {procesando && <Spinner animation="border" size="sm" />}
            Reportar incidente
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}