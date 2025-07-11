const { SlashCommandBuilder } = require('discord.js');
const { manualEmbed } = require('../manualEmbed');
const fs = require('fs-extra');
const path = require('path');

const manualIdPath = path.join(__dirname, '../data/manualMessageId.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manual')
    .setDescription('Envia e fixa o manual de uso dos comandos do bot.'),

  async execute(interaction) {
    // Envia no canal onde foi executado
    const mensagem = await interaction.channel.send({ embeds: [manualEmbed] });

    // Tenta fixar a mensagem
    try {
      await mensagem.pin();

      // Salva o ID para poder editar depois
      await fs.ensureDir(path.dirname(manualIdPath));
      await fs.writeJson(manualIdPath, { messageId: mensagem.id, channelId: interaction.channel.id }, { spaces: 2 });

      await interaction.reply({ content: '✅ Manual enviado e fixado com sucesso.', ephemeral: true });
    } catch (err) {
      console.error('Erro ao fixar manual:', err);
      await interaction.reply({ content: '❌ Não foi possível fixar a mensagem. Verifique permissões.', ephemeral: true });
    }
  }
};
