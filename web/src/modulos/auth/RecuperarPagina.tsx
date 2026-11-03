import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Alert, Button, Form, Spinner } from 'react-bootstrap'
import { MailCheck, Send } from 'lucide-react'
import { api, ErrorApi } from '../../api/cliente'
import PantallaAuth from './PantallaAuth'

const esquema = z.object({
  email: z.email('Ingresa un correo válido'),
})

type Datos = z.infer<typeof esquema>

export default function RecuperarPagina() {
  const [enviado, setEnviado] = useState(false)
  const [errorServidor, setErrorServidor] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) })

  const enviar = handleSubmit(async ({ email }) => {
    setErrorServidor(null)
    try {
      await api.post('/auth/recuperar', { email })
      setEnviado(true)
    } catch (error) {
      // Incluye "demasiados intentos": el backend limita estas peticiones
      setErrorServidor(error instanceof ErrorApi ? error.message : 'No se pudo enviar la solicitud. Intenta de nuevo.')
    }
  })

  if (enviado) {
    return (
      <PantallaAuth titulo="Revisa tu correo">
        <Alert variant="success" className="d-flex align-items-start gap-2">
          <MailCheck size={20} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>Si el correo está registrado, recibirás las instrucciones para restablecer tu contraseña.</span>
        </Alert>
        <Link to="/login">Volver a iniciar sesión</Link>
      </PantallaAuth>
    )
  }

  return (
    <PantallaAuth titulo="Recuperar contraseña" descripcion="Escribe tu correo y te enviaremos las instrucciones para crear una contraseña nueva.">
      {errorServidor && (
        <Alert variant="danger" className="py-2">
          {errorServidor}
        </Alert>
      )}

      <Form noValidate onSubmit={enviar}>
        <Form.Group className="mb-4" controlId="recuperar-email">
          <Form.Label>Correo</Form.Label>
          <Form.Control
            type="email"
            autoComplete="username"
            isInvalid={!!errors.email}
            {...register('email', { setValueAs: (v: string) => v.trim() })}
          />
          <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
        </Form.Group>

        <Button type="submit" className="w-100 d-flex align-items-center justify-content-center gap-2" disabled={isSubmitting}>
          {isSubmitting ? <Spinner animation="border" size="sm" /> : <Send size={18} aria-hidden="true" />}
          {isSubmitting ? 'Enviando…' : 'Enviar instrucciones'}
        </Button>
      </Form>

      <div className="text-center mt-3">
        <Link to="/login">Volver a iniciar sesión</Link>
      </div>
    </PantallaAuth>
  )
}