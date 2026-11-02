import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Alert, Button, Form, InputGroup, Spinner } from 'react-bootstrap'
import { ChevronRight, ChevronsLeft, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react'
import { useSesion } from '../../sesion/contexto'
import { ErrorApi } from '../../api/cliente'
import BotonTema from '../../componentes/BotonTema'
import './login.css'

const esquema = z.object({
  email: z.email('Ingresa un correo válido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})

type DatosLogin = z.infer<typeof esquema>

// Distancia mínima (px) que el dedo debe deslizarse a la izquierda para pasar al login
const DISTANCIA_DESLIZAR = 60

// La presentación en celular sale una vez por pestaña: se borra al cerrarla
const CLAVE_INTRO = 'cp_intro_vista'

function introYaVista(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_INTRO) === '1'
  } catch {
    return false
  }
}

export default function LoginPagina() {
  const { perfil, iniciarSesion } = useSesion()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [verPassword, setVerPassword] = useState(false)
  const [errorServidor, setErrorServidor] = useState<string | null>(null)

  // Presentación en celular: visible hasta que el usuario toque el botón o deslice
  const [introVisible, setIntroVisible] = useState(() => !introYaVista())
  const inicioToque = useRef<number | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DatosLogin>({ resolver: zodResolver(esquema) })

  function ocultarIntro() {
    setIntroVisible(false)
    try {
      sessionStorage.setItem(CLAVE_INTRO, '1')
    } catch {
      // Sin almacenamiento: solo se oculta esta vez
    }
  }

  // A dónde volver después del login (la página que pidió antes de iniciar sesión)
  const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/'

  // Si ya tiene sesión, no tiene sentido mostrar el login
  if (perfil) return <Navigate to={destino} replace />

  const enviar = handleSubmit(async (datos) => {
    setErrorServidor(null)
    try {
      await iniciarSesion(datos.email, datos.password)
      navegar(destino, { replace: true })
    } catch (error) {
      // El backend ya responde en español: credenciales inválidas, cuenta bloqueada, demasiados intentos...
      setErrorServidor(error instanceof ErrorApi ? error.message : 'No se pudo iniciar sesión.')
    }
  })

  return (
    <div className="login">
      {/* Panel azul: columna izquierda en escritorio; presentación deslizable en celular */}
      <aside
        className={`login__marca${introVisible ? '' : ' login__marca--oculta'}`}
        onTouchStart={(e) => {
          inicioToque.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (inicioToque.current === null) return
          const recorrido = e.changedTouches[0].clientX - inicioToque.current
          inicioToque.current = null
          if (recorrido < -DISTANCIA_DESLIZAR) ocultarIntro()
        }}
      >
        <div className="login__franja" aria-hidden="true" />
        <div className="login__marca-contenido">
          <div className="login__logo">
            <ShieldCheck size={44} strokeWidth={1.75} />
            <span>Control Planta</span>
          </div>
          <h1 className="login__titulo">Acceso controlado a planta</h1>
          <p className="login__descripcion">Contratistas, permisos de trabajo y garita en un solo sistema.</p>

          {/* Solo en celular y tablet */}
          <div className="login__acciones-intro d-lg-none">
            <Button variant="light" className="login__continuar" onClick={ocultarIntro}>
              Ir a iniciar sesión <ChevronRight size={18} />
            </Button>
            <span className="login__pista">
              <ChevronsLeft size={16} /> o desliza hacia la izquierda
            </span>
          </div>
        </div>
      </aside>

      {/* Formulario */}
      <main className="login__formulario">
        <BotonTema className="login__boton-tema" />

        {/* Logo en celular y tablet (cuando el panel azul ya se deslizó) */}
        <div className="login__logo-movil d-lg-none">
          <ShieldCheck size={32} strokeWidth={1.75} />
          <span>Control Planta</span>
        </div>

        <div className="login__tarjeta">
          <h2 className="h4 mb-1">Iniciar sesión</h2>
          <p className="text-body-secondary mb-4">Usa el correo de la planta o de tu empresa.</p>

          {errorServidor && (
            <Alert variant="danger" className="py-2">
              {errorServidor}
            </Alert>
          )}

          <Form noValidate onSubmit={enviar}>
            <Form.Group className="mb-3" controlId="email">
              <Form.Label>Correo</Form.Label>
              <Form.Control
                type="email"
                autoComplete="username"
                isInvalid={!!errors.email}
                {...register('email')}
              />
              <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-4" controlId="password">
              <Form.Label>Contraseña</Form.Label>
              <InputGroup hasValidation>
                <Form.Control
                  type={verPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  isInvalid={!!errors.password}
                  {...register('password')}
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
                <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
              </InputGroup>
            </Form.Group>

            <Button type="submit" className="w-100 d-flex align-items-center justify-content-center gap-2" disabled={isSubmitting}>
              {isSubmitting ? <Spinner animation="border" size="sm" /> : <LogIn size={18} />}
              {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </Button>
          </Form>

          <div className="text-center mt-3">
            <Link to="/recuperar">¿Olvidaste tu contraseña?</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
