const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const fs = require("fs-extra");
const path = require("path");
const racas = require("../mechanics/tormenta20/racas.json");
const subracasAll = require("../mechanics/tormenta20/subracas.json");

let cachedMec = null;
const temp = new Map();

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

async function carregarMecanica() {
  if (cachedMec) return cachedMec;
  try {
    const mec = require("../mechanics/tormenta20/index.js");
    mec.ARMAS = await fs
      .readJson(path.join(__dirname, "..", "data", "armas.json"))
      .catch(() => []);
    mec.EQUIPAMENTOS = await fs
      .readJson(path.join(__dirname, "..", "data", "equipamentos.json"))
      .catch(() => []);
    mec.experienciaPorNivel = {
      /* ... */
    };
    cachedMec = mec;
    return mec;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function salvarFicha(userId, ficha) {
  const dir = path.join(__dirname, "..", "fichas", "tormenta20", userId);
  await fs.ensureDir(dir);
  const mec = await carregarMecanica();
  const mod = (x) => Math.floor((x - 10) / 2);

  // Vida, mana, armadura, XP
  const classeObj = mec.CLASSES.find((c) => c.nome === ficha.classe) || {};
  ficha.vida_max = Math.max(
    1,
    (classeObj.pv_iniciais || 0) + mod(ficha.atributos.CON)
  );
  ficha.vida_atual = ficha.vida_max;
  const chave = classeObj.atributo_chave?.[0] || "INT";
  ficha.mana_max = Math.max(
    0,
    (classeObj.pm_iniciais || 0) + mod(ficha.atributos[chave])
  );
  ficha.mana_atual = ficha.mana_max;
  ficha.armadura = 10 + mod(ficha.atributos.DES);
  ficha.xp = mec.experienciaPorNivel[ficha.nivel - 1] || 0;
  ficha.xp_max = ficha.nivel < 20 ? mec.experienciaPorNivel[ficha.nivel] : null;

  // Deduplica arrays
  ficha.equipamentos = [...new Set(ficha.equipamentos)];
  ficha.habilidades_autom = [...new Set(ficha.habilidades_autom)];
  ficha.pericias_autom = [...new Set(ficha.pericias_autom)];

  await fs.writeJson(path.join(dir, `${slugify(ficha.nome)}.json`), ficha, {
    spaces: 2,
  });
}

// Helpers
function formatarOpcoesPorNome(lista, selected = null) {
  return lista.map((opt) => {
    const o = {
      label: opt.nome,
      value: opt.nome,
      default: opt.nome === selected,
    };
    if (opt.descricao && opt.descricao.length > 0) {
      o.description = opt.descricao.slice(0, 100);
    }
    return o;
  });
}

function criarSelect(
  id,
  placeholder,
  options,
  max = 1,
  selected = null,
  min = 1
) {
  return new StringSelectMenuBuilder()
    .setCustomId(id)
    .setPlaceholder(placeholder)
    .setMinValues(min)
    .setMaxValues(max)
    .addOptions(formatarOpcoesPorNome(options, selected));
}

function rolar4d6() {
  const rolls = Array.from(
    { length: 4 },
    () => 1 + Math.floor(Math.random() * 6)
  );
  rolls.sort((a, b) => a - b);
  return { rolls, total: rolls.slice(1).reduce((s, x) => s + x, 0) };
}

function calcularLimitePericias(data, mec) {
  const classe = mec.CLASSES.find((c) => c.nome === data.classe) || {};
  const origem = mec.ORIGENS.find((o) => o.nome === data.origem) || {};
  const modINT = Math.floor((data.atributos.INT - 10) / 2);
  const base = classe.pericias_extra || 0;
  const bonus = origem.pericias?.length ? 1 : 0;
  return Math.max(1, base + bonus + Math.max(modINT, 0));
}

function calcularLimiteHabilidades(data, mec) {
  console.log("[calcularLimiteHabilidades] data:", data);
  const tabela = mec.habilidadesPorNivel || {};
  let tot = 0;
  for (let i = 1; i <= data.nivel; i++) {
    const p = tabela[Math.min(i, 20)] || { classe: 0, geral: 0 };
    tot += p.classe + p.geral;
  }
  console.log("saindo de calcularLimiteHabilidades:", tot);
  return tot;
}

function aplicarBeneficiosAutomaticos(data, mec) {
  const pericias = new Set(data.pericias_autom);
  const habilidades = new Set(data.habilidades_autom);
  const itens = new Set(data.equipamentos);

  // Perícias automáticas de classe e origem
  [
    ...(mec.CLASSES.find((c) => c.nome === data.classe)?.pericias_automaticas ||
      []),
    ...(mec.ORIGENS.find((o) => o.nome === data.origem)?.pericias || []),
  ].forEach((p) => pericias.add(p));

  // Poder de origem como habilidade
  const origemObj = mec.ORIGENS.find((o) => o.nome === data.origem);
  if (origemObj?.poder) habilidades.add(origemObj.poder);

  // Equipamentos de origem
  if (Array.isArray(origemObj?.equipamento))
    origemObj.equipamento.forEach((e) => itens.add(e));

  // Habilidades automáticas de classe (sem poderes raciais aqui)
  [
    ...(mec.CLASSES.find((c) => c.nome === data.classe)
      ?.habilidades_automaticas || []),
  ].forEach((h) => habilidades.add(h));

  // Equipamentos automáticos de classe
  [
    ...(mec.CLASSES.find((c) => c.nome === data.classe)?.equipamentos || []),
  ].forEach((e) => itens.add(e));

  data.pericias_autom = [...pericias];
  data.habilidades_autom = [...habilidades];
  data.equipamentos = [...itens];
}

function aplicarEquipamentosIniciais(data, mec) {
  const classeItems =
    mec.CLASSES.find((c) => c.nome === data.classe)?.equipamentos || [];
  classeItems.forEach((e) => data.equipamentos.push(e));
  // Não mais adiciona "100 TO" aqui!
}

// Render functions
async function mostrarMetodoDistribuicao(interaction) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("method_manual")
      .setLabel("Manual")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("method_random")
      .setLabel("Aleatória")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("method_roll")
      .setLabel("Rolar Dados")
      .setStyle(ButtonStyle.Success)
  );
  await interaction.reply({
    content: "Como distribuir 30 pontos?",
    components: [row],
    flags: 64, // 64 = EPHEMERAL
  });
}

