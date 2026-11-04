'use client';

// Ficha do membro no painel (/admin/usuarios/[id]): tudo sobre a conta e as ações da equipe — perfil,
// economia (saldo e ovos), galinheiro (nível e animais), afiliação (convites), tickets do Intercâmbio, acesso (sessões, código de
// recuperação, bloqueio), atendimento, extrato, auditoria e exclusão. Celular em coluna única (ordem pensada para o uso no
// telefone); desktop em duas colunas (dados do jogo à esquerda, conta e ações à direita).
import type { AdminUsuarioDetalheDTO } from '@galinheiro/api-contract';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, UserX } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ErroApi, chamar } from '../../api';
import { cx } from '../../util';
import { useSessaoAdmin } from '../ShellAdmin';
import { BotaoAdm, Cartao, Carregando, Vazio, mensagemAdmin } from '../ui';
import { useAgoraLento, useCaminhoDaLista, type AcaoFicha } from './comum';
import {
  ModalAnimal, ModalBloquear, ModalBonusGeral, ModalBonusLink, ModalBonusSaque, ModalCobranca, ModalCodigo, ModalDesbloquear, ModalExcluir, ModalMensagem, ModalNivel, ModalOvos, ModalPerfil, ModalSaldo,
  ModalSessoes, ModalTickets,
} from './modais';
import {
  CabecalhoFicha, KpisFicha, SecaoAfiliacao, SecaoAtendimento, SecaoAuditoria, SecaoEconomia, SecaoExtrato, SecaoGalinheiro, SecaoPerfil,
  SecaoPerigo, SecaoSeguranca, SecaoTickets,
} from './secoes';

