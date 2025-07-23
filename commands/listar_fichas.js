const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listar_fichas')
    .setDescription('Lista todas as fichas registradas nesta história (canal/categoria).'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const historia = interaction.channel.parent?.name;
    if (!historia) return interaction.editReply('❌ Não foi possível identificar a história (categoria).');

    const baseFichas = path.join(__dirname, '..', 'fichas');
    if (!await fs.pathExists(baseFichas)) {
      return interaction.editReply('❌ Nenhuma ficha registrada até o momento.');
    }

    const isMestre = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
    const fichas = [];

    const mecanicas = await fs.readdir(baseFichas);
    for (const mecanica of mecanicas) {
      const mecanicaDir = path.join(baseFichas, mecanica);
      const jogadores = await fs.readdir(mecanicaDir).catch(() => []);

      for (const jogadorId of jogadores) {
        const jogadorPath = path.join(mecanicaDir, jogadorId);
        const arquivos = await fs.readdir(jogadorPath).catch(() => []);

        for (const arquivo of arquivos) {
          if (!arquivo.endsWith('.json')) continue;

          try {
            const ficha = await fs.readJson(path.join(jogadorPath, arquivo));

            // Apenas fichas da história atual
            if (ficha.historia !== historia) continue;

            const status = ficha.vida !== undefined && ficha.vida <= 0 ? '🪦 Morto' : '💚 Vivo';
            if (isMestre || ficha.autor === interaction.user.id) {
              const sub = ficha.subraca && ficha.subraca !== 'Nenhuma' ? ` (${ficha.subraca})` : '';
              const linha = `• **${ficha.nome}** - ${ficha.raca || '?'}${sub} - ${ficha.classe || '?'} Nível ${ficha.nivel || '?'} - ${status}${isMestre ? ` - <@${ficha.autor}>` : ''}`;
              fichas.push(linha);
            }
          } catch (err) {
            console.warn(`Erro ao ler ficha ${arquivo}:`, err);
          }
        }
      }
    }

    if (fichas.length === 0) {
      return interaction.editReply('❌ Nenhuma ficha encontrada nesta história.');
    }

    return interaction.editReply({
      content: `📜 **Fichas nesta história:**\n\n${fichas.join('\n')}`,
      ephemeral: true
    });
  }
};
