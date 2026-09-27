import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — VulnDesk" },
      {
        name: "description",
        content:
          "Acesse a plataforma VulnDesk para gerenciar vulnerabilidades, projetos de pentest e status de remediação.",
      },
      { property: "og:title", content: "Entrar — VulnDesk" },
      {
        property: "og:description",
        content: "Plataforma de gestão de vulnerabilidades para equipes de pentest e seus clientes.",
      },
    ],
  }),
  component: AuthPage,
});

const DEMO_PASSWORD = "demo1234";

const demoUsers = [
  { email: "pentester@example.com", label: "Pentester (Ana Ribeiro)", hint: "Acesso global" },
  { email: "cliente.alpha@example.com", label: "Cliente Alpha", hint: "Somente Empresa Alpha" },
  { email: "cliente.beta@example.com", label: "Cliente Beta", hint: "Somente Empresa Beta" },
];

const schema = z.object({
  email: z.string().trim().email("Informe um e-mail válido").max(255),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login(mail: string, pass: string) {
    setError(null);
    setLoading(mail);
    try {
      let { error: signInError } = await supabase.auth.signInWithPassword({
        email: mail,
        password: pass,
      });

      if (signInError) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: mail,
          password: pass,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) {
          setError(signInError.message);
          return;
        }
        ({ error: signInError } = await supabase.auth.signInWithPassword({
          email: mail,
          password: pass,
        }));
        if (signInError) {
          setError(signInError.message);
          return;
        }
      }

      await supabase.rpc("bootstrap_current_user");
      await queryClient.invalidateQueries();
      toast.success("Bem-vindo de volta");
      navigate({ to: "/dashboard", replace: true });
    } finally {
      setLoading(null);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    void login(parsed.data.email.toLowerCase(), parsed.data.password);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">VulnDesk</h1>
            <p className="text-sm text-muted-foreground">Gestão de vulnerabilidades</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrar</CardTitle>
            <CardDescription>Use uma conta de demonstração ou suas credenciais.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading !== null}>
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Acesso rápido de demonstração</CardTitle>
            <CardDescription>Senha padrão: {DEMO_PASSWORD}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {demoUsers.map((u) => (
              <Button
                key={u.email}
                variant="outline"
                className="h-auto w-full justify-between py-2.5"
                disabled={loading !== null}
                onClick={() => void login(u.email, DEMO_PASSWORD)}
              >
                <span className="text-left">
                  <span className="block text-sm">{u.label}</span>
                  <span className="block text-xs text-muted-foreground">{u.email}</span>
                </span>
                <span className="text-xs text-muted-foreground">{u.hint}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
