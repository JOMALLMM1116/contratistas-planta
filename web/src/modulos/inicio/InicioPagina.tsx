import { Badge, Button, Card, Container } from 'react-bootstrap'
import { LogOut } from 'lucide-react'
import { useSesion } from '../../sesion/contexto'

// Página temporal para probar la sesión. Luego será el dashboard dentro del layout.
export default function InicioPagina() {
  const { perfil, cerrarSesion } = useSesion()
  if (!perfil) return null

  return (
    <Container className="py-5">
      <Card className="shadow-sm">
        <Card.Body>
          <h1 className="h4 mb-1">Hola, {perfil.nombre_completo}</h1>
          <p className="text-body-secondary mb-3">
            {perfil.email} | {perfil.rol.nombre} ({perfil.rol.es_interno ? 'interno' : 'externo'})
          </p>

          <h2 className="h6">Permisos</h2>
          <div className="d-flex flex-wrap gap-2 mb-4">
            {perfil.permisos.map((permiso) => (
              <Badge key={permiso} bg="primary-subtle" text="primary-emphasis">
                {permiso}
              </Badge>
            ))}
          </div>

          <Button variant="outline-secondary" className="d-flex align-items-center gap-2" onClick={() => void cerrarSesion()}>
            <LogOut size={18} /> Cerrar sesión
          </Button>
        </Card.Body>
      </Card>
    </Container>
  )
}
