const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

const slugify = text => text.toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\w\s-]/g, '')
  .trim().replace(/\s+/g, '-');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mercador-adicionar')
    .setDescription('Mestre: adiciona um item ao estoque de um mercador.')
    .addStringOption(opt =>
      opt.setName('mercador')
        .setDescription('Selecione o mercador')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(opt =>
      opt.setName('quantidade')
        .setDescription('Quantidade em estoque')
        .setRequired(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const historia = interaction.channel.parent?.name;
    if (!historia) return interaction.respond([]);
    const mecanica = (historia.match(/\[(.*?)\]/)?.[1] || historia).toLowerCase();
    const slugHist = slugify(historia);
    const mercDir = path.join(__dirname, '..', 'fichas', mecanica, 'mercadores', slugHist);

    if (focused.name === 'mercador') {
      const files = await fs.readdir(mercDir).catch(() => []);
      const opts = [];

      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const m = await fs.readJson(path.join(mercDir, f));
        opts.push({
          name: m.nome + (m.descricao ? ` – ${m.descricao}` : ''),
          value: f.replace(/\.json$/, '')
        });
      }

      return interaction.respond(
        opts.filter(o => o.name.toLowerCase().includes(focused.value.toLowerCase())).slice(0, 25)
      );
    }

    return interaction.respond([]);
  },

  async execute(interaction) {
    if (interaction.channel.name !== 'npcs-mobs') {
      return interaction.reply({ content: '❌ Use apenas em #npcs-mobs.', ephemeral: true });
    }

    const historia = interaction.channel.parent?.name;
    if (!historia) {
      return interaction.reply({ content: '❌ Sem categoria de história.', ephemeral: true });
    }

    const mecanica = (historia.match(/\[(.*?)\]/)?.[1] || historia).toLowerCase();
    const slugHist = slugify(historia);
    const mercSlug = interaction.options.getString('mercador');
    const qtd = interaction.options.getInteger('quantidade');
    const baseDir = path.join(__dirname, '..', 'fichas', mecanica, 'mercadores', slugHist);
    const mercPath = path.join(baseDir, `${mercSlug}.json`);

    if (!await fs.pathExists(mercPath)) {
      return interaction.reply({ content: '❌ Mercador não encontrado.', ephemeral: true });
    }

    const merc = await fs.readJson(mercPath);
    const armasPath = path.join(__dirname, '..', 'mechanics', mecanica, 'armas.json');
    const equipsPath = path.join(__dirname, '..', 'mechanics', mecanica, 'equipamentos.json');

    const armas = await fs.readJson(armasPath).catch(() => []);
    const equips = await fs.readJson(equipsPath).catch(() => []);

    const todos = [...armas, ...equips];
    const porPagina = 25;
    let paginaAtual = 0;

    const atualizarMenu = () => {
      const inicio = paginaAtual * porPagina;
      const fim = inicio + porPagina;
      const pagina = todos.slice(inicio, fim);

      const select = new StringSelectMenuBuilder()
        .setCustomId('selecionar_item')
        .setPlaceholder('Escolha um item para adicionar')
        .addOptions(pagina.map(item => ({
          label: item.nome.slice(0, 100),
          value: item.nome
        })));

      const row = new ActionRowBuilder().addComponents(select);
      const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('anterior')
          .setLabel('⬅️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(paginaAtual === 0),
        new ButtonBuilder()
          .setCustomId('proximo')
          .setLabel('➡️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(fim >= todos.length)
      );

      return [row, botoes];
    };

    const [selectRow, buttonsRow] = atualizarMenu();

    const msg = await interaction.reply({
      content: `🔍 Selecione o item para adicionar ao estoque de **${merc.nome}**.`,
      components: [selectRow, buttonsRow],
      ephemeral: true,
      fetchReply: true
    });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60_000 });

    collector.on('collect', async i => {
      if (i.customId === 'selecionar_item') {
        const nomeItem = i.values[0];
        const item = todos.find(it => it.nome === nomeItem);
        if (!item || !item.preco) {
          return i.update({ content: `❌ Item inválido ou sem preço: ${nomeItem}`, components: [], ephemeral: true });
        }

        merc.itens = merc.itens || {};
        if (merc.itens[nomeItem]) {
          merc.itens[nomeItem].quantidade += qtd;
        } else {
          merc.itens[nomeItem] = { quantidade: qtd, preco: item.preco };
        }

        await fs.writeJson(mercPath, merc, { spaces: 2 });

        collector.stop();
        return i.update({
          content: `✅ **${qtd}× ${nomeItem}** adicionados ao estoque de **${merc.nome}** (preço: ${item.preco}).`,
          components: []
        });
      }
    });

    msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000 })
      .on('collect', async btn => {
        if (btn.customId === 'anterior') paginaAtual--;
        if (btn.customId === 'proximo') paginaAtual++;
        const [newSelect, newButtons] = atualizarMenu();
        await btn.update({ components: [newSelect, newButtons] });
      });
  }
};
