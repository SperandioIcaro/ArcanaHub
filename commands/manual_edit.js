const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { manualEmbed } = require('../manualEmbed');
const fs = require('fs-extra');
const path = require('path');

const manualIdPath = path.join(__dirname, '../data/manualMessageId.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manual_edit')
    .setDescription('Edita o manual fixado (somente administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!await fs.pathExists(manualIdPath)) {
      return interaction.reply({ content: '❌ Manual ainda não foi enviado/fixado.', ephemeral: true });
    }

    const { messageId, channelId } = await fs.readJson(manualIdPath);

    try {
      const canal = await interaction.client.channels.fetch(channelId);
      const mensagem = await canal.messages.fetch(messageId);

      await mensagem.edit({ embeds: [manualEmbed] });

      await interaction.reply({ content: '✅ Manual fixado editado com sucesso.', ephemeral: true });
    } catch (err) {
      console.error('Erro ao editar manual fixado:', err);
      await interaction.reply({ content: '❌ Não foi possível editar a mensagem fixada.', ephemeral: true });
    }
  }
};
