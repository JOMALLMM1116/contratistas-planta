import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, InputGroup, ListGroup } from 'react-bootstrap'
import { Check, Search, X } from 'lucide-react'
import { api } from '../api/cliente'
import type { RespuestaPaginada } from '../api/tipos'

interface EmpresaOpcion {
  id: string
  nit: string
  razon_social: string
  estado: 'activa' | 'inactiva'
}

interface Props {
  id: string
  etiqueta: string
  /** Id de la empresa elegida ('' = ninguna) */
  valor: string
  /** Empresa ya elegida (al editar): se muestra su nombre aunque no se haya buscado */
  actual?: { id: string; razon_social: string } | null
  /** true = solo empresas activas (para crear o editar); false = todas (para filtrar) */
  soloActivas?: boolean
  /** Texto de la opción que quita la selección (ej. "Todas las empresas"). Sin él no hay opción vacía */
  opcionVacia?: string
  requerido?: boolean
  error?: string
  deshabilitado?: boolean
  alCambiar: (empresaId: string) => void
}

const POR_PAGINA = 30

/** Campo con búsqueda: al escribir aparecen las coincidencias y al tocar una queda elegida. */
export default function SelectorEmpresa({
  id,
  etiqueta,
  valor,
  actual,
  soloActivas = true,
  opcionVacia,
  requerido,
  error,
  deshabilitado,
  alCambiar,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [buscar, setBuscar] = useState('')
  const [elegida, setElegida] = useState<{ id: string; razon_social: string } | null>(null)

  // Espera a que se deje de escribir antes de consultar
  useEffect(() => {
    const espera = setTimeout(() => setBuscar(texto.trim()), 300)
    return () => clearTimeout(espera)
  }, [texto])

  // Solo consulta cuando la lista está abierta
  const consulta = useQuery({
    queryKey: ['empresas-selector', { buscar, soloActivas }],
    queryFn: () =>
      api.get<RespuestaPaginada<EmpresaOpcion>>('/empresas-contratistas', {
        por_pagina: POR_PAGINA,
        buscar,
        estado: soloActivas ? 'activa' : undefined,
        ordenar_por: 'razon_social',
      }),
    enabled: abierto,
    staleTime: 30_000,
  })

  const opciones = consulta.data?.datos ?? []

  // Nombre de la empresa elegida: la que se tocó en esta lista, o la que ya tenía el registro
  const nombre =
    valor === ''
      ? null
      : elegida?.id === valor
        ? elegida.razon_social
        : actual?.id === valor
          ? actual.razon_social
          : 'Empresa seleccionada'

  function cerrar() {
    setAbierto(false)
    setTexto('')
  }

  function elegir(empresa: { id: string; razon_social: string } | null) {
    setElegida(empresa)
    alCambiar(empresa?.id ?? '')
    cerrar()
  }

  // Si el foco sale de todo el campo (no solo del texto), se cierra la lista
  function alSalir(evento: FocusEvent<HTMLDivElement>) {
    if (!contenedor.current?.contains(evento.relatedTarget as Node | null)) cerrar()
  }

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape' && abierto) {
      evento.stopPropagation()
      cerrar()
    }
  }

  return (
    <Form.Group controlId={id}>
      <Form.Label>
        {etiqueta}
        {requerido && <span className="text-danger"> *</span>}
      </Form.Label>

      <div ref={contenedor} className="position-relative" onBlur={alSalir} onKeyDown={alTeclear}>
        <InputGroup hasValidation>
          <InputGroup.Text>
            <Search size={16} aria-hidden="true" />
          </InputGroup.Text>
          <Form.Control
            type="text"
            role="combobox"
            aria-expanded={abierto}
            aria-controls={`${id}-lista`}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={nombre ?? 'Buscar por NIT o nombre'}
            value={abierto ? texto : (nombre ?? '')}
            onFocus={() => setAbierto(true)}
            onChange={(e) => {
              setTexto(e.target.value)
              setAbierto(true)
            }}
            isInvalid={!!error}
            disabled={deshabilitado}
          />
          {valor !== '' && !deshabilitado && (
            <Button variant="outline-secondary" title="Quitar empresa" aria-label="Quitar empresa" onClick={() => elegir(null)}>
              <X size={16} aria-hidden="true" />
            </Button>
          )}
          <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
        </InputGroup>

        {abierto && (
          <ListGroup
            id={`${id}-lista`}
            role="listbox"
            className="position-absolute start-0 end-0 mt-1 shadow overflow-auto"
            style={{ zIndex: 1060, maxHeight: 240 }}
          >
            {opcionVacia !== undefined && (
              <ListGroup.Item action role="option" aria-selected={valor === ''} onClick={() => elegir(null)}>
                {opcionVacia}
              </ListGroup.Item>
            )}

            {consulta.isPending && <ListGroup.Item disabled>Buscando…</ListGroup.Item>}
            {consulta.isError && <ListGroup.Item className="text-danger">No se pudieron cargar las empresas.</ListGroup.Item>}
            {consulta.isSuccess && opciones.length === 0 && <ListGroup.Item disabled>Sin resultados</ListGroup.Item>}

            {opciones.map((empresa) => (
              <ListGroup.Item
                key={empresa.id}
                action
                role="option"
                aria-selected={empresa.id === valor}
                className="d-flex align-items-center justify-content-between gap-2"
                onClick={() => elegir({ id: empresa.id, razon_social: empresa.razon_social })}
              >
                <span>
                  <span className="d-block">{empresa.razon_social}</span>
                  <small className="text-body-secondary">NIT {empresa.nit}</small>
                </span>
                {empresa.id === valor && <Check size={16} aria-hidden="true" />}
              </ListGroup.Item>
            ))}

            {opciones.length === POR_PAGINA && (
              <ListGroup.Item disabled className="small">
                Hay más empresas: escribe para acotar la búsqueda.
              </ListGroup.Item>
            )}
          </ListGroup>
        )}
      </div>
    </Form.Group>
  )
}