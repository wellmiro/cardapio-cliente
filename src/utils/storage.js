// Armazenamento seguro para navegadores antigos / WebViews (ex.: Samsung J4).
// Ordem: localStorage -> cookie -> memória. Nunca lança exceção.

const memoria = {};

function lerCookie(nome) {
  try {
    const partes = String(document.cookie || "").split(";");
    for (let i = 0; i < partes.length; i += 1) {
      const p = partes[i].replace(/^\s+/, "");
      if (p.indexOf(nome + "=") === 0) {
        return decodeURIComponent(p.substring(nome.length + 1));
      }
    }
  } catch (e) { /* ignora */ }
  return null;
}

function gravarCookie(nome, valor, dias) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + (dias || 365) * 24 * 60 * 60 * 1000);
    document.cookie =
      nome + "=" + encodeURIComponent(valor) + "; expires=" + d.toUTCString() + "; path=/; SameSite=Lax";
    return lerCookie(nome) === valor;
  } catch (e) {
    return false;
  }
}

function apagarCookie(nome) {
  try {
    document.cookie = nome + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
  } catch (e) { /* ignora */ }
}

export function lerItem(chave) {
  try {
    const v = window.localStorage.getItem(chave);
    if (v !== null && v !== undefined) return v;
  } catch (e) { /* localStorage bloqueado */ }

  const c = lerCookie(chave);
  if (c !== null) return c;

  return Object.prototype.hasOwnProperty.call(memoria, chave) ? memoria[chave] : null;
}

export function gravarItem(chave, valor) {
  const texto = String(valor);
  memoria[chave] = texto;

  try {
    window.localStorage.setItem(chave, texto);
    return true;
  } catch (e) { /* cai para cookie */ }

  return gravarCookie(chave, texto, 365);
}

export function removerItem(chave) {
  delete memoria[chave];
  try { window.localStorage.removeItem(chave); } catch (e) { /* ignora */ }
  apagarCookie(chave);
}

export function lerJSON(chave, padrao) {
  try {
    const bruto = lerItem(chave);
    if (!bruto) return padrao;
    const dado = JSON.parse(bruto);
    return dado === null || dado === undefined ? padrao : dado;
  } catch (e) {
    return padrao;
  }
}

export function gravarJSON(chave, valor) {
  try {
    return gravarItem(chave, JSON.stringify(valor));
  } catch (e) {
    return false;
  }
}

// ===== Dados do cliente (nome e telefone) reaproveitados no próximo pedido =====
const CHAVE_PERFIL_CLIENTE = "perfil_cliente";

export function lerPerfilCliente() {
  const p = lerJSON(CHAVE_PERFIL_CLIENTE, {});
  return {
    nome: p && typeof p.nome === "string" ? p.nome : "",
    fone: p && typeof p.fone === "string" ? p.fone : ""
  };
}

export function salvarPerfilCliente(dados) {
  const nome = String((dados && dados.nome) || "").trim();
  const fone = String((dados && dados.fone) || "").trim();
  if (!nome && !fone) return false; // não apaga o que já estava salvo com campos vazios

  const atual = lerPerfilCliente();
  return gravarJSON(CHAVE_PERFIL_CLIENTE, {
    nome: nome || atual.nome,
    fone: fone || atual.fone
  });
}