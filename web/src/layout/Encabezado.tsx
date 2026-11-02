import { Button, Dropdown } from 'react-bootstrap'
import { LogOut, Menu, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useSesion } from '../sesion/contexto'
import BotonTema from '../componentes/BotonTema'

interface Props {
  alAbrirMenu: () => void
}

export default function Encabezado({ alAbrirMenu }: Props) {
  const { perfil, cerrarSesion } = useSesion()
  const navegar = useNavigate()
  const queryClient = useQueryClient()

  async function salir() {
    await cerrarSesion()
    // Borra los datos en memoria: en una PC compartida (garita) el siguiente usuario no ve nada del anterior
    queryClient.clear()
    navegar('/login', { replace: true })
  }

  return (
    <header className="encabezado">
      <Button variant="outline-secondary" className="d-lg-none" onClick={alAbrirMenu} aria-label="Abrir menú" title="Abrir menú">
        <Menu size={20} />
      </Button>

      <div className="encabezado__acciones ms-auto">
        <BotonTema />

        <Dropdown align="end">
          <Dropdown.Toggle variant="outline-secondary" className="encabezado__usuario">
            <User size={18} />
            <span className="d-none d-sm-inline">{perfil?.nombre_completo}</span>
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Header>
              <div className="fw-semibold text-body">{perfil?.nombre_completo}</div>
              <div className="small">{perfil?.rol.nombre}</div>
            </Dropdown.Header>
            <Dropdown.Divider />
            <Dropdown.Item as="button" onClick={() => void salir()}>
              <LogOut size={16} className="me-2" />
              Cerrar sesión
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </header>
  )
}
