/** Só os 11 dígitos, na ordem digitada. */
export function digitosCpf(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, 11);
}

/** CPF com os dígitos verificadores. Rejeita sequência repetida (000…, 111…). */
export function cpfValido(texto: string): boolean {
  const d = digitosCpf(texto);
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (base: string, pesoInicial: number): number => {
    let soma = 0;
    let peso = pesoInicial;
    for (const ch of base) {
      soma += Number(ch) * peso;
      peso -= 1;
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(d.slice(0, 9), 10) === Number(d[9]) && digito(d.slice(0, 10), 11) === Number(d[10]);
}

/** 12345678909 → 123.456.789-09. Aceita texto parcial, para a máscara do campo. */
export function formatarCpf(texto: string): string {
  const d = digitosCpf(texto);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** 12345678909 → ***.456.789-** (o que cabe mostrar de volta na lista). */
export function mascararCpf(texto: string): string {
  const d = digitosCpf(texto);
  if (d.length !== 11) return '***.***.***-**';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
