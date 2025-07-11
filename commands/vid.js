const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vid')
    .setDescription('Recupera vida da sua ficha de personagem.')
    .addIntegerOption(opt =>
      opt.setName('quantidade')
        .setDescription('Quantidade de vida curada')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const filePath = path.join(__dirname, `../fichas/${userId}.json`);

    if (!fs.existsSync(filePath)) {
      return await interaction.reply({ content: '❌ Você ainda não tem uma ficha.', ephemeral: true });
    }

    const ficha = await fs.readJson(filePath);
    const cura = interaction.options.getInteger('quantidade');
    ficha.vida = Math.min(ficha.vida_max, ficha.vida + cura);

    await fs.writeJson(filePath, ficha, { spaces: 2 });

    const embed = new EmbedBuilder()
      .setTitle(`💚 Vida restaurada!`)
      .setDescription(`Você recuperou **${cura} de vida**.`)
      .addFields({ name: '❤️ Vida atual', value: `${ficha.vida} / ${ficha.vida_max}`, inline: true })
      .setColor(0x00ff00);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
