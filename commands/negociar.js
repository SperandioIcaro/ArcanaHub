const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType
} = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

const ATIVAS_PATH = path.join(__dirname, '..', 'fichas', 'ativas.json');

const slugify = txt =>
  txt.toString().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '').trim()
    .replace(/\s+/g, '-');

function resolveFichaPath(mec, userId) {
  if (fs.existsSync(ATIVAS_PATH)) {
    const todas = fs.readJsonSync(ATIVAS_PATH);
    const entry = todas[userId];
    if (entry && entry.arquivo && entry.mecanica) {
      const p = path.join(__dirname, '..', 'fichas', entry.mecanica, userId, entry.arquivo);
      if (fs.existsSync(p)) return p;
    }
  }
  const nested = path.join(__dirname, '..', 'fichas', mec, userId, `${userId}.json`);
  const flat = path.join(__dirname, '..', 'fichas', mec, `${userId}.json`);
  if (fs.existsSync(nested)) return nested;
  if (fs.existsSync(flat)) return flat;
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('negociar')
    .setDescription('Negocia com mercador ativo')
    .addSubcommand(sub =>
      sub.setName('mercador')
        .setDescription('Comprar ou vender com mercador ativo')
        .addStringOption(o =>
          o.setName('mercador')
            .setDescription('Nome do mercador')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const channelName = interaction.channel.parent?.name;
    if (!channelName) return interaction.respond([]);
    const mec = (channelName.match(/\[(.*?)\]/)?.[1] || channelName).toLowerCase();
    const slugH = slugify(channelName);
    const dir = path.join(__dirname, '..', 'fichas', mec, 'mercadores', slugH);
    const files = await fs.readdir(dir).catch(() => []);
    const choices = [];

    for (const file of files.filter(f => f.endsWith('.json'))) {
      const m = await fs.readJson(path.join(dir, file));
      if (m.ativo) choices.push(m.nome);
    }

    const response = choices
      .filter(n => n.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(n => ({ name: n, value: n }));
    await interaction.respond(response);
  },

  async execute(interaction) {
    const mercName = interaction.options.getString('mercador');
    const channelName = interaction.channel.parent?.name;
    if (!channelName) return interaction.reply({ content: '🔍 História não encontrada.', ephemeral: true });

    const mec = (channelName.match(/\[(.*?)\]/)?.[1] || channelName).toLowerCase();
    const slugH = slugify(channelName);
    const mercPath = path.join(__dirname, '..', 'fichas', mec, 'mercadores', slugH, `${slugify(mercName)}.json`);
    const merc = await fs.readJson(mercPath).catch(() => null);
    if (!merc?.ativo) return interaction.reply({ content: '❌ Mercador não disponível.', ephemeral: true });

    const items = Object.entries(merc.itens)
      .filter(([, v]) => v.quantidade > 0)
      .map(([nome, v]) => ({ nome, preco: v.preco, qtd: v.quantidade }));

    if (items.length === 0) {
      return interaction.reply({ content: '✅ O mercador está sem estoque.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🛍️ Estande de ${merc.nome}`)
      .setDescription('Veja abaixo os itens disponíveis para negociação.')
      .addFields(items.map(i => ({
        name: `📦 ${i.nome}`,
        value: `💰 **${i.preco} TO**\n📦 Estoque: **${i.qtd}**`,
        inline: true
      })))
      .setColor(0x2ecc71);

    const actionMenu = new StringSelectMenuBuilder()
      .setCustomId('negociar_action')
      .setPlaceholder('Escolha uma ação...')
      .addOptions([
        { label: 'Comprar', value: 'comprar', emoji: '🛒' },
        { label: 'Vender', value: 'vender', emoji: '💰' },
      ]);

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(actionMenu)],
      ephemeral: true
    });

    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 120_000
    });

    let actionType;

    collector.on('collect', async selectInt => {
      if (selectInt.user.id !== interaction.user.id) return;

      if (selectInt.customId === 'negociar_action') {
        actionType = selectInt.values[0];

        let options;
        if (actionType === 'comprar') {
          options = items.map(i => ({
            label: i.nome,
            description: `💰 ${i.preco} TO • Estoque: ${i.qtd}`,
            value: i.nome
          }));
        } else {
          const fichaPath = resolveFichaPath(mec, interaction.user.id);
          if (!fichaPath) {
            await selectInt.reply({ content: '❌ Você não possui ficha ativa.', ephemeral: true });
            collector.stop();
            return;
          }

          const inv = await fs.readJson(fichaPath).then(f => f.inventario || []);
          options = Object.entries(inv.reduce((acc, i) => {
            acc[i] = (acc[i] || 0) + 1;
            return acc;
          }, {})).map(([nome, qtd]) => ({
            label: nome,
            description: `Você tem ${qtd}`,
            value: nome
          }));
        }

        const itemMenu = new StringSelectMenuBuilder()
          .setCustomId('negociar_item')
          .setPlaceholder(`Escolha o item para ${actionType}`)
          .addOptions(options.slice(0, 25));

        return selectInt.update({
          content: `📌 Selecione o item para **${actionType}**:`,
          components: [new ActionRowBuilder().addComponents(itemMenu)],
          embeds: []
        });
      }

      if (selectInt.customId === 'negociar_item') {
        const itemName = selectInt.values[0];
        let maxQty = 0;

        if (actionType === 'comprar') {
          const m = await fs.readJson(mercPath);
          maxQty = m.itens[itemName]?.quantidade || 0;
        } else {
          const fichaPath = resolveFichaPath(mec, interaction.user.id);
          if (!fichaPath) {
            await selectInt.reply({ content: '❌ Você não possui ficha ativa.', ephemeral: true });
            collector.stop();
            return;
          }

          const inv = await fs.readJson(fichaPath).then(f => f.inventario || []);
          maxQty = inv.filter(i => i === itemName).length;
        }

        const qtyMenu = new StringSelectMenuBuilder()
          .setCustomId(`negociar_qty|${itemName}`)
          .setPlaceholder('Quantidade')
          .addOptions(
            Array.from({ length: Math.min(maxQty, 25) }, (_, i) => ({
              label: `${i + 1}`,
              value: String(i + 1)
            }))
          );

        return selectInt.update({
          content: `🔢 Escolha a quantidade de **${itemName}** para **${actionType}**:`,
          components: [new ActionRowBuilder().addComponents(qtyMenu)],
          embeds: []
        });
      }

      if (selectInt.customId.startsWith('negociar_qty')) {
        const [, itemName] = selectInt.customId.split('|');
        const quantity = parseInt(selectInt.values[0], 10);
        const fichaPath = resolveFichaPath(mec, interaction.user.id);

        if (!fichaPath) {
          await selectInt.reply({ content: '❌ Você não possui ficha ativa.', ephemeral: true });
          collector.stop();
          return;
        }

        const [m, f] = await Promise.all([
          fs.readJson(mercPath),
          fs.readJson(fichaPath)
        ]);

        f.inventario = f.inventario || [];

        if (actionType === 'comprar') {
          m.itens[itemName].quantidade -= quantity;
          for (let i = 0; i < quantity; i++) f.inventario.push(itemName);
        } else {
          for (let i = 0; i < quantity; i++) {
            const idx = f.inventario.indexOf(itemName);
            if (idx !== -1) f.inventario.splice(idx, 1);
          }
          m.itens[itemName].quantidade += quantity;
        }

        await Promise.all([
          fs.writeJson(mercPath, m, { spaces: 2 }),
          fs.writeJson(fichaPath, f, { spaces: 2 })
        ]);

        await selectInt.update({
          content: `✅ Você **${actionType === 'comprar' ? 'comprou' : 'vendeu'}** \`${quantity}x ${itemName}\` ${actionType === 'comprar' ? 'do' : 'para'} **${merc.nome}**.`,
          embeds: [],
          components: []
        });
        collector.stop();
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({
          content: '⌛ Negociação cancelada por inatividade.',
          embeds: [],
          components: []
        });
      }
    });
  }
};
