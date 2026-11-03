import { useQueryClient } from '@tanstack/react-query'
import { Button, Card } from 'react-bootstrap'
import { LogOut } from 'lucide-react'
import { useSesion } from '../../sesion/contexto'

export default function CuentaPagina() {
  const { perfil, cerrarSesion } = useSesion()
  const queryClient = useQueryClient()

  async function salir() {
    await cerrarSesion()
    // En un teléfono compartido, el siguiente usuario no debe ver datos del anterior
    queryClient.clear()
  }

  if (!perfil) return null

  return (
    <>
      <h1 className="h5 mb-3">Cuenta</h1>
      <Card className="shadow-sm mb-3">
        <Card.Body>
          <div className="fw-semibold">{perfil.nombre_completo}</div>
          <div className="text-body-secondary small">{perfil.email}</div>
          <div className="small mt-2">{perfil.rol.nombre}</div>
        </Card.Body>
      </Card>
      <Button variant="outline-danger" className="w-100 d-flex align-items-center justify-content-center gap-2" onClick={() => void salir()}>
        <LogOut size={18} aria-hidden="true" /> Cerrar sesión
      </Button>
    </>
  )
}
