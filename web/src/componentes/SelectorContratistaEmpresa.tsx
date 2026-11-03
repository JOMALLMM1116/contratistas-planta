import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, InputGroup, ListGroup } from 'react-bootstrap'
import { Search, X } from 'lucide-react'
import { api } from '../api/cliente'
import type { RespuestaPaginada } from '../api/tipos'

/** A quién se refiere un registro: un contratista o una empresa */
export interface Objetivo {
  tipo: 'contratista' | 'empresa'
  id: string
  nombre: string
  detalle: string
}

interface Props {
  tipo: 'contratista' | 'empresa'
  valor: Objetivo | null
  error?: string
  deshabilitado?: boolean
  alCambiar: (objetivo: Objetivo | null) => void
}

interface ContratistaApi {
  id: string
  nombres: string
  apellidos: string
  documento_identidad: string
  empresas_contratistas: { razon_social: string }
}

interface EmpresaApi {
  id: string
  nit: string
  razon_social: string
}

/** Busca contratistas o empresas activas. Al elegir una, queda fija con un botón para cambiarla. */
export default function SelectorContratistaEmpresa({ tipo, valor, error, deshabilitado, alCambiar }: Props) {
  const [texto, setTexto] = useState('')
  const [buscar, setBuscar] = useState('')

  // Espera a que se deje de escribir antes de consultar
  useEffect(() => {
    const espera = setTimeout(() => setBuscar(texto.trim()), 300)
    return () => clearTimeout(espera)
  }, [texto])

  // Al cambiar entre contratista y empresa, la búsqueda empieza de cero
  useEffect(() => {
    setTexto('')
    setBuscar('')
  }, [tipo])

  const consulta = useQuery({
    queryKey: ['selector-contratista-empresa', tipo, buscar],
    queryFn: async (): Promise<Objetivo[]> => {
      if (tipo === 'contratista') {
        const r = await api.get<RespuestaPaginada<ContratistaApi>>('/contratistas', {
          buscar,
          estado: 'activo',
          por_pagina: 8,
          ordenar_por: 'apellidos',
        })
        return r.datos.map((c) => ({
          tipo,
          id: c.id,
          nombre: `${c.nombres} ${c.apellidos}`,
          detalle: `${c.documento_identidad} · ${c.empresas_contratistas.razon_social}`,
        }))
      }
      const r = await api.get<RespuestaPaginada<EmpresaApi>>('/empresas-contratistas', {
        buscar,
        estado: 'activa',
        por_pagina: 8,
        ordenar_por: 'razon_social',
      })
      return r.datos.map((e) => ({ tipo, id: e.id, nombre: e.razon_social, detalle: `NIT ${e.nit}` }))
    },
    enabled: valor === null,
    staleTime: 30_000,
  })

  if (valor) {
    return (
      <div className="d-flex align-items-center justify-content-between gap-2 border rounded px-3 py-2">
        <div className="text-break">
          <div className="fw-semibold">{valor.nombre}</div>
          <small className="text-body-secondary">{valor.detalle}</small>
        </div>
        <Button variant="outline-secondary" size="sm" title="Cambiar" aria-label="Cambiar selección" disabled={deshabilitado} onClick={() => alCambiar(null)}>
          <X size={16} aria-hidden="true" />
        </Button>
      </div>
    )
  }

  const opciones = consulta.data ?? []

  return (
    <div>
      <InputGroup>
        <InputGroup.Text>
          <Search size={16} aria-hidden="true" />
        </InputGroup.Text>
        <Form.Control
          type="search"
          autoComplete="off"
          placeholder={tipo === 'contratista' ? 'Buscar por nombre o documento' : 'Buscar por NIT o razón social'}
          aria-label={tipo === 'contratista' ? 'Buscar contratista' : 'Buscar empresa'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          isInvalid={!!error}
          disabled={deshabilitado}
        />
      </InputGroup>
      {error && <div className="text-danger small mt-1">{error}</div>}

      <ListGroup className="mt-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
        {consulta.isPending && <ListGroup.Item disabled>Buscando…</ListGroup.Item>}
        {consulta.isError && <ListGroup.Item className="text-danger">No se pudo buscar. Intenta de nuevo.</ListGroup.Item>}
        {consulta.isSuccess && opciones.length === 0 && <ListGroup.Item disabled>Sin resultados</ListGroup.Item>}
        {opciones.map((opcion) => (
          <ListGroup.Item key={opcion.id} action disabled={deshabilitado} onClick={() => alCambiar(opcion)}>
            <div>{opcion.nombre}</div>
            <small className="text-body-secondary">{opcion.detalle}</small>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </div>
  )
}