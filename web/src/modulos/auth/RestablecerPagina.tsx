import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Alert, Button, Form, Spinner } from 'react-bootstrap'
import { CircleCheck, KeyRound } from 'lucide-react'
import { api, ErrorApi } from '../../api/cliente'
import PantallaAuth from './PantallaAuth'

// Misma política que el backend: 8 caracteres, al menos una letra y un número
const esquema = z
  .object({
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(200, 'La contraseña es demasiado larga')
      .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
      .regex(/\d/, 'La contraseña debe incluir al menos un número'),
    confirmar: z.string().min(1, 'Confirma la contraseña'),
  })
  .refine((d) => d.password === d.confirmar, { message: 'Las contraseñas no coinciden', path: ['confirmar'] })

type Datos = z.infer<typeof esquema>

export default function RestablecerPagina() {
  // El token se lee una sola vez, al montar, y se guarda en memoria
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token')?.trim() ?? '')
  const [listo, setListo] = useState(false)
  const [errorServidor, setErrorServidor] = useState<string | null>(null)

  // Después de leerlo, se borra de la barra de direcciones (queda fuera del historial y de capturas).
  // Se conserva history.state para no romper el estado interno del router.
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash)
    }
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) })

  const enviar = handleSubmit(async ({ password }) => {
    setErrorServidor(null)
    try {
      await api.post('/auth/restablecer', { token, password })
      setListo(true)
    } catch (error) {
      // Enlace vencido o ya usado, demasiados intentos...: el backend responde en español
      setErrorServidor(error instanceof ErrorApi ? error.message : 'No se pudo restablecer la contraseña. Intenta de nuevo.')
    }
  })

  if (listo) {
    return (
      <PantallaAuth titulo="Contraseña actualizada">
        <Alert variant="success" className="d-flex align-items-start gap-2">
          <CircleCheck size={20} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>Tu contraseña se cambió correctamente. Ya puedes iniciar sesión con la nueva.</span>
        </Alert>
        <Link to="/login" className="btn btn-primary w-100">
          Ir a iniciar sesión
        </Link>
      </PantallaAuth>
    )
  }

  if (!token) {
    return (
      <PantallaAuth titulo="Enlace no válido">
        <Alert variant="warning">El enlace está incompleto o ya no es válido. Solicita uno nuevo para restablecer tu contraseña.</Alert>
        <div className="d-grid gap-2">
          <Link to="/recuperar" className="btn btn-primary">
            Solicitar un enlace nuevo
          </Link>
          <Link to="/login" className="text-center">
            Volver a iniciar sesión
          </Link>
        </div>
      </PantallaAuth>
    )
  }

  return (
    <PantallaAuth titulo="Nueva contraseña" descripcion="Elige una contraseña nueva para tu cuenta.">
      {errorServidor && (
        <Alert variant="danger" className="py-2">
          {errorServidor} <Link to="/recuperar">Solicitar un enlace nuevo</Link>
        </Alert>
      )}

      <Form noValidate onSubmit={enviar}>
        <Form.Group className="mb-3" controlId="restablecer-password">
          <Form.Label>Contraseña nueva</Form.Label>
          <Form.Control type="password" autoComplete="new-password" isInvalid={!!errors.password} {...register('password')} />
          <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
          <Form.Text>Mínimo 8 caracteres, con al menos una letra y un número.</Form.Text>
        </Form.Group>

        <Form.Group className="mb-4" controlId="restablecer-confirmar">
          <Form.Label>Confirmar contraseña</Form.Label>
          <Form.Control type="password" autoComplete="new-password" isInvalid={!!errors.confirmar} {...register('confirmar')} />
          <Form.Control.Feedback type="invalid">{errors.confirmar?.message}</Form.Control.Feedback>
        </Form.Group>

        <Button type="submit" className="w-100 d-flex align-items-center justify-content-center gap-2" disabled={isSubmitting}>
          {isSubmitting ? <Spinner animation="border" size="sm" /> : <KeyRound size={18} aria-hidden="true" />}
          {isSubmitting ? 'Guardando…' : 'Cambiar contraseña'}
        </Button>
      </Form>
    </PantallaAuth>
  )
}