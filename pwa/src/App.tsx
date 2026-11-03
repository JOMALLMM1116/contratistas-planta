import BotonTema from './componentes/BotonTema'

export default function App() {
  return (
    <main className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Control Planta</h1>
        <BotonTema />
      </div>
      <p className="text-body-secondary mb-0">PWA en construcción.</p>
    </main>
  )
}