async function mostrarAtributos(interaction, data) {
  const keys = ["FOR", "DES", "CON", "INT", "SAB", "CAR"];
  const rows = [];
  for (let i = 0; i < keys.length; i += 2) {
    const r = new ActionRowBuilder();
    [keys[i], keys[i + 1]].forEach((k) => {
      r.addComponents(
        new ButtonBuilder()
          .setCustomId(`menos_${k}`)
          .setLabel(`- ${k}`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`mais_${k}`)
          .setLabel(`+ ${k}`)
          .setStyle(ButtonStyle.Success)
      );
    });
    rows.push(r);
  }
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Próximo")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(data.pontosRestantes > 0)
    )
  );
  await interaction.editReply({
    content: `Atributos (${
      data.pontosRestantes
    } pontos restantes): ${JSON.stringify(data.atributos)}`,
    components: rows,
    flags: 64, // 64 = EPHEMERAL
  });
}

async function mostrarRoll(interaction, data, idx = 0) {
  const keys = ["FOR", "DES", "CON", "INT", "SAB", "CAR"];
  if (idx >= keys.length) {
    const sess = temp.get(interaction.user.id);
    sess.step = 3;
    temp.set(interaction.user.id, sess);
    return steps[3].render(interaction, data);
  }
  const attr = keys[idx];
  const { rolls, total } = rolar4d6();
  data.atributos[attr] = total;
  const used = data.rerolls[attr] || 0;
  const remaining = Math.max(0, 2 - used);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`reroll_${attr}_${idx}`)
      .setLabel(remaining ? `Reroll (${remaining} rest.)` : "Reroll")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(used >= 2),
    new ButtonBuilder()
      .setCustomId(`fix_${attr}_${idx}`)
      .setLabel(`Fixar ${total}`)
      .setStyle(ButtonStyle.Primary)
  );
  await interaction.editReply({
    content: `${attr}: [${rolls.join(", ")}] = ${total}`,
    components: [row],
    flags: 64, // 64 = EPHEMERAL
  });
}

