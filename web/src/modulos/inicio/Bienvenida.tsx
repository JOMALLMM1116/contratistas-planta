import { Link } from 'react-router-dom'
import { Card, Col, Row } from 'react-bootstrap'
import EncabezadoPagina from '../../componentes/EncabezadoPagina'
import { MENU } from '../../layout/menu'
import type { Perfil } from '../../sesion/contexto'
import { tienePermiso } from '../../sesion/permisos'

/** Inicio para quien no tiene reportes.ver: saludo y accesos a lo que su rol sí puede usar */
export default function Bienvenida({ perfil }: { perfil: Perfil }) {
  const grupos = MENU.map((grupo) => ({
    titulo: grupo.titulo,
    opciones: grupo.opciones.filter((o) => o.ruta !== '/' && o.permisos && tienePermiso(perfil, ...o.permisos)),
  })).filter((grupo) => grupo.opciones.length > 0)

  return (
    <>
      <EncabezadoPagina titulo={`Hola, ${perfil.nombre_completo}`} descripcion={perfil.rol.nombre} />

      {grupos.length === 0 ? (
        <Card body>
          <p className="mb-0">Todavía no tienes opciones asignadas. Consulta con el administrador del sistema.</p>
        </Card>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.titulo} className="mb-4" aria-label={grupo.titulo}>
            <h2 className="h6 mb-2">{grupo.titulo}</h2>
            <Row className="g-3">
              {grupo.opciones.map((opcion) => {
                const Icono = opcion.icono
                return (
                  <Col key={opcion.ruta} xs={12} sm={6} lg={4}>
                    <Link to={opcion.ruta} className="text-decoration-none text-reset d-block h-100">
                      <Card className="h-100">
                        <Card.Body className="d-flex align-items-center gap-3">
                          <Icono size={24} aria-hidden="true" />
                          <span className="fw-semibold">{opcion.etiqueta}</span>
                        </Card.Body>
                      </Card>
                    </Link>
                  </Col>
                )
              })}
            </Row>
          </section>
        ))
      )}
    </>
  )
}