export function TelaUsuario({ id }: { id: string }) {
  const voltar = useCaminhoDaLista();
  const agora = useAgoraLento();
  const sessao = useSessaoAdmin();
  const [modal, setModal] = useState<AcaoFicha | null>(null);
  // ajuste de tickets do Intercâmbio (modal próprio, fora das ações da ficha em comum.tsx)
  const [ajustarTickets, setAjustarTickets] = useState(false);
  const [excluido, setExcluido] = useState(false);
  const fechar = useCallback(() => setModal(null), []);
  const fecharTickets = useCallback(() => setAjustarTickets(false), []);
  const aoExcluir = useCallback(() => {
    setModal(null);
    setExcluido(true);
  }, []);

  const ficha = useQuery({
    queryKey: ['admin', 'usuarios', 'detalhe', id],
    queryFn: async ({ signal }) => (await chamar<AdminUsuarioDetalheDTO>('GET', `/api/admin/usuarios/${encodeURIComponent(id)}`, { sinal: signal })).data,
    enabled: !excluido,
    // 404/403 não melhoram tentando de novo
    retry: (falhas, erro) => !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) && falhas < 1,
  });

  const barra = (
    <div className="adm-us-voltar-barra">
      <Link href={voltar} className="adm-us-voltar">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Usuários
      </Link>
      {ficha.data && (
        <BotaoAdm tamanho="p" variante="fantasma" onClick={() => void ficha.refetch()} disabled={ficha.isFetching} title="Recarregar a ficha">
          <RefreshCw className={cx('h-4 w-4', ficha.isFetching && 'adm-us-girando')} aria-hidden />
          <span className="adm-us-so-largo">{ficha.isFetching ? 'Atualizando…' : 'Atualizar'}</span>
        </BotaoAdm>
      )}
    </div>
  );

  if (excluido) {
    return (
      <div className="adm-us-ficha">
        {barra}
        <Cartao>
          <Vazio titulo="Conta excluída">Voltando para a lista de usuários…</Vazio>
        </Cartao>
      </div>
    );
  }
  if (ficha.isPending) {
    return (
      <div className="adm-us-ficha">
        {barra}
        <Cartao>
          <Carregando texto="Abrindo a ficha…" />
        </Cartao>
      </div>
    );
  }
  if (ficha.isError) {
    const naoExiste = ficha.error instanceof ErroApi && ficha.error.status === 404;
    return (
      <div className="adm-us-ficha">
        {barra}
        <Cartao>
          {naoExiste && <UserX className="mx-auto -mb-4 mt-4 h-9 w-9 text-slate-400" aria-hidden />}
          <Vazio titulo={naoExiste ? 'Usuário não encontrado' : 'Não deu para abrir a ficha'}>
            {naoExiste ? (
              <p>Esta conta não existe mais (pode ter sido excluída) ou o link está errado.</p>
            ) : (
              <p>{mensagemAdmin(ficha.error)}</p>
            )}
            <div className="adm-us-botoes mt-3 justify-center">
              {!naoExiste && (
                <BotaoAdm onClick={() => void ficha.refetch()}>
                  <RefreshCw className="h-4 w-4" aria-hidden /> Tentar de novo
                </BotaoAdm>
              )}
              <Link href={voltar} className="adm-botao" data-variante={naoExiste ? 'primario' : undefined}>
                Voltar para a lista
              </Link>
            </div>
          </Vazio>
        </Cartao>
      </div>
    );
  }

  const d = ficha.data;
  const conta = sessao.data?.conta;
  const proprio = !!conta && conta.email.toLowerCase() === d.usuario.email.toLowerCase();
  const props = { d, agora, proprio, abrir: setModal };

  return (
    <>
      {/* .adm-us-ficha é o contêiner das consultas de largura; os modais ficam fora dele (position: fixed) */}
      <div className="adm-us-ficha">
        {barra}
        <CabecalhoFicha {...props} />
        <KpisFicha d={d} />
        <div className="adm-us-colunas">
          <div className="adm-us-col">
            <SecaoEconomia {...props} className="adm-us-sec-economia" />
            <SecaoGalinheiro {...props} className="adm-us-sec-galinheiro" />
            <SecaoExtrato {...props} className="adm-us-sec-extrato" />
            <SecaoAuditoria {...props} className="adm-us-sec-auditoria" />
          </div>
          <div className="adm-us-col">
            <SecaoAtendimento {...props} className="adm-us-sec-atendimento" />
            <SecaoPerfil {...props} className="adm-us-sec-perfil" />
            <SecaoAfiliacao {...props} className="adm-us-sec-afiliacao" />
            <SecaoTickets {...props} className="adm-us-sec-tickets" aoAjustar={() => setAjustarTickets(true)} />
            <SecaoSeguranca {...props} className="adm-us-sec-seguranca" />
            <SecaoPerigo {...props} className="adm-us-sec-perigo" />
          </div>
        </div>
      </div>

      {modal?.tipo === 'perfil' && <ModalPerfil d={d} proprio={proprio} aoFechar={fechar} />}
      {modal?.tipo === 'saldo' && <ModalSaldo d={d} sentidoInicial={modal.sentido} aoFechar={fechar} />}
      {modal?.tipo === 'ovos' && <ModalOvos d={d} itemInicial={modal.item} aoFechar={fechar} />}
      {modal?.tipo === 'nivel' && <ModalNivel d={d} aoFechar={fechar} />}
      {modal?.tipo === 'animal' && <ModalAnimal d={d} aoFechar={fechar} abrir={setModal} />}
      {modal?.tipo === 'sessoes' && <ModalSessoes d={d} proprio={proprio} aoFechar={fechar} />}
      {modal?.tipo === 'codigo' && <ModalCodigo d={d} aoFechar={fechar} />}
      {modal?.tipo === 'bloquear' && !proprio && <ModalBloquear d={d} aoFechar={fechar} />}
      {modal?.tipo === 'desbloquear' && <ModalDesbloquear d={d} aoFechar={fechar} />}
      {modal?.tipo === 'bonus-saque' && <ModalBonusSaque d={d} aoFechar={fechar} />}
      {modal?.tipo === 'bonus-link' && <ModalBonusLink d={d} aoFechar={fechar} />}
      {modal?.tipo === 'bonus-geral' && <ModalBonusGeral d={d} aoFechar={fechar} />}
      {modal?.tipo === 'cobranca' && <ModalCobranca d={d} aoFechar={fechar} />}
      {modal?.tipo === 'mensagem' && <ModalMensagem d={d} aoFechar={fechar} />}
      {modal?.tipo === 'excluir' && !proprio && <ModalExcluir d={d} aoFechar={fechar} aoExcluir={aoExcluir} />}
      {ajustarTickets && <ModalTickets d={d} aoFechar={fecharTickets} />}
    </>
  );
}
