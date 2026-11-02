import { Button } from 'react-bootstrap'
import { Moon, Sun } from 'lucide-react'
import { useTema } from '../apariencia/tema'

export default function BotonTema({ className }: { className?: string }) {
  const { tema, alternar } = useTema()
  const etiqueta = tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'

  return (
    <Button variant="outline-secondary" className={className} onClick={alternar} aria-label={etiqueta} title={etiqueta}>
      {tema === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  )
}
