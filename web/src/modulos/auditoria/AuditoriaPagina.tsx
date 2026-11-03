import { useState } from 'react'
import { Nav } from 'react-bootstrap'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import EventosPestana from './EventosPestana'
import HistorialPestana from './HistorialPestana'

type Pestana = 'eventos' | 'historial'

export default function AuditoriaPagina() {
  const [pestana, setPestana] = useState<Pestana>('eventos')
  const [inicial, setInicial] = useState<{ entidad: string; id: string } | null>(null)

  function verHistorial(entidad: string, id: string) {
    setInicial({ entidad, id })
    setPestana('historial')
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Auditoría"
        descripcion="Registro de lo que hacen los usuarios en el sistema y de los cambios de estado. Es solo de consulta."
      />

      <Nav variant="tabs" className="mb-3" activeKey={pestana} onSelect={(clave) => clave && setPestana(clave as Pestana)}>
        <Nav.Item>
          <Nav.Link eventKey="eventos">Eventos</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="historial">Historial de estados</Nav.Link>
        </Nav.Item>
      </Nav>

      {/* Las dos pestañas siguen montadas para conservar sus filtros al cambiar de una a otra */}
      <div className={pestana === 'eventos' ? '' : 'd-none'}>
        <EventosPestana alVerHistorial={verHistorial} />
      </div>
      <div className={pestana === 'historial' ? '' : 'd-none'}>
        <HistorialPestana inicial={inicial} />
      </div>
    </>
  )
}