const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('man')
    .setDescription('Adiciona ou remove mana da sua ficha.')
    .addIntegerOption(opt =>
      opt.setName('quantidade')
        .setDescription('Quantidade de mana (ex: -5 ou 10)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const filePath = path.join(__dirname, `../fichas/${userId}.json`);

    if (!fs.existsSync(filePath)) {
      return await interaction.reply({ content: '❌ Você ainda não tem uma ficha.', ephemeral: true });
    }

    const ficha = await fs.readJson(filePath);
    const quantidade = interaction.options.getInteger('quantidade');

    ficha.mana = Math.min(ficha.mana_max, Math.max(0, ficha.mana + quantidade));

    await fs.writeJson(filePath, ficha, { spaces: 2 });

    const embed = new EmbedBuilder()
      .setTitle(`🔵 Mana atualizada`)
      .setDescription(`${quantidade >= 0 ? 'Ganhou' : 'Gastou'} **${Math.abs(quantidade)} de mana**.`)
      .addFields({ name: '🔷 Mana atual', value: `${ficha.mana} / ${ficha.mana_max}`, inline: true })
      .setColor(0x3366ff);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
