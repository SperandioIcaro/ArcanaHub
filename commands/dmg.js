const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dmg')
    .setDescription('Aplica dano à sua ficha de personagem.')
    .addIntegerOption(opt =>
      opt.setName('quantidade')
        .setDescription('Quantidade de dano sofrido')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const filePath = path.join(__dirname, `../fichas/${userId}.json`);

    if (!fs.existsSync(filePath)) {
      return await interaction.reply({ content: '❌ Você ainda não tem uma ficha.', ephemeral: true });
    }

    const ficha = await fs.readJson(filePath);
    const dano = interaction.options.getInteger('quantidade');
    ficha.vida = Math.max(0, ficha.vida - dano);

    await fs.writeJson(filePath, ficha, { spaces: 2 });

    const embed = new EmbedBuilder()
      .setTitle(`💥 Dano recebido!`)
      .setDescription(`Você sofreu **${dano} de dano**.`)
      .addFields({ name: '❤️ Vida atual', value: `${ficha.vida} / ${ficha.vida_max}`, inline: true })
      .setColor(0xff0000);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
