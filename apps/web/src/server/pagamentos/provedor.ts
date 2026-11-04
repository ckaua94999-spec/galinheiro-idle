// Provedor de saque PIX. A LofyPay é a implementação atual; outro provedor entra trocando `provedorSaque`.

export interface PedidoSaqueProvedor {
  /** Mesma chave da intenção do jogador: a LofyPay devolve o saque já criado se a chamada se repetir. */
  idempotencia: string;
  centavos: number;
  nome: string;
  /** 11 dígitos. Também é a chave PIX. */
  cpf: string;
}

export interface SaqueAceito {
  idExterno: string;
  /** processando = aceito e ainda não liquidado; pago = a adquirente já confirmou na própria resposta. */
  status: 'processando' | 'pago';
}

export interface ProvedorSaque {
  readonly nome: 'lofypay' | 'kavropay' | 'swytchpay';
  criarSaque(pedido: PedidoSaqueProvedor): Promise<SaqueAceito>;
}
