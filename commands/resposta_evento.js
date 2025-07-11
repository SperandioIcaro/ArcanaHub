const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resposta_evento')
    .setDescription('Responde ao mestre da sessão de forma privada.')
    .addStringOption(opt =>
      opt.setName('mensagem')
        .setDescription('Resposta privada ao mestre da sua sessão.')
        .setRequired(true)
    ),

  async execute(interaction) {
    const jogadorId = interaction.user.id;
    const resposta = interaction.options.getString('mensagem');

    // Verifica se a ficha existe
    const fichaPath = path.join(__dirname, `../fichas/${jogadorId}.json`);
    if (!fs.existsSync(fichaPath)) {
      return interaction.reply({ content: '❌ Você precisa ter uma ficha antes de responder ao mestre.', ephemeral: true });
    }

    const ficha = await fs.readJson(fichaPath);
    const mestreId = ficha.mestre;

    if (!mestreId) {
      return interaction.reply({ content: '❌ Nenhum mestre encontrado associado à sua ficha.', ephemeral: true });
    }

    try {
      const mestreUser = await interaction.client.users.fetch(mestreId);

      const embed = new EmbedBuilder()
        .setTitle('📬 Resposta secreta do jogador')
        .setDescription(resposta)
        .setColor(0x2ecc71)
        .setFooter({ text: `Jogador: ${interaction.user.username}` });

      await mestreUser.send({ embeds: [embed] });

      return interaction.reply({ content: '✅ Sua resposta foi enviada ao mestre com sucesso.', ephemeral: true });
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: '❌ Não foi possível enviar a resposta. O mestre pode estar offline ou com DMs desativadas.', ephemeral: true });
    }
  }
};
