import { useSesion } from '../../sesion/contexto'

// Temporal: en el paso 85 se reemplaza por la credencial con el QR a pantalla completa
export default function MiCredencialPagina() {
  const { perfil } = useSesion()
  return (
    <>
      <h1 className="h5 mb-1">Mi credencial</h1>
      <p className="text-body-secondary mb-0">Hola, {perfil?.nombre_completo}.</p>
    </>
  )
}
