"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  customerSignInAction,
  customerSignUpAction,
  checkoutSignInAction,
  checkoutSignUpAction,
  type AuthState,
} from "@/lib/actions/customer-auth";

const initialState: AuthState = { status: "idle" };

export function AuthTabs({
  variant = "page",
  onSuccess,
}: {
  variant?: "page" | "embedded";
  onSuccess?: () => void;
}) {
  const signInAction = variant === "embedded" ? checkoutSignInAction : customerSignInAction;
  const signUpAction = variant === "embedded" ? checkoutSignUpAction : customerSignUpAction;

  return (
    <Tabs defaultValue="entrar">
      <TabsList className="w-full rounded-none">
        <TabsTrigger value="entrar" className="rounded-none">
          Entrar
        </TabsTrigger>
        <TabsTrigger value="cadastrar" className="rounded-none">
          Criar conta
        </TabsTrigger>
      </TabsList>
      <TabsContent value="entrar" className="pt-8">
        <SignInForm action={signInAction} onSuccess={onSuccess} />
      </TabsContent>
      <TabsContent value="cadastrar" className="pt-8">
        <SignUpForm action={signUpAction} onSuccess={onSuccess} />
      </TabsContent>
    </Tabs>
  );
}

function SignInForm({
  action,
  onSuccess,
}: {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
    if (state.status === "success") onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="signin-email">E-mail</Label>
        <Input id="signin-email" name="email" type="email" required className="rounded-none" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="signin-password">Senha</Label>
        <Input id="signin-password" name="password" type="password" required className="rounded-none" />
      </div>
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

function SignUpForm({
  action,
  onSuccess,
}: {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
    if (state.status === "success") onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-name">Nome completo</Label>
        <Input id="signup-name" name="name" required className="rounded-none" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-email">E-mail</Label>
        <Input id="signup-email" name="email" type="email" required className="rounded-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="signup-phone">Telefone</Label>
          <Input id="signup-phone" name="phone" required placeholder="(11) 90000-0000" className="rounded-none" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="signup-birthdate">Nascimento</Label>
          <Input id="signup-birthdate" name="birthdate" type="date" required className="rounded-none" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-password">Senha</Label>
        <Input id="signup-password" name="password" type="password" required minLength={8} className="rounded-none" />
      </div>
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
