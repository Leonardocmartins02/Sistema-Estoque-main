import { useAuth } from './auth/AuthContext';
import { LoginPage } from './components/LoginPage';
import ProductDashboard from './components/ProductDashboard';
import ApiStatusBanner from './components/ui/ApiStatusBanner';
import { Button } from './components/ui/Button';

function App() {
  const { status, user, logout } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Carregando...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <LoginPage />;
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
        <div className="mx-auto max-w-5xl flex items-center justify-between p-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">SimpleStock</h1>
            <p className="text-sm text-gray-500">Sistema de controle de estoque simplificado</p>
          </div>
          <div className="flex items-center gap-3">
            {user && <span className="hidden text-sm text-gray-500 sm:inline">{user.email}</span>}
            <Button variant="secondary" size="sm" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <ApiStatusBanner />

      <section className="mx-auto max-w-5xl p-4">
        <ProductDashboard />
      </section>
    </main>
  );
}

export default App;
