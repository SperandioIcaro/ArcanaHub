const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('selecionar_ficha')
    .setDescription('Seleciona e ativa uma ficha para você nesta história.')
    .setDefaultMemberPermissions(0), // permitido a todos

  async execute(interaction) {
    const userId = interaction.user.id;
    const historia = interaction.channel.parent?.name;
    if (!historia) {
      return interaction.reply({ content: '❌ Comando válido apenas dentro de uma história (categoria).', ephemeral: true });
    }

    const fichasDir = path.join(__dirname, '../fichas', userId);
    if (!await fs.pathExists(fichasDir)) {
      return interaction.reply({ content: '❌ Você não possui fichas nesta história.', ephemeral: true });
    }

    const arquivos = await fs.readdir(fichasDir);
    const options = [];
    for (const arquivo of arquivos) {
      if (!arquivo.endsWith('.json')) continue;
      const ficha = await fs.readJson(path.join(fichasDir, arquivo));
      if (ficha.historia === historia) {
        options.push({ label: `${ficha.nome} (Nv ${ficha.nivel})`, value: arquivo });
      }
    }

    if (options.length === 0) {
      return interaction.reply({ content: '❌ Nenhuma ficha encontrada nesta história.', ephemeral: true });
    }

    // lê ativa
    const ativasPath = path.join(__dirname, '../fichas', 'ativas.json');
    const ativas = await fs.readJson(ativasPath).catch(() => ({}));
    const ativa = ativas[userId];

    const select = new StringSelectMenuBuilder()
      .setCustomId('selecionar_ficha')
      .setPlaceholder('Selecione uma ficha...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);
    const header = ativa
      ? `🔸 Ficha ativa atual: **${ativa}**\n`  
      : '';

    return interaction.reply({
      content: `${header}🎯 Selecione sua ficha para esta história:`,
      components: [row],
      ephemeral: true
    });
  },

  async handleComponent(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'selecionar_ficha') return;
    const userId = interaction.user.id;
    const historia = interaction.channel.parent?.name;
    const fichasDir = path.join(__dirname, '../fichas', userId);

    const arquivo = interaction.values[0];
    const ficha = await fs.readJson(path.join(fichasDir, arquivo));
    if (ficha.historia !== historia) {
      return interaction.update({ content: '❌ Essa ficha não pertence à história atual.', components: [], ephemeral: true });
    }

    // salva ativa
    const ativasPath = path.join(__dirname, '../fichas', 'ativas.json');
    const ativas = await fs.readJson(ativasPath).catch(() => ({}));
    ativas[userId] = ficha.nome;
    await fs.writeJson(ativasPath, ativas, { spaces: 2 });

    // monta embed cartão
    const embed = new EmbedBuilder()
      .setTitle(`🪪 ${ficha.nome}`)
      .setThumbnail(ficha.imagem || null)
      .setColor(0x964b00)
      .addFields(
        { name: '🎭 Classe', value: ficha.classe, inline: true },
        { name: '🧬 Raça', value: ficha.raca + (ficha.subraca ? ` (${ficha.subraca})` : ''), inline: true },
        { name: '🧙 Nível', value: ficha.nivel.toString(), inline: true },
        { name: '❤️ Vida', value: `${ficha.vida}/${ficha.vida_max || '?'}`, inline: true },
        { name: '💧 Mana', value: `${ficha.mana}/${ficha.mana_max || '?'}`, inline: true },
        { name: '🛡️ Armadura', value: ficha.armadura?.toString() || '?', inline: true }
      )
      .setFooter({ text: `Ativada por ${interaction.user.username}` });

    return interaction.update({ content: '✅ Ficha selecionada e ativada!', embeds: [embed], components: [], ephemeral: true });
  }
};
