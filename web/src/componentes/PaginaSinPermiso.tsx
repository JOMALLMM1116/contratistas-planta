import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

export default function PaginaSinPermiso() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center py-5 px-3">
      <ShieldAlert size={48} className="text-danger mb-3" />
      <h1 className="h4">No tienes permiso para ver esta página</h1>
      <p className="text-body-secondary">Tu rol no incluye este acceso. Si crees que es un error, habla con el administrador.</p>
      <Link to="/" className="btn btn-primary">
        Ir al inicio
      </Link>
    </div>
  )
}
