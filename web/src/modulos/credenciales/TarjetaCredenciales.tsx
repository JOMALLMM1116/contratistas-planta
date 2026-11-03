import { useState } from 'react'
import { Button, Card, Spinner, Table } from 'react-bootstrap'
import { BadgeCheck, QrCode, ShieldOff } from 'lucide-react'
import EstadoBadge from '../../componentes/EstadoBadge'
import ConfirmarAccion from '../../componentes/ConfirmarAccion'
import { ErrorApi } from '../../api/cliente'
import { useSesion } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'
import { formatearDia, formatearFechaHora } from '../../utilidades/fechas'
import type { SolicitudDetalle } from '../solicitudes/tipos'
import { useCredencialesDeSolicitud, useEmitirCredencial, useRevocarCredencial } from './credenciales.api'
import { textoUsos, type Credencial, type CredencialConQr } from './tipos'
import ModalEmitir from './ModalEmitir'
import ModalQr from './ModalQr'

function mensajeError(error: unknown): string | null {
  if (!error) return null
  return error instanceof ErrorApi ? error.message : 'No se pudo completar la acción.'
}

interface Props {
  solicitud: SolicitudDetalle
}

/** Credenciales de una solicitud aprobada: emitir, ver QR, imprimir pase y revocar */
export default function TarjetaCredenciales({ solicitud }: Props) {
  const { perfil } = useSesion()
  const puedeVer = tienePermiso(perfil, 'credenciales.emitir', 'credenciales.revocar', 'garita.validar')
  const puedeEmitir = tienePermiso(perfil, 'credenciales.emitir')
  const puedeRevocar = tienePermiso(perfil, 'credenciales.revocar')
  const visible = solicitud.estado === 'aprobada' && puedeVer

  const credenciales = useCredencialesDeSolicitud(solicitud.id, visible)
  const emitir = useEmitirCredencial()
  const revocar = useRevocarCredencial()

  const [emitirPara, setEmitirPara] = useState<{ id: string; nombre: string } | null>(null)
  const [verQr, setVerQr] = useState<{ id: string; nombre: string; inicial?: CredencialConQr } | null>(null)
  const [revocarCred, setRevocarCred] = useState<{ credencial: Credencial; nombre: string } | null>(null)

  if (!visible) return null

  const vigenciaHasta = `${formatearDia(solicitud.fecha_fin)} ${solicitud.hora_fin}`

  return (
    <Card className="shadow-sm mb-3">
      <Card.Body className="pb-0">
        <h2 className="h6 mb-1">Credenciales</h2>
        <p className="small text-body-secondary mb-3">Válidas hasta el {vigenciaHasta}.</p>
      </Card.Body>

      {credenciales.isPending ? (
        <Card.Body className="pt-0">
          <Spinner animation="border" size="sm" />
        </Card.Body>
      ) : credenciales.isError ? (
        <Card.Body className="pt-0 text-danger">{mensajeError(credenciales.error)}</Card.Body>
      ) : (
        <Table responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Contratista</th>
              <th>Credencial</th>
              <th className="d-none d-md-table-cell">Vence</th>
              <th className="d-none d-md-table-cell">Usos</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {solicitud.solicitud_contratistas.map(({ contratistas: c }) => {
              const nombre = `${c.nombres} ${c.apellidos}`
              const delContratista = credenciales.data.filter((x) => x.contratista_id === c.id)
              const activa = delContratista.find((x) => x.estado_efectivo === 'activa')
              const ultima = delContratista[0]

              return (
                <tr key={c.id}>
                  <td>{nombre}</td>
                  <td>
                    {activa ? (
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className="fw-semibold numeros-tabulares">{activa.codigo_corto}</span>
                        <EstadoBadge entidad="credencial" estado={activa.estado_efectivo} />
                      </div>
                    ) : ultima ? (
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className="small text-body-secondary">Última:</span>
                        <EstadoBadge entidad="credencial" estado={ultima.estado_efectivo} />
                      </div>
                    ) : (
                      <span className="text-body-secondary">Sin credencial</span>
                    )}
                  </td>
                  <td className="d-none d-md-table-cell text-nowrap">{activa ? formatearFechaHora(activa.expira_en) : '—'}</td>
                  <td className="d-none d-md-table-cell">{activa ? textoUsos(activa) : '—'}</td>
                  <td>
                    <div className="d-flex flex-wrap justify-content-end gap-2">
                      {activa ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="d-inline-flex align-items-center gap-1"
                            onClick={() => setVerQr({ id: activa.id, nombre })}
                          >
                            <QrCode size={16} /> Ver QR
                          </Button>
                          {puedeRevocar && (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="d-inline-flex align-items-center gap-1"
                              onClick={() => {
                                revocar.reset()
                                setRevocarCred({ credencial: activa, nombre })
                              }}
                            >
                              <ShieldOff size={16} /> Revocar
                            </Button>
                          )}
                        </>
                      ) : (
                        puedeEmitir && (
                          <Button
                            size="sm"
                            className="d-inline-flex align-items-center gap-1"
                            onClick={() => {
                              emitir.reset()
                              setEmitirPara({ id: c.id, nombre })
                            }}
                          >
                            <BadgeCheck size={16} /> Emitir
                          </Button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}

      {/* Diálogos */}
      <ModalEmitir
        mostrar={emitirPara !== null}
        nombreContratista={emitirPara?.nombre ?? ''}
        vigenciaHasta={vigenciaHasta}
        procesando={emitir.isPending}
        error={mensajeError(emitir.error)}
        alEmitir={(usos) => {
          if (!emitirPara) return
          const para = emitirPara
          emitir.mutate(
            { solicitud_id: solicitud.id, contratista_id: para.id, usos_maximos: usos },
            {
              // Al emitir, se muestra de inmediato el QR recién creado
              onSuccess: (creada) => {
                setEmitirPara(null)
                setVerQr({ id: creada.id, nombre: para.nombre, inicial: creada })
              },
            },
          )
        }}
        alCancelar={() => setEmitirPara(null)}
      />

      <ModalQr
        credencialId={verQr?.id ?? null}
        nombreContratista={verQr?.nombre ?? ''}
        inicial={verQr?.inicial}
        alCerrar={() => setVerQr(null)}
      />

      <ConfirmarAccion
        mostrar={revocarCred !== null}
        titulo="Revocar credencial"
        mensaje={
          revocarCred
            ? `La credencial ${revocarCred.credencial.codigo_corto} de ${revocarCred.nombre} dejará de funcionar en garita de inmediato.`
            : ''
        }
        textoConfirmar="Revocar"
        variante="danger"
        pedirMotivo
        etiquetaMotivo="Motivo de la revocación"
        procesando={revocar.isPending}
        error={mensajeError(revocar.error)}
        alConfirmar={(motivo) => {
          if (!revocarCred) return
          revocar.mutate({ id: revocarCred.credencial.id, motivo }, { onSuccess: () => setRevocarCred(null) })
        }}
        alCancelar={() => setRevocarCred(null)}
      />
    </Card>
  )
}
