import { useAuth } from './auth/AuthContext';
import { LoginPage } from './components/LoginPage';
import ProductDashboard from './components/ProductDashboard';
import ApiStatusBanner from './components/ui/ApiStatusBanner';
import { Button } from './components/ui/Button';

function App() {
  const { status, user, logout } = useAuth();

  if (status === 'loading') {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center text-sm text-gray-600">
        Carregando...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Skip link: sem ele o usuário de teclado precisa tabular por todo o
          header sticky antes de chegar na lista de produtos. Fica visível
          apenas quando focado. */}
      <a
        href="#main-content"
        className="sr-only rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999]"
      >
        Pular para o conteúdo principal
      </a>

      <header className="sticky top-0 z-40 border-b bg-white/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">SimpleStock</h1>
            <p className="text-sm text-gray-600">Sistema de controle de estoque simplificado</p>
          </div>
          <div className="flex items-center gap-3">
            {user && <span className="hidden text-sm text-gray-600 sm:inline">{user.email}</span>}
            <Button variant="secondary" size="sm" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <ApiStatusBanner />

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl p-4 focus:outline-none">
        <ProductDashboard />
      </main>
    </div>
  );
}

export default App;
