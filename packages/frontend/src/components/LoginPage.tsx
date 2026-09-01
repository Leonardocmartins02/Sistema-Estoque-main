import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ApiRequestError } from '../api/httpClient';
import { useAuth } from '../auth/AuthContext';

import { Button } from './ui/Button';
import { Input } from './ui/Input';

const loginSchema = z.object({
  email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
    } catch (err) {
      setServerError(
        err instanceof ApiRequestError ? err.message : 'Não foi possível entrar. Tente novamente.',
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Largura própria e estreita (design-system.md §4.4): o teto de
          1536px do shell (D-B) não se aplica a esta superfície. */}
      <div className="w-full max-w-sm rounded-surface border border-border bg-surface p-6">
        <h1 className="text-page-title text-text-primary">SimpleStock</h1>
        <p className="mt-1 text-sm text-text-secondary">Entre com sua conta para continuar.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="E-mail"
            type="email"
            autoComplete="username"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          {serverError && (
            <p role="alert" className="text-sm text-danger">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isSubmitting}
          >
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
