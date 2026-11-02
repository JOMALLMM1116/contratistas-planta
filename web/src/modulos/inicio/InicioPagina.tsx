import { Badge, Card } from 'react-bootstrap'
import { useSesion } from '../../sesion/contexto'

// Página temporal: luego será el dashboard con datos de /api/reportes/dashboard
export default function InicioPagina() {
  const { perfil } = useSesion()
  if (!perfil) return null

  return (
    <>
      <h1 className="h3 mb-1">Hola, {perfil.nombre_completo}</h1>
      <p className="text-body-secondary mb-4">{perfil.rol.nombre}</p>

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
