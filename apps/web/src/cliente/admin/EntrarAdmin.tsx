'use client';

// Tela de entrada do painel: usuário e senha do painel (separados da conta do jogo). Erros e o limite de
// tentativas vêm do servidor; sem o login configurado no servidor, explica o que falta.
import type { AdminEntrarBody } from '@galinheiro/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import type { z } from 'zod';
import { chamar } from '../api';
import { BotaoAdm, Campo, mensagemAdmin } from './ui';

export function EntrarAdmin({ configurado }: { configurado: boolean }) {
  const qc = useQueryClient();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const entrar = useMutation({
    mutationFn: (corpo: z.input<typeof AdminEntrarBody>) => chamar('POST', '/api/admin/auth/entrar', { corpo }),
    onSuccess: async () => {
      setSenha('');
      await qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !senha || entrar.isPending) return;
    entrar.mutate({ usuario, senha });
  };

  return (
    <div className="admin adm-entrar-fundo">
      <form className="adm-entrar" onSubmit={enviar} noValidate>
        <div className="adm-entrar-marca">
          <span className="adm-marca-logo" aria-hidden>
            🐔
          </span>
          <span className="leading-tight">
            <span className="adm-marca-nome">Galinheiro</span>
            <span className="adm-marca-sub">Painel administrador</span>
          </span>
        </div>
        <h1 className="adm-entrar-titulo">Entrar no painel</h1>
        <p className="adm-entrar-texto">Use o usuário e a senha do painel (não é a conta do jogo).</p>

        {!configurado && (
          <p className="adm-entrar-aviso" role="status">
            O login do painel ainda não foi configurado no servidor. Defina <code>ADMIN_USUARIO</code> e <code>ADMIN_SENHA_HASH</code> (veja
            o README).
          </p>
        )}

        <Campo rotulo="Usuário">
          <span className="adm-entrar-campo">
            <UserRound className="adm-entrar-icone" aria-hidden />
            <input
              className="adm-input"
              type="text"
              name="usuario"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              maxLength={60}
            />
          </span>
        </Campo>
        <Campo rotulo="Senha">
          <span className="adm-entrar-campo">
            <KeyRound className="adm-entrar-icone" aria-hidden />
            <input
              className="adm-input"
              name="senha"
              type={verSenha ? 'text' : 'password'}
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              maxLength={128}
            />
            <button
              type="button"
              className="adm-entrar-olho"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? 'Esconder a senha' : 'Mostrar a senha'}
              aria-pressed={verSenha}
            >
              {verSenha ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </span>
        </Campo>

        {entrar.isError && (
          <p className="adm-entrar-erro" role="alert">
            {mensagemAdmin(entrar.error)}
          </p>
        )}

        <BotaoAdm type="submit" variante="primario" className="w-full" disabled={!usuario.trim() || !senha || entrar.isPending}>
          <LogIn className="h-4 w-4" aria-hidden /> {entrar.isPending ? 'Entrando…' : 'Entrar'}
        </BotaoAdm>

        <p className="adm-entrar-rodape">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Sessão de 12 h só neste navegador.
          <Link href="/galinheiro" className="adm-entrar-link">
            Ir para o jogo
          </Link>
        </p>
      </form>
    </div>
  );
}
