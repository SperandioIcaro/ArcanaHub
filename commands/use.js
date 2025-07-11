const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Usa um item da sua mochila.')
    .addStringOption(opt =>
      opt.setName('item')
        .setDescription('Nome do item a ser usado')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const filePath = path.join(__dirname, `../fichas/${userId}.json`);
    const item = interaction.options.getString('item');

    if (!fs.existsSync(filePath)) {
      return interaction.reply({ content: '❌ Você ainda não tem uma ficha.', ephemeral: true });
    }

    const ficha = await fs.readJson(filePath);
    if (!ficha.itens || !Array.isArray(ficha.itens)) ficha.itens = [];

    const index = ficha.itens.findIndex(i => i.toLowerCase() === item.toLowerCase());
    if (index === -1) {
      return interaction.reply({ content: `❌ Item **${item}** não encontrado na mochila.`, ephemeral: true });
    }

    ficha.itens.splice(index, 1); // remove o item usado
    await fs.writeJson(filePath, ficha, { spaces: 2 });

    const embed = new EmbedBuilder()
      .setTitle(`🎒 Item usado`)
      .setDescription(`Você usou **${item}**.`)
      .setColor(0x00ffff);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
