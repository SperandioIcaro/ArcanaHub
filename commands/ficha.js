const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ficha')
    .setDescription('Exibe a sua ficha de personagem.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const fichaPath = path.join(__dirname, `../fichas/${userId}.json`);

    if (!fs.existsSync(fichaPath)) {
      return await interaction.reply({
        content: '❌ Você ainda não tem uma ficha. Use `/criar_ficha` para criar a sua.',
        ephemeral: true
      });
    }

    try {
      const ficha = await fs.readJson(fichaPath);

      const embed = new EmbedBuilder()
        .setTitle(`🧙 Ficha de ${ficha.nome}`)
        .setDescription(`**Classe:** ${ficha.classe}\n**Raça:** ${ficha.raca}\n**Antecedente:** ${ficha.antecedentes}`)
        .addFields(
          { name: '📈 Nível / XP', value: `Nível: ${ficha.nivel} | XP: ${ficha.xp} / ${ficha.xp_next}`, inline: true },
          { name: '❤️ Vida', value: `${ficha.vida} / ${ficha.vida_max}`, inline: true },
          { name: '🔵 Mana', value: `${ficha.mana} / ${ficha.mana_max}`, inline: true },
          { name: '🛡️ CA', value: `${ficha.ca}`, inline: true },
          { name: '🎲 Dado de Vida', value: ficha.dado_vida, inline: true },
          {
            name: '⚙️ Atributos',
            value: Object.entries(ficha.atributos)
              .map(([key, val]) => `**${key}**: ${val}`)
              .join(' | '),
            inline: false
          },
          {
            name: '🎯 Perícias',
            value: ficha.pericias.join(', ') || 'Nenhuma',
            inline: false
          },
          {
            name: '✨ Habilidades',
            value: ficha.habilidades.join(', ') || 'Nenhuma',
            inline: false
          },
          {
            name: '🎒 Inventário',
            value: ficha.inventario.join(', ') || 'Vazio',
            inline: false
          },
          {
            name: '⚔️ Equipamento',
            value: ficha.equipamento.join(', ') || 'Nada equipado',
            inline: false
          }
        )
        .setThumbnail(ficha.imagem)
        .setColor(0x0099ff)
        .setFooter({ text: `Jogador: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (err) {
      console.error(err);
      await interaction.reply({
        content: '❌ Erro ao carregar sua ficha.',
        ephemeral: true
      });
    }
  }
};
