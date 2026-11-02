import { Badge, Button, Card, Container } from 'react-bootstrap'
import { ShieldCheck } from 'lucide-react'

export default function App() {
  return (
    <Container className="py-5">
      <h1 className="d-flex align-items-center gap-2">
        <ShieldCheck size={32} /> Control Planta
      </h1>
      <p className="text-body-secondary">Prueba del tema: colores, fuente e iconos.</p>

      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-wrap gap-2">
          <Button variant="primary">Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="success">Aprobar</Button>
          <Button variant="danger">Rechazar</Button>
          <Button variant="outline-primary">Contorno</Button>
        </Card.Body>
        <Card.Body className="d-flex flex-wrap gap-2 border-top">
          <Badge bg="success-subtle" text="success-emphasis">Aprobada</Badge>
          <Badge bg="info-subtle" text="info-emphasis">Pendiente</Badge>
          <Badge bg="warning-subtle" text="warning-emphasis">En revisión</Badge>
          <Badge bg="danger-subtle" text="danger-emphasis">Revocada</Badge>
        </Card.Body>
      </Card>
    </Container>
  )
}
