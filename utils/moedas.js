/**
 * Converte uma string como "2 TO 5 TP 8 TC" em valor total em cobre (base de cálculo)
 * @param {string} texto
 * @returns {number} total em cobre (TC)
 */
function moedasParaCobre(texto) {
  if (!texto) return 0;

  const regex = /(\d+)\s*(TO|TP|TC)/gi;
  let total = 0;
  let match;

  while ((match = regex.exec(texto)) !== null) {
    const valor = parseInt(match[1]);
    const tipo = match[2].toUpperCase();

    if (tipo === 'TO') total += valor * 100;
    else if (tipo === 'TP') total += valor * 10;
    else if (tipo === 'TC') total += valor;
  }

  return total;
}

/**
 * Converte valor em cobre para string formatada como "X TO Y TP Z TC"
 * @param {number} cobre
 * @returns {string}
 */
function cobreParaTexto(cobre) {
  if (typeof cobre !== 'number' || cobre < 0) return '0 TC';

  const to = Math.floor(cobre / 100);
  const tp = Math.floor((cobre % 100) / 10);
  const tc = cobre % 10;

  return [
    to ? `${to} TO` : '',
    tp ? `${tp} TP` : '',
    tc ? `${tc} TC` : ''
  ].filter(Boolean).join(' ') || '0 TC';
}

module.exports = {
  moedasParaCobre,
  cobreParaTexto
};
