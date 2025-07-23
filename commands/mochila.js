const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mochila')
    .setDescription('Mostra todos os itens da sua mochila.'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // Lê a ficha ativa
    const ativasPath = path.join(__dirname, '../fichas/ativas.json');
    const ativas = await fs.readJson(ativasPath).catch(() => ({}));
    const ativa = ativas[userId];

    if (!ativa) {
      return interaction.reply({ content: '❌ Você ainda não selecionou uma ficha.', ephemeral: true });
    }

    const fichaPath = path.join(__dirname, '../fichas', ativa.mecanica, userId, ativa.arquivo);
    if (!await fs.pathExists(fichaPath)) {
      return interaction.reply({ content: '❌ A ficha ativa não foi encontrada.', ephemeral: true });
    }

    const ficha = await fs.readJson(fichaPath);
    const equipamentos = ficha.equipamentos || [];

    if (equipamentos.length === 0) {
      return interaction.reply({ content: '🎒 Sua mochila está vazia.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎒 Mochila de ${ficha.nome}`)
      .setColor(0xaaaaaa)
      .setDescription(equipamentos.map(i => `• ${i}`).join('\n'))
      .setFooter({ text: 'Use /equipar <item> para equipar um item.' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
