const path = require("path");

// Dados estáticos da mecânica
const CLASSES = require("./classes.json");
const RACAS = require("./racas.json");
const SUBRACAS = require("./subracas.json");
const ORIGENS = require("./origens.json");
const DIVINDADES = require("./divindades.json");
const PERICIAS = require("./pericias.json");
const HABILIDADES = require("./habilidades.json");

// Tabelas adicionais
const experienciaPorNivel = {
  1: 0,
  2: 3000,
  3: 6000,
  4: 10000,
  5: 15000,
  6: 21000,
  7: 28000,
  8: 36000,
  9: 45000,
  10: 55000,
  11: 66000,
  12: 78000,
  13: 91000,
  14: 105000,
  15: 120000,
  16: 136000,
  17: 153000,
  18: 171000,
  19: 190000,
  20: 210000,
};

// Tabela de poderes/habilidades por nível (exemplo genérico, ajuste conforme regras do sistema)
const habilidadesPorNivel = {
  1: { classe: 1, geral: 0 },
  2: { classe: 1, geral: 0 },
  3: { classe: 1, geral: 1 },
  4: { classe: 1, geral: 0 },
  5: { classe: 1, geral: 1 },
  6: { classe: 1, geral: 0 },
  7: { classe: 1, geral: 1 },
  8: { classe: 1, geral: 0 },
  9: { classe: 1, geral: 1 },
  10: { classe: 1, geral: 0 },
  11: { classe: 1, geral: 1 },
  12: { classe: 1, geral: 0 },
  13: { classe: 1, geral: 1 },
  14: { classe: 1, geral: 0 },
  15: { classe: 1, geral: 1 },
  16: { classe: 1, geral: 0 },
  17: { classe: 1, geral: 1 },
  18: { classe: 1, geral: 0 },
  19: { classe: 1, geral: 1 },
  20: { classe: 1, geral: 0 },
};

// Carrega listas de armas e equipamentos a partir de JSON **na mesma pasta**
const ARMAS = require(path.join(__dirname, "armas.json"));
const EQUIPAMENTOS = require(path.join(__dirname, "equipamentos.json"));

module.exports = {
  CLASSES,
  RACAS,
  SUBRACAS,
  ORIGENS,
  DIVINDADES,
  PERICIAS,
  HABILIDADES,
  experienciaPorNivel,
  habilidadesPorNivel,
  ARMAS,
  EQUIPAMENTOS,
};