async function mostrarRaca(interaction, data) {
  // garante que sempre passamos string para slugify
  const selectedRaceSlug = slugify(data.selecoes.raca || "");

  // filtragem de sub-raças (ou "Puro")
  const todasSub = subracasAll.filter(
    (sr) =>
      typeof sr.nome === "string" &&
      sr.nome.trim().length >= 1 &&
      sr.nome.length <= 25 &&
      slugify(sr.raca) === selectedRaceSlug
  );

  const subracas = todasSub.length
    ? todasSub
    : subracasAll.filter(
        (sr) =>
          typeof sr.nome === "string" &&
          sr.nome === "Puro" &&
          sr.nome.length <= 25
      );

  // select de raças
  const selR = new StringSelectMenuBuilder()
    .setCustomId("sel_2_raca")
    .setPlaceholder("Selecione a raça")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      racas
        .filter(
          (r) =>
            typeof r.nome === "string" &&
            r.nome.trim().length >= 1 &&
            r.nome.length <= 25 &&
            typeof r.descricao === "string"
        )
        .map((r) => ({
          label: r.nome.slice(0, 25),
          description: r.descricao.slice(0, 50),
          value: r.nome.slice(0, 25),
          default: r.nome === data.selecoes.raca,
        }))
    );

  // select de sub-raças
  const selSR = new StringSelectMenuBuilder()
    .setCustomId("sel_2_subraca")
    .setPlaceholder("Selecione a sub-raça")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      subracas
        .filter(
          (sr) =>
            typeof sr.nome === "string" &&
            sr.nome.trim().length >= 1 &&
            sr.nome.length <= 25 &&
            typeof sr.descricao === "string"
        )
        .map((sr) => ({
          label: sr.nome.slice(0, 25),
          description: sr.descricao.slice(0, 50),
          value: sr.nome.slice(0, 25),
          default: sr.nome === data.selecoes.subraca,
        }))
    );

  // botão Avançar (só habilita quando raça E sub-raça estiverem definidas)
  const btnNext = new ButtonBuilder()
    .setCustomId("next")
    .setLabel("➡️ Avançar")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!data.selecoes.raca || !data.selecoes.subraca);

  // monta as linhas — sem row vazia!
  const rows = [
    new ActionRowBuilder().addComponents(selR),
    new ActionRowBuilder().addComponents(selSR),
    new ActionRowBuilder().addComponents(btnNext),
  ];

  // escolhe qual descrição mostrar
  const textoDesc = data.descricaoSubraca
    ? `🧬 **${data.selecoes.subraca}**: ${data.descricaoSubraca}`
    : data.descricaoRaca
    ? `🧬 **${data.selecoes.raca}**: ${data.descricaoRaca}`
    : "";

  return interaction.editReply({
    content: `${textoDesc}\n\nSelecione raça e sub-raça:`,
    components: rows,
    flags: 64, // EPHEMERAL
  });
}

async function mostrarClasse(interaction, data) {
  const mec = temp.get(interaction.user.id).mec;
  const rows = [
    new ActionRowBuilder().addComponents(
      criarSelect("sel_3_classe", "Classe", mec.CLASSES, 1, data.classe)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("➡️ Próximo")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!data.classe)
    ),
  ];

  return interaction.editReply({
    content:
      `${data.descricaoClasse || ""}\n\n` +
      `3/8 – Classe: ${data.classe || "-"}`,
    components: rows,
    flags: 64, // 64 = EPHEMERAL
  });
}

async function mostrarOrigem(interaction, data) {
  const mec = temp.get(interaction.user.id).mec;
  const rows = [
    new ActionRowBuilder().addComponents(
      criarSelect("sel_4_origem", "Origem", mec.ORIGENS, 1, data.origem)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("➡️ Próximo")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!data.origem)
    ),
  ];

  return interaction.editReply({
    content:
      `${data.descricaoOrigem || ""}\n\n` +
      `4/8 – Origem: ${data.origem || "-"}`,
    components: rows,
    flags: 64, // 64 = EPHEMERAL
  });
}

async function mostrarDivindade(interaction, data) {
  const mec = temp.get(interaction.user.id).mec;
  const divObj = mec.DIVINDADES.find((d) => d.nome === data.divindade) || {
    poderes_concedidos: [],
  };

  // aviso caso sem poderes
  if (!divObj.poderes_concedidos.length) {
    await interaction.followUp({
      content: "⚠️ Esta divindade não concede poderes.",
      flags: 64,
    });
  }

  // pega descrição (ou padrão)
  const desc = data.descricaoDivindade || "Não siga nenhuma divindade.";

  const opts = [
    { nome: "Nenhuma", descricao: "Não siga nenhuma divindade" },
    ...mec.DIVINDADES,
  ];
  const rows = [
    new ActionRowBuilder().addComponents(
      criarSelect("sel_5_divindade", "Divindade", opts, 1, data.divindade)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("➡️ Próximo")
        .setStyle(ButtonStyle.Primary)
    ),
  ];

  return interaction.editReply({
    // agora exibimos a descrição antes do passo
    content:
      `🪧 ${desc}\n\n` + `5/8 – Divindade: ${data.divindade || "Nenhuma"}`,
    components: rows,
    flags: 64, // 64 = EPHEMERAL
  });
}

