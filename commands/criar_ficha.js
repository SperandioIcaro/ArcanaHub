const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

const RACAS = ['Humano', 'Anão', 'Elfo', 'Orc', 'Gnomo', 'Halfling', 'Meio-Elfo', 'Meio-Orc'];
const SUBRACAS = ['Puro', 'Alto Elfo', 'Elfo da Floresta', 'Elfo Negro'];
const ORIGENS = ['Nobre', 'Camponês', 'Mercador', 'Soldado', 'Ermitão', 'Forasteiro'];
const CLASSES = ['Bárbaro', 'Bardo', 'Bruxo', 'Cavaleiro', 'Clérigo', 'Druida', 'Guerreiro', 'Inventor', 'Ladino', 'Lutador', 'Mago', 'Paladino', 'Patrulheiro'];
const PERICIAS = require('./data/pericias.json');
const HABILIDADES = require('./data/habilidades.json');

const temp = new Map();

const slugify = text => text.toString().toLowerCase()
  .normalize('NFD').replace(/[^\w\s-]/g, '')
  .trim().replace(/\s+/g, '-');

function createSelect(id, placeholder, options, max = 1, selected = null) {
  return new StringSelectMenuBuilder()
    .setCustomId(id)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(max)
    .addOptions(options.map(opt => ({
      label: opt.label || opt,
      value: opt.value || opt,
      default: selected === (opt.value || opt)
    })));
}

function paginar(array, page = 0, pageSize = 10) {
  return array.slice(page * pageSize, (page + 1) * pageSize);
}

