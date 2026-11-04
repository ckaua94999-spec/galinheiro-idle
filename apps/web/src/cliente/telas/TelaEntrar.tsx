'use client';

// Splash, cadastro e login (GDD 6.1, revisto): só membros cadastrados jogam — o cadastro pede nome, telefone,
// e-mail e senha; o login é por e-mail e senha; quem esqueceu a senha usa o código de recuperação.
// Convite: o link /c/CODIGO chega aqui como ?convite=CODIGO. O código fica guardado no aparelho (sobrevive a
// recarregar), é conferido no servidor (de quem é o convite), a tela abre direto no cadastro com a faixa
// "Convite de Ana L." e o campo opcional "Código de convite" já preenchido (editável). Convite que não existe é
// descartado com o aviso "Convite inválido — você pode se cadastrar mesmo assim". Sem código, o campo fica
// recolhido atrás de "Tenho um código de convite". O código guardado é esquecido depois do cadastro (ou login).
// Aqui fica a LÓGICA e o painel de ações; todo o visual da abertura é da cena (telas/entrar/), que recebe o
// painel e o texto legal prontos. Em desenvolvimento, ?cena=<nome> troca a cena (ver entrar/cenas.ts).
import {
  CadastrarBody, mascararTelefone, normalizarConvite, type CadastroResposta, type ConviteValidoDTO, type SessaoDTO,
} from '@galinheiro/api-contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check, ChevronLeft, CircleAlert, Copy, Eye, EyeOff, KeyRound, Lock, LogIn, Mail, Phone, Ticket, TicketCheck, TicketX, UserPlus, UserRound,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ErroApi, chamar } from '../api';
import { Modal } from '../componentes/Modal';
import { Toasts } from '../componentes/Toasts';
import { codigoDeConvite, esquecerConvite, guardarConvite, lerConviteGuardado } from '../convites/guardado';
import { limparCacheEstado } from '../estado';
import { MOLA } from '../movimento';
import { toast } from '../ui';
import { mensagemDeErro } from '../util';
import { CENAS, CENA_PADRAO } from './entrar/cenas';
import type { ModoEntrar } from './entrar/tipos';

const ELASTICO = [0.34, 1.56, 0.64, 1] as const;
const SUGAR = [0.32, 0, 0.67, 0] as const;

const TRANSICAO_PAINEL = {
  initial: { opacity: 0, y: 24, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: ELASTICO } },
  exit: { opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.14, ease: SUGAR } },
};

const MODOS_DA_URL: readonly ModoEntrar[] = ['email', 'cadastro', 'recuperar'];
type Campo = 'nome' | 'telefone' | 'email' | 'senha' | 'convite';
/** O código digitado é conferido depois que o jogador para de digitar (o do link, na hora). */
const ESPERA_CONFERIR_MS = 500;
const DICA_CONVITE = 'Confira o código ou apague para criar a conta sem convite.';

/** Situação do código de convite no formulário. */
type SituacaoConvite =
  | { tipo: 'vazio' }
  | { tipo: 'incompleto' }
  | { tipo: 'conferindo' }
  | { tipo: 'valido'; indicador: string }
  | { tipo: 'invalido' }
  /** a conferência falhou (rede): o servidor confere no cadastro */
  | { tipo: 'sem-resposta' };

/** Código de recuperação recém-gerado (cadastro ou troca de senha): mostrado uma única vez. */
interface CodigoNovo {
  codigo: string;
  titulo: string;
  texto: string;
}

/** Mensagem para o jogador: erro de validação do servidor mostra o 1º motivo (já em português). */
function mensagemParaJogador(erro: unknown): string {
  if (erro instanceof ErroApi && (erro.codigo === 'PAYLOAD_INVALIDO' || erro.codigo === 'CONVITE_INVALIDO')) {
    const issues = erro.detalhes?.issues as { mensagem?: string }[] | undefined;
    if (issues?.[0]?.mensagem) return issues[0].mensagem;
  }
  return mensagemDeErro(erro);
}

/** O erro do servidor é sobre o código de convite? (CONVITE_INVALIDO ou validação apontando o campo) */
function erroDoConvite(erro: unknown): boolean {
  if (!(erro instanceof ErroApi)) return false;
  if (erro.codigo === 'CONVITE_INVALIDO') return true;
  const issues = erro.detalhes?.issues as { caminho?: string }[] | undefined;
  return erro.codigo === 'PAYLOAD_INVALIDO' && issues?.[0]?.caminho === 'convite';
}

