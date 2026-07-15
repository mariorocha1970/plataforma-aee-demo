"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "login" | "allowed">("loading");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/demo-session", { cache: "no-store" });
        setState(response.ok ? "allowed" : "login");
      } catch { setState("login"); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setMessage("A verificar…");
    const response = await fetch("/api/demo-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (response.ok) { setState("allowed"); setPassword(""); setMessage(""); }
    else setMessage("Palavra-passe incorreta. Confirme os dados recebidos com o responsável pela demonstração.");
  }

  if (state === "loading") return <main className="demo-login"><section><span className="brand-mark">AEE</span><p>A preparar a demonstração…</p></section></main>;
  if (state === "login") return <main className="demo-login"><section>
    <span className="brand-mark">AEE</span>
    <p className="eyebrow">Demonstração protegida</p>
    <h1>Plataforma de análise AEE</h1>
    <p>Esta versão utiliza exclusivamente dados fictícios. Introduza a palavra-passe fornecida para conhecer o fluxo de análise, triangulação e redação.</p>
    <form onSubmit={login}><label>Palavra-passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus /></label><button className="button primary" type="submit">Entrar na demonstração</button></form>
    {message && <div className="export-status" role="status">{message}</div>}
    <small>O acesso não concede qualquer permissão sobre o espaço de trabalho do autor.</small>
  </section></main>;
  return <>{children}</>;
}
