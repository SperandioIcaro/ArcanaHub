const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm_evento')
    .setDescription('Envia um evento secreto para um jogador (apenas para mestres).')
    .addUserOption(opt =>
      opt.setName('jogador')
        .setDescription('Jogador alvo da mensagem')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('mensagem')
        .setDescription('Mensagem a ser enviada ao jogador')
        .setRequired(true)
    ),

  async execute(interaction) {
    const mestreId = interaction.user.id;
    const roleName = `mestre${mestreId}`;
    const mestreRole = interaction.guild.roles.cache.find(r => r.name === roleName);

    // Verifica se quem chamou o comando é realmente um mestre
    if (!mestreRole || !interaction.member.roles.cache.has(mestreRole.id)) {
      return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', ephemeral: true });
    }

    const jogador = interaction.options.getUser('jogador');
    const mensagem = interaction.options.getString('mensagem');

    try {
      const embed = new EmbedBuilder()
        .setTitle('📩 Evento secreto do mestre')
        .setDescription(mensagem)
        .setColor(0x8e44ad)
        .setFooter({ text: `Enviado por mestre ${interaction.user.username}` });

      await jogador.send({ embeds: [embed] });

      return interaction.reply({ content: `✅ Mensagem secreta enviada para ${jogador.username}.`, ephemeral: true });
    } catch (error) {
      console.error(error);
      return interaction.reply({ content: `❌ Não foi possível enviar a mensagem. O jogador pode ter o recebimento de DMs desativado.`, ephemeral: true });
    }
  }
};
