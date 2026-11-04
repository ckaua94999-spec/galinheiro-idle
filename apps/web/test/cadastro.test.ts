// Validação do cadastro (o mesmo schema roda no formulário e no servidor) e do telefone brasileiro.
import { describe, expect, it } from 'vitest';
import { CadastrarBody, formatarTelefone, mascararTelefone, normalizarTelefone } from '@galinheiro/api-contract';

describe('telefone brasileiro', () => {
  it('normaliza celular e fixo para E.164, com ou sem máscara, +55 ou 0', () => {
    expect(normalizarTelefone('(11) 98765-4321')).toBe('+5511987654321');
    expect(normalizarTelefone('+55 21 99876-5432')).toBe('+5521998765432');
    expect(normalizarTelefone('011 98765 4321')).toBe('+5511987654321');
    expect(normalizarTelefone('55987654321')).toBe('+5555987654321'); // DDD 55 (RS), sem o código do país
    expect(normalizarTelefone('(31) 3456-7890')).toBe('+553134567890');
  });

  it('recusa DDD inexistente, celular sem o 9, fixo que não começa com 2 a 5 e tamanhos errados', () => {
    expect(normalizarTelefone('(20) 98765-4321')).toBeNull();
    expect(normalizarTelefone('(11) 88765-4321')).toBeNull();
    expect(normalizarTelefone('(11) 6456-7890')).toBeNull();
    expect(normalizarTelefone('12345')).toBeNull();
    expect(normalizarTelefone('')).toBeNull();
  });

  it('máscara enquanto digita e exibição', () => {
    expect(mascararTelefone('1')).toBe('(1');
    expect(mascararTelefone('1198')).toBe('(11) 98');
    expect(mascararTelefone('11987654')).toBe('(11) 9876-54');
    expect(mascararTelefone('11987654321999')).toBe('(11) 98765-4321');
    expect(mascararTelefone('1134567890')).toBe('(11) 3456-7890');
    expect(formatarTelefone('+5511987654321')).toBe('(11) 98765-4321');
  });
});

describe('CadastrarBody', () => {
  const ok = { nome: 'Ana Souza', telefone: '(11) 98765-4321', email: 'Ana@Exemplo.com', senha: 'senha-forte-123' };
  const motivo = (dados: Record<string, string>) => {
    const r = CadastrarBody.safeParse(dados);
    return r.success ? null : r.error.issues[0]?.message;
  };

  it('aceita e normaliza (nome sem espaços sobrando, telefone E.164, e-mail minúsculo)', () => {
    const r = CadastrarBody.parse({ ...ok, nome: '  Ana   Souza ' });
    expect(r).toEqual({ nome: 'Ana Souza', telefone: '+5511987654321', email: 'ana@exemplo.com', senha: 'senha-forte-123' });
    expect(motivo({ ...ok, nome: "Ana-Lú D'Ávila" })).toBeNull();
  });

  it('exige todos os campos, com mensagens em português', () => {
    expect(motivo({ ...ok, nome: 'A' })).toBe('Digite seu nome.');
    expect(motivo({ ...ok, nome: 'Ana 123' })).toMatch(/só letras/);
    expect(motivo({ ...ok, telefone: '9999' })).toMatch(/^Telefone inválido/);
    expect(motivo({ ...ok, email: 'ana@' })).toBe('E-mail inválido.');
    expect(motivo({ ...ok, senha: 'curta' })).toBe('A senha precisa de pelo menos 8 caracteres.');
  });
});
