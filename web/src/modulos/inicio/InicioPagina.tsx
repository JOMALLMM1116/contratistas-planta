import { Badge, Card } from 'react-bootstrap'
import { useSesion } from '../../sesion/contexto'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'

// Página temporal: luego será el dashboard con datos de /api/reportes/dashboard
export default function InicioPagina() {
  const { perfil } = useSesion()
  if (!perfil) return null

  return (
    <>
      <EncabezadoPagina titulo={`Hola, ${perfil.nombre_completo}`} descripcion={perfil.rol.nombre} />

      <Card className="shadow-sm">
        <Card.Body>
          <h2 className="h6">Tus permisos</h2>
          <div className="d-flex flex-wrap gap-2">
            {perfil.permisos.map((permiso) => (
              <Badge key={permiso} bg="primary-subtle" text="primary-emphasis">
                {permiso}
              </Badge>
            ))}
          </div>
        </Card.Body>
      </Card>
    </>
  )
}
