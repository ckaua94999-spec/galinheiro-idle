"""Galinheiro Idle — simulador de balanceamento (Monte Carlo). Uso: python balance_sim.py [execucoes]"""
import heapq, random, statistics, sys

# ---- parâmetros (mesmos nomes da tabela 4.1) ----
MOEDAS_INICIAIS, CUSTO_GIRO, CUSTO_UPGRADE, NIVEL_MAX = 50.0, 40.0, 20.0, 32
ANIMAL_BOAS_VINDAS, PRIMEIRA_POSTURA_IMEDIATA, JANELA_GRACA_H = True, True, 4
VIDA_UTIL_H, Q_EXTRA_BASE = 90 * 24, 0.5
ESPECIES = [  # (chance, preço do ovo, fator de decaimento)
    (0.60, 1.20, 1.00), (0.25, 1.80, 0.90), (0.12, 2.50, 0.80), (0.03, 4.00, 0.70)]
TIERS = [(75, 1.00, 0), (50, 0.75, 2), (25, 0.50, 6), (0, 0.25, 12)]  # (acima de, mult, atraso h)
DIAS, LOGIN_A_CADA_H = 240, 24  # 1 = "ideal", 12 = 2x/dia, 24 = 1x/dia


def tier(vida):
    return next((t for t in TIERS if vida > t[0]), TIERS[-1])


def sortear_especie(rng):
    r, acumulado = rng.random(), 0.0
    for especie in ESPECIES:
        acumulado += especie[0]
        if r < acumulado:
            return especie
    return ESPECIES[-1]


def simular(semente):
    rng = random.Random(semente)
    moedas, nivel, animais, fila, giros = MOEDAS_INICIAIS, 1, {}, [], []
    marcos, proximo_id = {}, [0]

    def ovos(mult):
        q = Q_EXTRA_BASE * mult
        return 1 + (rng.random() < q) + (rng.random() < q)

    def iniciar_ciclo(a, inicio):
        vida = 100 - 100 * a["fator"] * (inicio - a["nasc"]) / VIDA_UTIL_H
        _, mult, atraso = tier(vida)
        a["pronto"] = min(inicio + 24 + atraso, a["exp"])
        a["ovos"] = ovos(mult)
        heapq.heappush(fila, (a["pronto"], a["id"]))

    def novo_animal(t, especie):
        _, preco, fator = especie
        a = {"id": proximo_id[0], "nasc": t, "exp": t + VIDA_UTIL_H, "preco": preco, "fator": fator}
        proximo_id[0] += 1
        animais[a["id"]] = a
        ganho = ovos(1.0) * preco if PRIMEIRA_POSTURA_IMEDIATA else 0.0
        iniciar_ciclo(a, t)
        return ganho

    if ANIMAL_BOAS_VINDAS:
        moedas += novo_animal(0, ESPECIES[0])
    for t in range(0, DIAS * 24 + 1, LOGIN_A_CADA_H):
        while fila and fila[0][0] <= t:                       # coleta tudo que está pronto (e vende)
            pronto, chave = heapq.heappop(fila)
            a = animais.get(chave)
            if a is None or a["pronto"] != pronto:
                continue
            moedas += a["ovos"] * a["preco"]
            if pronto >= a["exp"] or t >= a["exp"]:
                del animais[chave]                            # aposentadoria + presente de despedida
            else:
                iniciar_ciclo(a, max(pronto, t - JANELA_GRACA_H))
        while True:                                           # gira / amplia enquanto puder
            livres = nivel * 4 - len(animais)
            if livres > 0 and moedas >= CUSTO_GIRO:
                moedas -= CUSTO_GIRO
                moedas += novo_animal(t, sortear_especie(rng))
                giros.append(t / 24)
            elif livres == 0 and nivel < NIVEL_MAX and moedas >= CUSTO_UPGRADE + CUSTO_GIRO:
                moedas -= CUSTO_UPGRADE
                nivel += 1
            else:
                break
        for k in (8, 32, 128):
            if len(animais) >= k and k not in marcos:
                marcos[k] = t / 24
        if t == 90 * 24:
            marcos["saldo_d90"] = moedas
    marcos["giro2"] = giros[1] if len(giros) > 1 else None
    return marcos


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    res = [simular(1000 + i) for i in range(n)]
    for chave in ("giro2", 8, 32, 128, "saldo_d90"):
        vals = sorted(r[chave] for r in res if r.get(chave) is not None)
        q = statistics.quantiles(vals, n=10)
        print(f"{chave!s:>9}: mediana {statistics.median(vals):8.1f} | p10 {q[0]:8.1f} | p90 {q[-1]:8.1f} ({len(vals)}/{n})")
