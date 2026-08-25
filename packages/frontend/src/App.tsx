import ProductDashboard from './components/ProductDashboard';
import { ToastProvider } from './components/ui/ToastProvider';
import ApiStatusBanner from './components/ui/ApiStatusBanner';

function App() {
  return (
    <ToastProvider>
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
          <div className="mx-auto max-w-5xl flex items-center justify-between p-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">SimpleStock</h1>
              <p className="text-sm text-gray-500">Sistema de controle de estoque simplificado</p>
            </div>
          </div>
        </header>

        <ApiStatusBanner />

        <section className="mx-auto max-w-5xl p-4">
          <ProductDashboard />
        </section>
      </main>
    </ToastProvider>
  );
}

export default App;
