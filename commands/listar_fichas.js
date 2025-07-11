const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listar_fichas')
    .setDescription('Lista todas as fichas registradas nesta história (canal/categoria).'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const fichasDir = path.join(__dirname, '../fichas');
    if (!await fs.pathExists(fichasDir)) {
      return interaction.editReply('Nenhuma ficha encontrada.');
    }

    const isMestre = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
    const currentCategory = interaction.channel.parentId;
    const fichas = [];

    const pastas = await fs.readdir(fichasDir);
    for (const pasta of pastas) {
      const pastaPath = path.join(fichasDir, pasta);
      if (!(await fs.stat(pastaPath)).isDirectory()) continue;

      const arquivos = await fs.readdir(pastaPath);
      for (const arquivo of arquivos) {
        if (!arquivo.endsWith('.json')) continue;

        try {
          const ficha = await fs.readJson(path.join(pastaPath, arquivo));
          // só considerar fichas desta categoria
          if (ficha.historia !== interaction.channel.parent?.name) continue;

          const status = ficha.vida <= 0 ? '🪦 Morto' : '💚 Vivo';
          if (isMestre || ficha.autor === interaction.user.id) {
            const linha = `• **${ficha.nome}** - ${ficha.raca}${ficha.subraca && ficha.subraca !== 'Nenhuma' ? ` (${ficha.subraca})` : ''} - ${ficha.classe} Nível ${ficha.nivel} - ${status}${isMestre ? ` - <@${ficha.autor}>` : ''}`;
            fichas.push(linha);
          }
        } catch (err) {
          console.warn(`❗ Erro ao ler ficha em ${arquivo}:`, err);
        }
      }
    }

    if (fichas.length === 0) {
      return interaction.editReply('Nenhuma ficha encontrada nesta história.');
    }

    return interaction.editReply({
      content: `📜 **Fichas nesta história:**\n\n${fichas.join('\n')}`,
      ephemeral: true
    });
  }
};