function criarBotoesPaginacao(baseId, page, maxPage) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${baseId}_menos`)
      .setLabel('⬅️ Menos opções')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`${baseId}_mais`)
      .setLabel('➡️ Mais opções')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= maxPage - 1)
  );
}

async function salvarFicha(sess, interaction) {
  const data = sess.data;
  const dir = path.join(__dirname, '../fichas', interaction.user.id);
  await fs.ensureDir(dir);
  await fs.writeJson(path.join(dir, slugify(data.nome) + '.json'), data, { spaces: 2 });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('criar_ficha')
    .setDescription('Cria uma ficha de personagem completa.')
    .addStringOption(opt =>
      opt.setName('nome').setDescription('Nome do personagem').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('nivel').setDescription('Nível (1-20)').setRequired(true).setMinValue(1).setMaxValue(20))
    .addAttachmentOption(opt =>
      opt.setName('imagem').setDescription('Imagem do personagem (opcional).')),

  async execute(interaction) {
    // Somente no canal #fichas
    if (interaction.channel.name !== 'fichas') {
      return interaction.reply({
        content: '❌ Este comando só pode ser usado no canal #fichas.',
        ephemeral: true
      });
    }

    const nome = interaction.options.getString('nome');
    const nivel = interaction.options.getInteger('nivel');
    const imagem = interaction.options.getAttachment('imagem');

    const data = { 
      nome, 
      nivel, 
      pericias: [], 
      habilidades: [], 
      autor: interaction.user.id,
      historia: interaction.channel.parent?.name || 'indefinida'
    };
    if (imagem) data.imagem = imagem.url;

    temp.set(interaction.user.id, { step: 1, data, perPage: 0, habPage: 0 });

    // Monta selects iniciais
    const rowR = new ActionRowBuilder().addComponents(
      createSelect('raca', 'Selecione Raça', RACAS.map(v => ({ label: v, value: v })))
    );
    const rowSR = new ActionRowBuilder().addComponents(
      createSelect('subraca', 'Selecione Sub-raça', SUBRACAS.map(v => ({ label: v, value: v })))
    );
    const rowO = new ActionRowBuilder().addComponents(
      createSelect('origem', 'Selecione Origem', ORIGENS.map(v => ({ label: v, value: v })))
    );
    const rowC = new ActionRowBuilder().addComponents(
      createSelect('classe', 'Selecione Classe', CLASSES.map(v => ({ label: v, value: v })))
    );
    const rowNext = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('proximo_1')
        .setLabel('➡️ Próximo')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    );

    return interaction.reply({
      content: `1/6 – ${nome} (Nível ${nivel})\nEscolha Raça, Sub-raça, Origem e Classe:\n\n*Se você anexou uma imagem, ela já foi salva.*`,
      components: [rowR, rowSR, rowO, rowC, rowNext],
      ephemeral: true
    });
  },

  async handleComponent(interaction) {
    const sess = temp.get(interaction.user.id);
    if (!sess) return;
    const { step, data, perPage = 0, habPage = 0 } = sess;

    // Etapa 1 – seleção de Raça/Sub-raça/Origem/Classe
    if (step === 1 && interaction.isStringSelectMenu()) {
      data[interaction.customId] = interaction.values[0];
      const allFilled = ['raca', 'subraca', 'origem', 'classe'].every(k => data[k]);

      const rowR = new ActionRowBuilder().addComponents(
        createSelect('raca', 'Selecione Raça', RACAS.map(v => ({ label: v, value: v })), 1, data.raca)
      );
      const rowSR = new ActionRowBuilder().addComponents(
        createSelect('subraca', 'Selecione Sub-raça', SUBRACAS.map(v => ({ label: v, value: v })), 1, data.subraca)
      );
      const rowO = new ActionRowBuilder().addComponents(
        createSelect('origem', 'Selecione Origem', ORIGENS.map(v => ({ label: v, value: v })), 1, data.origem)
      );
      const rowC = new ActionRowBuilder().addComponents(
        createSelect('classe', 'Selecione Classe', CLASSES.map(v => ({ label: v, value: v })), 1, data.classe)
      );
      const rowNext = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('proximo_1')
          .setLabel('➡️ Próximo')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!allFilled)
      );

      return interaction.update({
        content: `1/6 – ${data.nome} (Nível ${data.nivel})\nEscolha Raça, Sub-raça, Origem e Classe:\n\n*Se você anexou uma imagem, ela já foi salva.*`,
        components: [rowR, rowSR, rowO, rowC, rowNext],
        ephemeral: true
      });
    }

    // Etapa 1 – avançar para Perícias
    if (step === 1 && interaction.isButton() && interaction.customId === 'proximo_1') {
      sess.step = 2;
      const pageItems = paginar(PERICIAS, 0);
      const opts = pageItems.map(p => ({ label: `${p.nome} (${p.atributo})`, value: p.nome }));
      const row = new ActionRowBuilder().addComponents(
        createSelect('sel_pericia', '2/6 – Selecione Perícia', opts, 1)
      );
      const nav = criarBotoesPaginacao('pericia', 0, Math.ceil(PERICIAS.length / 10));

      return interaction.update({
        content: `2/6 – Escolha 4 Perícias (1 por vez):\nJá escolhidas: ${data.pericias.join(', ') || 'nenhuma'}`,
        components: [row, nav],
        ephemeral: true
      });
    }

    // Etapa 2 – adicionar Perícias
    if (step === 2 && interaction.isStringSelectMenu() && interaction.customId === 'sel_pericia') {
      const escolha = interaction.values[0];
      if (!data.pericias.includes(escolha)) data.pericias.push(escolha);

      if (data.pericias.length >= 4) {
        sess.step = 3;
        const pagHab = paginar(HABILIDADES, 0);
        const row = new ActionRowBuilder().addComponents(
          createSelect('sel_hab', '3/6 – Selecione Habilidade', pagHab.map(h => ({ label: h, value: h })), 1)
        );
        const nav = criarBotoesPaginacao('hab', 0, Math.ceil(HABILIDADES.length / 10));

        return interaction.update({
          content: `3/6 – Escolha 4 Habilidades (1 por vez):\nJá escolhidas: ${data.habilidades.join(', ') || 'nenhuma'}`,
          components: [row, nav],
          ephemeral: true
        });
      }

      // continua paginação de perícias
      const pageItems = paginar(PERICIAS, sess.perPage);
      const row = new ActionRowBuilder().addComponents(
        createSelect('sel_pericia', '2/6 – Selecione Perícia', pageItems.map(p => ({ label: `${p.nome} (${p.atributo})`, value: p.nome })), 1)
      );
      const nav = criarBotoesPaginacao('pericia', sess.perPage, Math.ceil(PERICIAS.length / 10));

      return interaction.update({
        content: `2/6 – Perícia adicionada: ${escolha}\nJá escolhidas: ${data.pericias.join(', ')}`,
        components: [row, nav],
        ephemeral: true
      });
    }

    // Etapa 3 – adicionar Habilidades
    if (step === 3 && interaction.isStringSelectMenu() && interaction.customId === 'sel_hab') {
      const hab = interaction.values[0];
      if (!data.habilidades.includes(hab)) data.habilidades.push(hab);

      if (data.habilidades.length >= 4) {
        await salvarFicha(sess, interaction);
        temp.delete(interaction.user.id);
        return interaction.update({
          content: `✅ Ficha **${data.nome}** criada com sucesso!`,
          components: [],
          ephemeral: true
        });
      }

      const pageItems = paginar(HABILIDADES, sess.habPage);
      const row = new ActionRowBuilder().addComponents(
        createSelect('sel_hab', '3/6 – Selecione Habilidade', pageItems.map(h => ({ label: h, value: h })), 1)
      );
      const nav = criarBotoesPaginacao('hab', sess.habPage, Math.ceil(HABILIDADES.length / 10));

      return interaction.update({
        content: `3/6 – Habilidade adicionada: ${hab}\nJá escolhidas: ${data.habilidades.join(', ')}`,
        components: [row, nav],
        ephemeral: true
      });
    }

    // Botões de paginação (perícias e habilidades)
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('pericia')) {
        sess.perPage += interaction.customId.endsWith('mais') ? 1 : -1;
        const pageItems = paginar(PERICIAS, sess.perPage);
        const row = new ActionRowBuilder().addComponents(
          createSelect('sel_pericia', '2/6 – Selecione Perícia', pageItems.map(p => ({ label: `${p.nome} (${p.atributo})`, value: p.nome })), 1)
        );
        const nav = criarBotoesPaginacao('pericia', sess.perPage, Math.ceil(PERICIAS.length / 10));

        return interaction.update({
          content: `2/6 – Já escolhidas: ${data.pericias.join(', ')}`,
          components: [row, nav],
          ephemeral: true
        });
      }

      if (interaction.customId.startsWith('hab')) {
        sess.habPage += interaction.customId.endsWith('mais') ? 1 : -1;
        const pageItems = paginar(HABILIDADES, sess.habPage);
        const row = new ActionRowBuilder().addComponents(
          createSelect('sel_hab', '3/6 – Selecione Habilidade', pageItems.map(h => ({ label: h, value: h })), 1)
        );
        const nav = criarBotoesPaginacao('hab', sess.habPage, Math.ceil(HABILIDADES.length / 10));

        return interaction.update({
          content: `3/6 – Já escolhidas: ${data.habilidades.join(', ')}`,
          components: [row, nav],
          ephemeral: true
        });
      }
    }
  }
};
