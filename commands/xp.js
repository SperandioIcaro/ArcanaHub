const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

// Tabela de XP baseada no Tormenta 20
const xpTable = [
  0,     // Nível 1
  1000,  // Nível 2
  3000,  // Nível 3
  6000,  // Nível 4
  10000, // Nível 5
  15000, // Nível 6
  21000, // Nível 7
  28000, // Nível 8
  36000, // Nível 9
  45000, // Nível 10
  55000, // Nível 11
  66000, // Nível 12
  78000, // Nível 13
  91000, // Nível 14
  105000 // Nível 15
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Adiciona XP à sua ficha com progressão automática de nível.')
    .addIntegerOption(opt =>
      opt.setName('quantidade')
        .setDescription('Quantidade de XP a adicionar')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const filePath = path.join(__dirname, `../fichas/${userId}.json`);

    if (!fs.existsSync(filePath)) {
      return await interaction.reply({ content: '❌ Você ainda não tem uma ficha.', ephemeral: true });
    }

    const ficha = await fs.readJson(filePath);
    const xpGanho = interaction.options.getInteger('quantidade');

    ficha.xp += xpGanho;

    let novoNivel = ficha.nivel;
    let mensagensNivel = [];

    // Verifica o novo nível com base na tabela
    for (let i = xpTable.length - 1; i >= 0; i--) {
      if (ficha.xp >= xpTable[i]) {
        novoNivel = i + 1;
        break;
      }
    }

    // Se subiu de nível
    if (novoNivel > ficha.nivel) {
      mensagensNivel.push(`⬆️ Você subiu para o nível **${novoNivel}**!`);

      // Tormenta 20: a cada 4 níveis, +1 em dois atributos diferentes
      const ganhosAtributos = Math.floor(novoNivel / 4) - Math.floor(ficha.nivel / 4);
      if (ganhosAtributos > 0) {
        const atributos = Object.keys(ficha.atributos);
        for (let i = 0; i < ganhosAtributos * 2; i++) {
          const atrIndex = i % atributos.length;
          ficha.atributos[atributos[atrIndex]] += 1;
        }
        mensagensNivel.push(`🎁 Você ganhou **+1 em dois atributos** por cada 4 níveis.`);
      }

      ficha.nivel = novoNivel;
    }

    ficha.xp_next = xpTable[ficha.nivel] || ficha.xp + 10000; // se estiver além da tabela

    await fs.writeJson(filePath, ficha, { spaces: 2 });

    const embed = new EmbedBuilder()
      .setTitle('🌟 XP Adicionado')
      .setDescription(`Você ganhou **${xpGanho} XP**.`)
      .addFields(
        { name: '🧙 Nível Atual', value: `${ficha.nivel}`, inline: true },
        { name: '📈 XP Total', value: `${ficha.xp} / ${ficha.xp_next}`, inline: true }
      )
      .setColor(0xffff00);

    if (mensagensNivel.length > 0) {
      embed.addFields({ name: '🎉 Progressão', value: mensagensNivel.join('\n') });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