async function mostrarPericias(interaction, data) {
  const mec = temp.get(interaction.user.id).mec;
  data.limite_pericias = calcularLimitePericias(data, mec);

  const autoText =
    data.pericias_autom.length > 0
      ? `🎓 Automáticas: ${data.pericias_autom.join(", ")}\n\n`
      : "";

  const all = mec.PERICIAS.filter((p) => !data.pericias_autom.includes(p.nome));
  const pg = data.pagina_pericias || 0;
  const slice = all.slice(pg * 10, (pg + 1) * 10);
  const restante = data.limite_pericias - data.pericias.length;

  const rows = [];

  // Só adiciona o select se houver opções e limite > 0
  if (slice.length > 0 && restante > 0) {
    const select = criarSelect(
      "sel_6_pericia",
      `Perícias (${data.pericias.length}/${data.limite_pericias})`,
      slice,
      Math.max(1, Math.min(restante, 10)),
      null,
      1
    );
    rows.push(new ActionRowBuilder().addComponents(select));
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("menos_page:pericias")
        .setLabel("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pg === 0),
      new ButtonBuilder()
        .setCustomId("mais_page:pericias")
        .setLabel("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((pg + 1) * 10 >= all.length),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("➡️ Próximo")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(data.pericias.length === 0)
    )
  );

  for (let i = 0; i < data.pericias.length; i += 5) {
    rows.push(
      new ActionRowBuilder().addComponents(
        data.pericias
          .slice(i, i + 5)
          .map((p) =>
            new ButtonBuilder()
              .setCustomId(`remove:pericias:${p}`)
              .setLabel(`❌ ${p}`)
              .setStyle(ButtonStyle.Danger)
          )
      )
    );
  }

  const descText = data.descricaoPericias
    ? `${data.descricaoPericias}\n\n`
    : autoText;

  await interaction.editReply({
    content:
      descText +
      `6/8 – Perícias (${data.pericias.length}/${data.limite_pericias})\n\n` +
      (restante > 0
        ? `Selecione até ${restante} perícia(s):`
        : `Nenhuma perícia disponível para seleção.`),
    components: rows,
    flags: 64, // 64 = EPHEMERAL
  });
}

async function mostrarHabilidades(interaction, data) {
  const mec = temp.get(interaction.user.id).mec;
  data.limite_habilidades = calcularLimiteHabilidades(data, mec);

  const autoText =
    data.habilidades_autom.length > 0
      ? `✨ Automáticas: ${data.habilidades_autom.join(", ")}\n\n`
      : "";

  const all = mec.HABILIDADES.filter(
    (h) => !data.habilidades_autom.includes(h.nome)
  );
  const pg = data.pagina_hab || 0;
  const slice = all.slice(pg * 10, (pg + 1) * 10);
  const restante = data.limite_habilidades - data.habilidades.length;

  const rows = [];

  // Só adiciona o select se houver opções e limite > 0
  if (slice.length > 0 && restante > 0) {
    const limite = calcularLimiteHabilidades(data, mec);
    const select = criarSelect(
      "sel_7_hab",
      `Habilidades (${data.habilidades.length}/${limite})`,
      slice,
      Math.max(1, Math.min(restante, 10)),
      null,
      1
    );
    rows.push(new ActionRowBuilder().addComponents(select));
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("menos_page:habilidades")
        .setLabel("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pg === 0),
      new ButtonBuilder()
        .setCustomId("mais_page:habilidades")
        .setLabel("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((pg + 1) * 10 >= all.length),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("➡️ Próximo")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(data.habilidades.length === 0)
    )
  );

  for (let i = 0; i < data.habilidades.length; i += 5) {
    rows.push(
      new ActionRowBuilder().addComponents(
        data.habilidades
          .slice(i, i + 5)
          .map((h) =>
            new ButtonBuilder()
              .setCustomId(`remove:habilidades:${h}`)
              .setLabel(`❌ ${h}`)
              .setStyle(ButtonStyle.Danger)
          )
      )
    );
  }

  const descText = data.descricaoHabilidades
    ? `${data.descricaoHabilidades}\n\n`
    : autoText;

  await interaction.editReply({
    content:
      descText +
      `7/8 – Habilidades (${data.habilidades.length}/${data.limite_habilidades})\n\n` +
      (restante > 0
        ? `Selecione até ${restante} poder(es):`
        : `Nenhuma habilidade disponível para seleção.`),
    components: rows,
    flags: 64, // 64 = EPHEMERAL
  });
}

async function mostrarEquipamentos(interaction, data) {
  const mec = temp.get(interaction.user.id).mec;
  const all = mec.EQUIPAMENTOS;
  const pg = data.pagina_equip || 0;
  const slice = all.slice(pg * 10, (pg + 1) * 10);

  const rows = [];

  // Só adiciona o select se houver opções
  if (slice.length > 0) {
    const select = criarSelect(
      "sel_8_equip",
      "Equipamentos",
      slice,
      slice.length
    );
    rows.push(new ActionRowBuilder().addComponents(select));
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("menos_page:equipamentos")
        .setLabel("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pg === 0),
      new ButtonBuilder()
        .setCustomId("mais_page:equipamentos")
        .setLabel("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((pg + 1) * 10 >= all.length),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("✅ Finalizar")
        .setStyle(ButtonStyle.Success)
        .setDisabled(data.equipamentos.length === 0)
    )
  );

  for (let i = 0; i < data.equipamentos.length; i += 5) {
    rows.push(
      new ActionRowBuilder().addComponents(
        data.equipamentos
          .slice(i, i + 5)
          .map((e) =>
            new ButtonBuilder()
              .setCustomId(`remove:equipamentos:${e}`)
              .setLabel(`❌ ${e}`)
              .setStyle(ButtonStyle.Danger)
          )
      )
    );
  }

  await interaction.editReply({
    content: `8/8 – Equipamentos (${data.equipamentos.length})`,
    components: rows,
    flags: 64, // 64 = EPHEMERAL
  });
}

// 2b️⃣ Aleatória: distribuição uniforme
function distribuirAleatorio(data) {
  let pts = 30;
  const keys = ["FOR", "DES", "CON", "INT", "SAB", "CAR"];
  keys.forEach((k) => (data.atributos[k] = 0));
  while (pts > 0) {
    const k = keys[Math.floor(Math.random() * keys.length)];
    if (data.atributos[k] < 18) {
      data.atributos[k]++;
      pts--;
    }
  }
  data.pontosRestantes = 0;
}

function aplicarBonusRacial(data, mec) {
  // 1️⃣ Busco objetos de raça e sub-raça
  const racaObj = mec.RACAS.find((r) => r.nome === data.selecoes.raca) || {};
  const subracaObj = mec.SUBRACAS.find(
    (sr) => sr.nome === data.selecoes.subraca && sr.raca === data.selecoes.raca
  ) || { vantagens: [] };

  // 2️⃣ Aplico modificadores de atributo da raça
  if (Array.isArray(racaObj.modificadores_atributo)) {
    racaObj.modificadores_atributo.forEach((mod) => {
      if (mod.atributo === "QUALQUER") {
        // humanos, lógica especial…
        let count = mod.quantidade || 1;
        const keys = ["FOR", "DES", "CON", "INT", "SAB", "CAR"];
        for (let i = 0; i < count; i++) {
          const menor = keys.reduce((a, b) =>
            data.atributos[a] < data.atributos[b] ? a : b
          );
          data.atributos[menor] += mod.valor;
        }
      } else if (data.atributos[mod.atributo] != null) {
        data.atributos[mod.atributo] += mod.valor;
      }
    });
  }

  // 3️⃣ Aplico modificadores de atributo da sub‑raça
  subracaObj.vantagens
    .filter((v) => v.tipo === "atributo")
    .forEach((v) => {
      if (data.atributos[v.atributo] != null) {
        data.atributos[v.atributo] += v.valor;
      }
    });

  // 4️⃣ Coleto poderes raciais e insiro em habilidades_autom
  if (Array.isArray(racaObj.poderes_raciais)) {
    data.habilidades_autom.push(...racaObj.poderes_raciais);
  }

  // 5️⃣ Cadastro lista final deduplicada de habilidades e perícias
  data.habilidades_autom = [...new Set(data.habilidades_autom)];
  data.pericias_autom = [...new Set(data.pericias_autom)];
}

function aplicarPoderesDivinos(data, mec) {
  const div = mec.DIVINDADES.find((d) => d.nome === data.divindade);
  if (!div) return;

  const devotos = div.devotos || [];
  const aceitaQualquer = devotos.includes("Qualquer um");
  const ehDevoto = aceitaQualquer || devotos.includes(data.classe);

  if (!ehDevoto) return; // não recebe poderes

  // adiciona cada poder concedido
  (div.poderes_concedidos || []).forEach((p) => {
    if (!data.habilidades_autom.includes(p)) {
      data.habilidades_autom.push(p);
    }
  });
}

// Steps array
const steps = [
  null,
  { name: "Método", validate: () => true, render: mostrarMetodoDistribuicao },
  {
    name: "Atributos",
    validate: (d) => d.pontosRestantes === 0,
    render: mostrarAtributos,
  },
  {
    name: "Raça",
    validate: (data) => {
      // precisa ter a raça
      if (!data.selecoes.raca) return false;

      // pega a sessão pra ter acesso ao mec
      const sess = temp.get(data.autor);
      if (!sess) return false;

      // filtra as sub-raças deste JSON
      const subracas = subracasAll.filter(
        (sr) => sr.raca === data.selecoes.raca
      );

      // se existir sub-raça e não estiver selecionada, falha
      if (subracas.length > 0 && !data.selecoes.subraca) return false;

      return true;
    },
    render: (interaction, data) => mostrarRaca(interaction, data),
  },
  { name: "Classe", validate: (d) => Boolean(d.classe), render: mostrarClasse },
  { name: "Origem", validate: (d) => Boolean(d.origem), render: mostrarOrigem },
  { name: "Divindade", validate: () => true, render: mostrarDivindade },
  {
    name: "Perícias",
    validate: (d) => d.pericias.length > 0,
    render: mostrarPericias,
  },
  {
    name: "Habilidades",
    validate: (d) => d.habilidades.length > 0,
    render: mostrarHabilidades,
  },
  {
    name: "Equipamentos",
    validate: (d) => d.equipamentos.length > 0,
    render: mostrarEquipamentos,
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("criar_ficha")
    .setDescription("Cria ficha Tormenta 20")
    .addStringOption((o) =>
      o.setName("nome").setDescription("Nome").setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName("nivel")
        .setDescription("Nível")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(20)
    )
    .addAttachmentOption((o) =>
      o.setName("imagem").setDescription("Imagem (opcional)")
    ),

  async execute(interaction) {
    if (interaction.channel.name !== "fichas")
      return interaction.reply({
        content: "❌ Apenas em #fichas",
        flags: 64, // 64 = EPHEMERAL
      });

    const mec = await carregarMecanica();
    if (!mec)
      return interaction.reply({
        content: "❌ Falha ao carregar mecânica",
        flags: 64, // 64 = EPHEMERAL
      });

    const data = {
      nome: interaction.options.getString("nome"),
      nivel: interaction.options.getInteger("nivel"),
      mecanica: "tormenta20",
      autor: interaction.user.id,
      imagem: interaction.options.getAttachment("imagem")?.url || null,
      historia: interaction.channel.parent?.name || null,
      rerolls: {},
      atributos: { FOR: 0, DES: 0, CON: 0, INT: 0, SAB: 0, CAR: 0 },
      pontosRestantes: 30,
      inventario: [],
      carteira: { TO: 100, TP: 0, TC: 0 },
      equipados: {
        arma_principal: null,
        arma_secundaria: null,
        armadura: null,
        outros: [],
      },
      selecoes: {
        raca: null,
        subraca: null,
      },
      classe: null,
      origem: null,
      divindade: null,
      pericias: [],
      pericias_autom: [],
      pagina_pericias: 0,
      habilidades: [],
      habilidades_autom: [],
      pagina_hab: 0,
      equipamentos: [],
      pagina_equip: 0,
      poderes_raciais: [],
      vantagens_subraca: [],
    };

    data.limite_pericias = calcularLimitePericias(data, mec);
    data.limite_habilidades = calcularLimiteHabilidades(data, mec);

    temp.set(interaction.user.id, { step: 1, data, mec });
    return steps[1].render(interaction, data);
  },

  async handleComponent(interaction) {
    await interaction.deferUpdate().catch(() => {});
    const isDeferredSafe =
      interaction.customId.startsWith("remove:") ||
      interaction.customId === "method_roll" ||
      interaction.customId.startsWith("reroll_") ||
      interaction.customId.startsWith("fix_");

    if (isDeferredSafe) {
      await interaction.deferUpdate().catch(() => {});
    }

    const sess = temp.get(interaction.user.id);
    if (!sess) return;

    let { step, data, mec } = sess;

    // Step 1: método de distribuição
    if (interaction.isButton() && step === 1) {
      switch (interaction.customId) {
        case "method_manual":
          sess.step = 2;
          temp.set(interaction.user.id, sess);

          return steps[2].render(interaction, data);
        case "method_random":
          distribuirAleatorio(data);
          sess.step = 3;
          temp.set(interaction.user.id, sess);
          return steps[3].render(interaction, data);
        case "method_roll":
          sess.step = 2;
          temp.set(interaction.user.id, sess);
          return mostrarRoll(interaction, data, 0);
        default:
          return;
      }
    }

    // Reroll / fix no método roll
    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id.startsWith("reroll_")) {
        const [, attr, idx] = id.split("_");
        const count = data.rerolls[attr] || 0;
        if (count >= 2) {
          // já bateu o limite, só re-renderiza sem incrementar
          return mostrarRoll(interaction, data, parseInt(idx));
        }
        data.rerolls[attr] = count + 1;
        return mostrarRoll(interaction, data, parseInt(idx));
      }
      if (id.startsWith("fix_")) {
        const [, , idx] = id.split("_");
        const nextIdx = parseInt(idx, 10) + 1;
        return mostrarRoll(interaction, data, nextIdx);
      }
    }

    // Menu de seleção
    if (interaction.isStringSelectMenu()) {
      await interaction.deferUpdate().catch(() => {});
      const id = interaction.customId;
      const vals = interaction.values;

      switch (id) {
        case "sel_2_raca":
          data.selecoes.raca = vals[0];
          data.selecoes.subraca = null;
          // salva descrição
          data.descricaoRaca =
            racas.find((r) => r.nome === vals[0])?.descricao ||
            "Descrição não disponível.";
          // Aplica bônus racial e poderes raciais
          aplicarBonusRacial(data, mec);
          return mostrarRaca(interaction, data);

        case "sel_2_subraca":
          data.selecoes.subraca = vals[0];
          data.descricaoSubraca =
            subracasAll.find(
              (sr) => sr.nome === vals[0] && sr.raca === data.selecoes.raca
            )?.descricao || "Descrição não disponível.";
          // Aplica bônus racial e poderes raciais
          aplicarBonusRacial(data, mec);
          return mostrarRaca(interaction, data);

        case "sel_3_classe":
          data.classe = vals[0];
          aplicarBeneficiosAutomaticos(data, mec);

          data.descricaoClasse =
            mec.CLASSES.find((c) => c.nome === vals[0])?.descricao ||
            "Descrição não disponivel";

          const classeObj = mec.CLASSES.find((c) => c.nome === vals[0]);
          if (Array.isArray(classeObj.pericias_treinadas)) {
            classeObj.pericias_treinadas.forEach((p) => {
              if (!data.pericias_autom.includes(p)) data.pericias_autom.push(p);
            });
          }
          const descClasse =
            classeObj?.descricao || "Descrição não disponível.";

          data.limite_pericias = calcularLimitePericias(data, mec);
          return mostrarClasse(interaction, data);

        case "sel_4_origem":
          data.origem = vals[0];
          aplicarBeneficiosAutomaticos(data, mec);

          data.descricaoOrigem =
            mec.ORIGENS.find((o) => o.nome === vals[0])?.descricao ||
            "Descrição não disponível.";

          const origemObj = mec.ORIGENS.find((o) => o.nome === vals[0]);
          const descOrigem =
            origemObj?.descricao || "Descrição não disponível.";

          return mostrarOrigem(interaction, data);

        case "sel_5_divindade":
          data.divindade = vals[0];
          aplicarBeneficiosAutomaticos(data, mec);
          aplicarEquipamentosIniciais(data, mec);
          aplicarPoderesDivinos(data, mec);

          data.descricaoDivindade =
            mec.DIVINDADES.find((d) => d.nome === vals[0])?.descricao ||
            "Descrição não disponível.";

          const divindadeObj = mec.DIVINDADES.find(
            (d) => d.nome === vals[0]
          ) || { descricao: "Descrição não disponível." };

          return mostrarDivindade(interaction, data);

        case "sel_6_pericia": {
          data.descricaoPericias = vals
            .map((v) => {
              const p = mec.PERICIAS.find((p) => p.nome === v);
              return `📘 **${v}**: ${p?.descricao || "Sem descrição."}`;
            })
            .join("\n");
          const limite = calcularLimitePericias(data, mec);
          for (const v of vals) {
            if (!data.pericias.includes(v) && data.pericias.length < limite) {
              data.pericias.push(v);
            }
          }
          return mostrarPericias(interaction, data);
        }

        case "sel_7_hab": {
          console.log("[sel_7_hab] vals:", vals);
          // 1️⃣ descrições
          data.descricaoHabilidades = vals
            .map((v) => {
              const h = mec.HABILIDADES.find((h) => h.nome === v);
              return `✨ **${v}**: ${h?.descricao || "Sem descrição."}`;
            })
            .join("\n");

          // 2️⃣ adiciona ao array
          const limiteH = calcularLimiteHabilidades(data, mec);
          console.log("[sel_7_hab] limite:", limiteH);
          for (const v of vals) {
            if (
              !data.habilidades.includes(v) &&
              data.habilidades.length < limiteH
            ) {
              data.habilidades.push(v);
            }
          }

          // 3️⃣ re-renderiza
          console.log("renderizando habilidades...", data.habilidades);
          return mostrarHabilidades(interaction, data);
        }

        case "sel_8_equip":
          for (const val of vals) {
            if (!data.equipamentos.includes(val)) {
              data.equipamentos.push(val);
            }
          }
          break;

        default:
          console.warn(
            "[criar_ficha.js][handleComponent] SelectMenu sem tratamento para:",
            id
          );
          break;
      }

      // Re-renderiza o passo atual depois da alteração
      return steps[step].render(interaction, data);
    }

    // Botões de navegação e ajustes
    if (interaction.isButton()) {
      const [act, param] = interaction.customId.split("_");

      // Avançar de etapa
      if (act === "next") {
        // Valida a etapa atual
        if (!steps[step].validate(data)) {
          return interaction.followUp({
            content: `❌ Preencha ${steps[step].name}`,
            flags: 64, // 64 = EPHEMERAL
          });
        }

        // Incrementa step
        step++;
        sess.step = step;
        temp.set(interaction.user.id, sess);

        // Só finalizar após a última etapa (index 9, supondo 10 passos)
        if (step > steps.length - 1) {
          // ➤ Reaplica bônus de raça/sub-raça (atributos + poderes raciais)
          aplicarBonusRacial(data, mec);

          // ➤ Reaplica benefícios de classe e origem (perícias, habilidades e equipamentos)
          aplicarBeneficiosAutomaticos(data, mec);
          aplicarEquipamentosIniciais(data, mec);
          aplicarPoderesDivinos(data, mec);

          // ➤ Só adiciona 100 TO **uma vez**, à carteira
          data.carteira.TO = (data.carteira.TO || 0) + 100;

          // ➤ Persiste a ficha
          await salvarFicha(interaction.user.id, data);
          temp.delete(interaction.user.id);

          return interaction.editReply({
            content: `✅ Ficha de **${data.nome}** criada com sucesso!`,
            components: [],
          });
        }

        // Renderiza a próxima etapa
        return steps[step].render(interaction, data);
      }

      // Ajuste manual de atributo
      if (
        (act === "mais" || act === "menos") &&
        ["FOR", "DES", "CON", "INT", "SAB", "CAR"].includes(param)
      ) {
        if (
          act === "mais" &&
          data.pontosRestantes > 0 &&
          data.atributos[param] < 18
        ) {
          data.atributos[param]++;
          data.pontosRestantes--;
        } else if (act === "menos" && data.atributos[param] > 0) {
          data.atributos[param]--;
          data.pontosRestantes++;
        }
        return steps[2].render(interaction, data);
      }

      // Paginação para pericias, habilidades e equipamentos
      if ((act === "mais" || act === "menos") && param.startsWith("page")) {
        const [_, key] = interaction.customId.split(":");
        // para habilidades, o campo no data é pagina_hab, não pagina_habilidades
        const pageKey = key === "habilidades" ? "pagina_hab" : `pagina_${key}`;

        if (key === "pericias") {
          const all = mec.PERICIAS.filter(
            (p) => !data.pericias_autom.includes(p.nome)
          );
          const maxPage = Math.max(0, Math.ceil(all.length / 10) - 1);
          if (act === "mais" && data[pageKey] < maxPage) data[pageKey]++;
          if (act === "menos" && data[pageKey] > 0) data[pageKey]--;
          return mostrarPericias(interaction, data);
        } else if (key === "habilidades") {
          const all = mec.HABILIDADES.filter(
            (h) => !data.habilidades_autom.includes(h.nome)
          );
          const maxPage = Math.max(0, Math.ceil(all.length / 10) - 1);
          if (act === "mais" && data[pageKey] < maxPage) data[pageKey]++;
          if (act === "menos" && data[pageKey] > 0) data[pageKey]--;
          return mostrarHabilidades(interaction, data);
        } else if (key === "equipamentos") {
          const list = mec.EQUIPAMENTOS;
          const maxPage = Math.max(0, Math.ceil(list.length / 10) - 1);
          if (act === "mais" && data[pageKey] < maxPage) data[pageKey]++;
          if (act === "menos" && data[pageKey] > 0) data[pageKey]--;
          return steps[step].render(interaction, data);
        }
      }

      // Remoção de item de lista (perícias, habilidades, equipamentos)
      if (interaction.isButton()) {
        const [act, type, item] = interaction.customId.split(":");

        if (act === "remove") {
          if (type === "pericias") {
            // remove do array de perícias e re-renderiza
            data.pericias = data.pericias.filter((x) => x !== item);
            return mostrarPericias(interaction, data);
          }

          if (type === "habilidades") {
            // remove do array de habilidades e re-renderiza
            data.habilidades = data.habilidades.filter((x) => x !== item);
            return mostrarHabilidades(interaction, data);
          }
        }
      }
    }

    // // Ao finalizar:
    // if (step > steps.length - 1) {
    //   aplicarBeneficiosAutomaticos(data, mec);
    //   aplicarEquipamentosIniciais(data, mec);
    //   // Só adiciona 100 TO na carteira:
    //   data.carteira.TO = (data.carteira.TO || 0) + 100;
    //   await salvarFicha(interaction.user.id, data);
    //   temp.delete(interaction.user.id);
    //   return interaction.editReply({
    //     content: `✅ Ficha de **${data.nome}** criada com sucesso!`,
    //     components: [],
    //   });
    // }
  },
};
