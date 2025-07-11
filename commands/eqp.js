const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eqp')
    .setDescription('Equipa um item da mochila.')
    .addStringOption(opt =>
      opt.setName('item')
        .setDescription('Nome do item a equipar')
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
    if (!ficha.equipado || !Array.isArray(ficha.equipado)) ficha.equipado = [];

    const index = ficha.itens.findIndex(i => i.toLowerCase() === item.toLowerCase());
    if (index === -1) {
      return interaction.reply({ content: `❌ Item **${item}** não encontrado na mochila.`, ephemeral: true });
    }

    ficha.itens.splice(index, 1); // remove da mochila
    ficha.equipado.push(item);   // adiciona como equipado

    await fs.writeJson(filePath, ficha, { spaces: 2 });

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ Item equipado`)
      .setDescription(`Você equipou **${item}**.`)
      .setColor(0x3399ff);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
