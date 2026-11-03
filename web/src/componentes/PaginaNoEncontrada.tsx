import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'

// Se muestra dentro del layout, por eso usa espacio vertical normal (py-5)
export default function PaginaNoEncontrada() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center py-5 px-3">
      <SearchX size={48} className="text-body-secondary mb-3" />
      <h1 className="h4">Página no encontrada</h1>
      <p className="text-body-secondary">La dirección no existe o fue movida.</p>
      <Link to="/" className="btn btn-primary">
        Ir al inicio
      </Link>
    </div>
  )
}
