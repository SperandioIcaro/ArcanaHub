const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unq')
    .setDescription('Desequipa um item.')
    .addStringOption(opt =>
      opt.setName('item')
        .setDescription('Nome do item a desequipar')
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
    if (!ficha.equipado || !Array.isArray(ficha.equipado)) ficha.equipado = [];
    if (!ficha.itens || !Array.isArray(ficha.itens)) ficha.itens = [];

    const index = ficha.equipado.findIndex(i => i.toLowerCase() === item.toLowerCase());
    if (index === -1) {
      return interaction.reply({ content: `❌ Item **${item}** não está equipado.`, ephemeral: true });
    }

    ficha.equipado.splice(index, 1); // remove dos equipados
    ficha.itens.push(item);          // volta para a mochila

    await fs.writeJson(filePath, ficha, { spaces: 2 });

    const embed = new EmbedBuilder()
      .setTitle(`📤 Item desequipado`)
      .setDescription(`Você removeu **${item}**.`)
      .setColor(0xff9933);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
