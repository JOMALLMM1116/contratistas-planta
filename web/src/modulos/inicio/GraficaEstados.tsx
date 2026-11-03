import { Card } from 'react-bootstrap'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { infoEstado, type EntidadEstado, type Variante } from '../../utilidades/estados'

// Colores del tema de Bootstrap: cambian solos entre tema claro y oscuro (nada escrito a mano)
const COLOR: Record<Variante, string> = {
  primary: 'var(--bs-primary)',
  success: 'var(--bs-success)',
  danger: 'var(--bs-danger)',
  warning: 'var(--bs-warning)',
  info: 'var(--bs-info)',
  neutro: 'var(--bs-secondary)',
}

interface Props {
  titulo: string
  entidad: Extract<EntidadEstado, 'solicitud' | 'permiso_trabajo'>
  /** Estados en el orden en que se muestran */
  orden: readonly string[]
  conteos: Record<string, number>
}

/** Barras horizontales por estado. Solo se dibujan los estados con registros. */
export default function GraficaEstados({ titulo, entidad, orden, conteos }: Props) {
  const datos = orden
    .map((estado) => {
      const info = infoEstado(entidad, estado)
      return { estado, nombre: info.texto, valor: conteos[estado] ?? 0, color: COLOR[info.variante] }
    })
    .filter((d) => d.valor > 0)

  const resumen = datos.map((d) => `${d.nombre}: ${d.valor}`).join(', ')

  return (
    <Card className="h-100">
      <Card.Body>
        <h2 className="h6 mb-3">{titulo}</h2>

        {datos.length === 0 ? (
          <p className="mb-0">Sin registros.</p>
        ) : (
          <div role="img" aria-label={`${titulo}. ${resumen}`}>
            <ResponsiveContainer width="100%" height={Math.max(140, datos.length * 46 + 16)}>
              <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  width={118}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--bs-body-color)', fontSize: 13 }}
                />
                <Tooltip
                  cursor={{ fill: 'var(--bs-tertiary-bg)' }}
                  contentStyle={{
                    background: 'var(--bs-body-bg)',
                    border: '1px solid var(--bs-border-color)',
                    borderRadius: 8,
                    color: 'var(--bs-body-color)',
                  }}
                  labelStyle={{ color: 'var(--bs-body-color)' }}
                  itemStyle={{ color: 'var(--bs-body-color)' }}
                />
                <Bar dataKey="valor" name="Cantidad" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {datos.map((d) => (
                    <Cell key={d.estado} fill={d.color} />
                  ))}
                  <LabelList dataKey="valor" position="right" fill="var(--bs-body-color)" fontSize={13} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}