/** Senha com botão de mostrar/esconder (no lugar de "repita a senha"). */
function CampoSenha({
  valor, aoMudar, placeholder, autoComplete, minLength, invalido,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
  invalido?: boolean;
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <label className="campo-icone">
      <Lock aria-hidden />
      <input
        className="campo"
        type={visivel ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-label={placeholder}
        minLength={minLength}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        aria-invalid={invalido || undefined}
        required
      />
      <button type="button" className="campo-olho" onClick={() => setVisivel((v) => !v)} aria-label={visivel ? 'Esconder senha' : 'Mostrar senha'}>
        {visivel ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </button>
    </label>
  );
}

export function TelaEntrar() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const modoUrl = params?.get('modo') as ModoEntrar | null;
  // link de convite (/c/CODIGO → ?convite=CODIGO): a tela abre direto no cadastro
  const conviteDaUrl = codigoDeConvite(params?.get('convite'));
  const [modo, setModo] = useState<ModoEntrar>(modoUrl && MODOS_DA_URL.includes(modoUrl) ? modoUrl : conviteDaUrl ? 'cadastro' : 'inicio');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [campoComErro, setCampoComErro] = useState<Campo | null>(null);
  const [codigoNovo, setCodigoNovo] = useState<CodigoNovo | null>(null);
  const nomeCena = process.env.NODE_ENV !== 'production' ? params?.get('cena') : null;
  const Cena = (nomeCena && CENAS[nomeCena]) || CENA_PADRAO;

  // ------------------------------------------------ código de convite
  /** o que está no campo "Código de convite" (como o jogador digitou; vai normalizado) */
  const [convite, setConvite] = useState(conviteDaUrl ?? '');
  /** o código que veio pelo link (agora ou numa visita anterior, guardado no aparelho) */
  const [conviteDoLink, setConviteDoLink] = useState<string | null>(conviteDaUrl);
  /** o código do link não existe: foi descartado e o aviso fica até o jogador digitar outro */
  const [conviteDescartado, setConviteDescartado] = useState(false);
  const [campoConviteAberto, setCampoConviteAberto] = useState(false);
  /** erro do servidor (ou da validação) sobre o código, mostrado embaixo do campo */
  const [erroConvite, setErroConvite] = useState<string | null>(null);
  const refConvite = useRef<HTMLInputElement>(null);

  // guarda o código do link (sobrevive a recarregar); sem link, recupera o de uma visita anterior pelo link.
  // (Depois de montar: no servidor não há localStorage, e o HTML tem de ser o mesmo nos dois lados.)
  useEffect(() => {
    if (conviteDaUrl) {
      guardarConvite(conviteDaUrl);
      return;
    }
    const guardado = lerConviteGuardado();
    if (guardado) {
      setConviteDoLink(guardado);
      setConvite((atual) => atual || guardado);
    }
  }, [conviteDaUrl]);

  const codigoNoCampo = codigoDeConvite(convite);
  const [codigoAConferir, setCodigoAConferir] = useState<string | null>(conviteDaUrl);
  useEffect(() => {
    const t = window.setTimeout(() => setCodigoAConferir(codigoNoCampo), codigoNoCampo === conviteDoLink ? 0 : ESPERA_CONFERIR_MS);
    return () => window.clearTimeout(t);
  }, [codigoNoCampo, conviteDoLink]);
  // conferência pública (sem sessão): o código vale? de quem é? (só o nome curto)
  const conferencia = useQuery({
    queryKey: ['convite-valido', codigoAConferir],
    queryFn: async () => (await chamar<ConviteValidoDTO>('GET', `/convites/${codigoAConferir}`)).data,
    enabled: !!codigoAConferir,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const situacao: SituacaoConvite = !convite.trim()
    ? { tipo: 'vazio' }
    : !codigoNoCampo
      ? { tipo: 'incompleto' }
      : codigoAConferir !== codigoNoCampo || conferencia.isPending
        ? { tipo: 'conferindo' }
        : conferencia.data
          ? conferencia.data.valido
            ? { tipo: 'valido', indicador: conferencia.data.indicador ?? 'um membro' }
            : { tipo: 'invalido' }
          : { tipo: 'sem-resposta' };

  // convite do link que não existe: descarta (campo, aparelho) e avisa que dá para se cadastrar mesmo assim
  const linkInvalido = !!conviteDoLink && codigoAConferir === conviteDoLink && conferencia.data?.valido === false;
  useEffect(() => {
    if (!linkInvalido || !conviteDoLink) return;
    esquecerConvite();
    setConviteDescartado(true);
    setConvite((atual) => (codigoDeConvite(atual) === conviteDoLink ? '' : atual));
    setConviteDoLink(null);
  }, [linkInvalido, conviteDoLink]);

  const mostrarErroConvite = (mensagem: string) => {
    setCampoComErro('convite');
    setCampoConviteAberto(true);
    setErroConvite(`${mensagem} ${DICA_CONVITE}`);
    requestAnimationFrame(() => refConvite.current?.focus({ preventScroll: false }));
  };

  const irPara = (m: ModoEntrar) => {
    setCampoComErro(null);
    setErroConvite(null);
    setCampoConviteAberto(false);
    setModo(m);
  };

  const entrouNoJogo = () => {
    limparCacheEstado();
    qc.clear();
    router.replace('/galinheiro');
  };

  const executar = async (fn: () => Promise<void>) => {
    setOcupado(true);
    try {
      await fn();
    } catch (erro) {
      if (erro instanceof ErroApi) {
        if (erro.codigo === 'EMAIL_EM_USO') setCampoComErro('email');
        if (erro.codigo === 'TELEFONE_EM_USO') setCampoComErro('telefone');
      }
      if (erroDoConvite(erro)) mostrarErroConvite(mensagemParaJogador(erro));
      toast(mensagemParaJogador(erro), 'erro');
    } finally {
      setOcupado(false);
    }
  };

  const entrar = () =>
    executar(async () => {
      await chamar<SessaoDTO>('POST', '/auth/entrar', { corpo: { email, senha } });
      // quem já é membro não usa convite: o código guardado não fica para o próximo cadastro neste aparelho
      esquecerConvite();
      entrouNoJogo();
    });

  // Valida no aparelho com o MESMO schema do servidor (mensagens em português) antes de enviar.
  const cadastrar = () => {
    const conviteEnviado = convite.trim() ? normalizarConvite(convite) : undefined;
    const corpo = { nome, telefone, email, senha, ...(conviteEnviado ? { convite: conviteEnviado } : {}) };
    const v = CadastrarBody.safeParse(corpo);
    if (!v.success) {
      const problema = v.error.issues[0];
      const campo = (problema?.path[0] as Campo | undefined) ?? null;
      setCampoComErro(campo);
      if (campo === 'convite') mostrarErroConvite(problema?.message ?? 'Código de convite inválido.');
      toast(problema?.message ?? 'Confira os dados.', 'erro');
      return;
    }
    // a conferência já disse que esse código não existe: nem envia
    if (situacao.tipo === 'invalido') {
      mostrarErroConvite('Código de convite inválido.');
      toast('Código de convite inválido.', 'erro');
      return;
    }
    setCampoComErro(null);
    setErroConvite(null);
    void executar(async () => {
      const r = await chamar<CadastroResposta>('POST', '/auth/cadastrar', { corpo });
      esquecerConvite();
      const primeiroNome = r.data.conta.nome.split(' ')[0] ?? '';
      setCodigoNovo({
        codigo: r.data.codigoRecuperacao,
        titulo: `Bem-vindo(a), ${primeiroNome}!`,
        texto: 'Sua conta foi criada. Guarde este código de recuperação — se esquecer a senha, é com ele que você cria outra:',
      });
    });
  };

  const recuperar = () =>
    executar(async () => {
      const r = await chamar<{ codigoRecuperacao: string }>('POST', '/auth/redefinir', {
        corpo: { email, codigoRecuperacao: codigo, novaSenha: senha },
      });
      esquecerConvite(); // já é membro (como no login)
      setCodigoNovo({
        codigo: r.data.codigoRecuperacao,
        titulo: 'Senha trocada!',
        texto: 'Guarde o seu novo código de recuperação (o antigo deixou de valer):',
      });
    });

  const voltar = (para: ModoEntrar) => (
    <button type="button" className="link-jogo" onClick={() => irPara(para)}>
      <ChevronLeft className="h-4 w-4" strokeWidth={3} aria-hidden />
      Voltar
    </button>
  );

  const campoEmail = (
    <label className="campo-icone">
      <Mail aria-hidden />
      <input
        className="campo"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="seu@email.com"
        aria-label="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={campoComErro === 'email' || undefined}
        required
      />
    </label>
  );

  // A faixa do cadastro vira "Convite de Ana L." quando o código (do link ou digitado) é confirmado: não ocupa
  // altura nenhuma (a cena mantém o elenco) e estoura com mola na troca. O convite do link que não existe
  // ganha um aviso no alto do formulário.
  const doLink = !!conviteDoLink && codigoNoCampo === conviteDoLink;
  const indicador = situacao.tipo === 'valido' ? situacao.indicador : null;
  const tituloCadastro = indicador ? (
    <motion.h2
      key={`convite-${indicador}`}
      className="faixa faixa-verde entrar-faixa-convite"
      // nomes longos encolhem a letra (a faixa não pode vazar do painel)
      style={{ ['--faixa-convite-fs' as string]: `${indicador.length <= 8 ? 20 : indicador.length <= 12 ? 18 : 16}px` }}
      initial={{ scale: 0.6 }}
      animate={{ scale: 1, transition: MOLA.aviso }}
    >
      <span className="sr-only">Criar conta: </span>
      <span className="icone-contorno" aria-hidden>
        <TicketCheck />
        <TicketCheck />
      </span>
      <span className="entrar-faixa-convite-texto">Convite de {indicador}</span>
    </motion.h2>
  ) : (
    <h2 className="faixa faixa-verde" style={{ fontSize: 20 }}>
      Criar conta
    </h2>
  );
  const avisoConvite =
    conviteDescartado && !convite.trim() ? (
      <p className="entrar-convite-faixa" data-tipo="invalido" role="status">
        <span className="entrar-convite-faixa-icone" aria-hidden>
          <TicketX />
        </span>
        <span>Convite inválido — você pode se cadastrar mesmo assim.</span>
      </p>
    ) : null;

  // campo opcional "Código de convite": aberto quando tem código (link ou digitado); vazio, fica recolhido
  const statusConvite: { tipo: 'ok' | 'erro' | 'info'; texto: string } | null = erroConvite
    ? { tipo: 'erro', texto: erroConvite }
    : doLink
      ? null
      : situacao.tipo === 'valido'
        ? { tipo: 'ok', texto: `Convite de ${situacao.indicador}` }
        : situacao.tipo === 'invalido'
          ? { tipo: 'erro', texto: `Código não encontrado. ${DICA_CONVITE}` }
          : situacao.tipo === 'conferindo'
            ? { tipo: 'info', texto: 'Conferindo o código…' }
            : null;
  const campoConvite =
    campoConviteAberto || convite.trim() ? (
      <div className="entrar-convite">
        <label className="campo-icone">
          <Ticket aria-hidden />
          <input
            ref={refConvite}
            className="campo entrar-convite-campo"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Código de convite (opcional)"
            aria-label="Código de convite (opcional)"
            maxLength={30}
            value={convite}
            onChange={(e) => {
              setConvite(e.target.value);
              setErroConvite(null);
              setConviteDescartado(false);
              if (campoComErro === 'convite') setCampoComErro(null);
            }}
            aria-invalid={campoComErro === 'convite' || situacao.tipo === 'invalido' || undefined}
            aria-describedby={statusConvite ? 'entrar-convite-status' : undefined}
          />
        </label>
        {/* região viva sempre montada (o leitor de tela anuncia quando o texto aparece ou muda) */}
        <div aria-live="polite">
          {statusConvite && (
            <p id="entrar-convite-status" className="entrar-convite-status" data-tipo={statusConvite.tipo}>
              {statusConvite.tipo === 'ok' ? <Check aria-hidden /> : statusConvite.tipo === 'erro' ? <CircleAlert aria-hidden /> : null}
              <span>{statusConvite.texto}</span>
            </p>
          )}
        </div>
      </div>
    ) : (
      <button
        type="button"
        className="link-jogo entrar-convite-abrir"
        onClick={() => {
          setCampoConviteAberto(true);
          requestAnimationFrame(() => refConvite.current?.focus());
        }}
      >
        <Ticket aria-hidden />
        Tenho um código de convite
      </button>
    );

  const painel = (
    <AnimatePresence mode="wait" initial={false}>
      {modo === 'inicio' && (
        <motion.div key="inicio" className="painel entrar-painel space-y-3" {...TRANSICAO_PAINEL}>
          <button type="button" className="botao botao-primario botao-g botao-brilho w-full" onClick={() => irPara('cadastro')}>
            <span className="icone-contorno" aria-hidden>
              <UserPlus strokeWidth={2.6} />
              <UserPlus strokeWidth={2.6} />
            </span>
            Criar conta
          </button>
          <button type="button" className="botao botao-secundario w-full" onClick={() => irPara('email')}>
            <LogIn className="h-5 w-5" strokeWidth={2.6} aria-hidden />
            Já tenho conta
          </button>
        </motion.div>
      )}
      {modo === 'cadastro' && (
        <motion.form
          key="cadastro"
          className="painel painel-com-faixa entrar-painel entrar-form space-y-3"
          {...TRANSICAO_PAINEL}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            cadastrar();
          }}
        >
          {tituloCadastro}
          {avisoConvite}
          <label className="campo-icone">
            <UserRound aria-hidden />
            <input
              className="campo"
              autoComplete="name"
              autoCapitalize="words"
              placeholder="Seu nome"
              aria-label="Nome"
              maxLength={60}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              aria-invalid={campoComErro === 'nome' || undefined}
              required
            />
          </label>
          <label className="campo-icone">
            <Phone aria-hidden />
            <input
              className="campo numeros"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(11) 98765-4321"
              aria-label="Telefone com DDD"
              value={telefone}
              onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
              aria-invalid={campoComErro === 'telefone' || undefined}
              required
            />
          </label>
          {campoEmail}
          <CampoSenha
            valor={senha}
            aoMudar={setSenha}
            placeholder="Senha (8+ caracteres)"
            autoComplete="new-password"
            minLength={8}
            invalido={campoComErro === 'senha'}
          />
          {campoConvite}
          <button type="submit" className="botao botao-confirmar botao-g w-full" disabled={ocupado}>
            Criar conta e jogar
          </button>
          <div className="flex items-center justify-between">
            {voltar('inicio')}
            <button type="button" className="link-jogo" onClick={() => irPara('email')}>
              Já tenho conta
            </button>
          </div>
        </motion.form>
      )}
      {modo === 'email' && (
        <motion.form
          key="email"
          className="painel painel-com-faixa entrar-painel entrar-form space-y-3"
          {...TRANSICAO_PAINEL}
          onSubmit={(e) => {
            e.preventDefault();
            void entrar();
          }}
        >
          <h2 className="faixa faixa-azul" style={{ fontSize: 20 }}>
            Entrar
          </h2>
          {campoEmail}
          <CampoSenha valor={senha} aoMudar={setSenha} placeholder="Senha" autoComplete="current-password" />
          <button type="submit" className="botao botao-primario botao-g w-full" disabled={ocupado}>
            Entrar
          </button>
          <div className="flex items-center justify-between">
            {voltar('inicio')}
            <button type="button" className="link-jogo" onClick={() => irPara('recuperar')}>
              Esqueci a senha
            </button>
          </div>
          <p className="entrar-troca">
            Ainda não tem conta?{' '}
            <button type="button" className="link-jogo" onClick={() => irPara('cadastro')}>
              Criar conta
            </button>
          </p>
        </motion.form>
      )}
      {modo === 'recuperar' && (
        <motion.form
          key="recuperar"
          className="painel painel-com-faixa entrar-painel entrar-form space-y-3"
          {...TRANSICAO_PAINEL}
          onSubmit={(e) => {
            e.preventDefault();
            void recuperar();
          }}
        >
          <h2 className="faixa faixa-azul" style={{ fontSize: 20 }}>
            Criar nova senha
          </h2>
          <p className="text-sm text-texto-suave">Use o código de recuperação que apareceu quando você criou a conta.</p>
          {campoEmail}
          <label className="campo-icone">
            <KeyRound aria-hidden />
            <input
              className="campo numeros uppercase tracking-wider"
              placeholder="XXXX-XXXX-XXXX"
              aria-label="Código de recuperação"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
            />
          </label>
          <CampoSenha valor={senha} aoMudar={setSenha} placeholder="Nova senha (8+ caracteres)" autoComplete="new-password" minLength={8} />
          <button type="submit" className="botao botao-confirmar botao-g w-full" disabled={ocupado}>
            Trocar senha e entrar
          </button>
          {voltar('email')}
        </motion.form>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <Cena
        modo={modo}
        painel={painel}
        legal={
          <p className="entrar-legal">
            Ao criar a conta, você aceita os Termos de Uso e a Política de Privacidade. Moedas, ovos e animais existem só dentro do jogo.
          </p>
        }
      />
      <Modal aberto={!!codigoNovo} aoFechar={entrouNoJogo} titulo={codigoNovo?.titulo ?? ''}>
        <p className="text-sm">{codigoNovo?.texto}</p>
        <p className="bilhete-codigo numeros">{codigoNovo?.codigo}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="botao botao-secundario"
            onClick={() => {
              void navigator.clipboard?.writeText(codigoNovo?.codigo ?? '').then(() => toast('Código copiado!', 'sucesso'));
            }}
          >
            <Copy className="h-4 w-4" strokeWidth={2.6} aria-hidden />
            Copiar
          </button>
          <button type="button" className="botao botao-primario" onClick={entrouNoJogo}>
            Ir para o galinheiro
          </button>
        </div>
      </Modal>
      <Toasts />
    </>
  );
}
