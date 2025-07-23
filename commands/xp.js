// commands/xp.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Gerencia seu XP e sobe de nível automaticamente.')
    .addSubcommand(sub =>
      sub
        .setName('mostrar')
        .setDescription('Mostra seu XP atual e quanto falta para o próximo nível.')
    )
    .addSubcommand(sub =>
      sub
        .setName('adicionar')
        .setDescription('Adiciona XP e sobe de nível quando atingir o limite.')
        .addIntegerOption(opt =>
          opt
            .setName('quantidade')
            .setDescription('XP a adicionar (deve ser positivo).')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;

    // 1️⃣ Descobre qual ficha está ativa
    const ativasPath = path.join(__dirname, '../fichas/ativas.json');
    const ativas = await fs.readJson(ativasPath).catch(() => ({}));
    const ativa = ativas[userId];
    if (!ativa) {
      return interaction.reply({ content: '❌ Você ainda não selecionou uma ficha.', ephemeral: true });
    }

    // 2️⃣ Carrega a ficha do usuário
    const fichaPath = path.join(
      __dirname,
      '../fichas',
      ativa.mecanica,
      userId,
      ativa.arquivo
    );
    if (!await fs.pathExists(fichaPath)) {
      return interaction.reply({ content: '❌ Ficha ativa não encontrada.', ephemeral: true });
    }
    const ficha = await fs.readJson(fichaPath);

    // 3️⃣ Carrega a mecânica (pra pegar a tabela de XP)
    const mecPath = path.join(__dirname, '..', 'mechanics', ativa.mecanica, 'index.js');
    const mec = require(mecPath);
    const xpTable = mec.experienciaPorNivel || {};

    const sub = interaction.options.getSubcommand();

    if (sub === 'mostrar') {
      // apenas exibe
      const embed = new EmbedBuilder()
        .setTitle('📊 Seu XP')
        .setDescription(
          `Nível **${ficha.nivel}**\n` +
          `XP: **${ficha.xp}/${ficha.xp_max}**\n` +
          `Faltam **${Math.max(ficha.xp_max - ficha.xp, 0)}** para o próximo nível`
        )
        .setColor(0x00cc99);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // sub === 'adicionar'
    let gain = interaction.options.getInteger('quantidade');
    if (gain <= 0) {
      return interaction.reply({ content: '❌ A quantidade deve ser positiva.', ephemeral: true });
    }

    const log = [];
    ficha.xp += gain;
    log.push(`+${gain} XP`);

    // enquanto bater no limite, sobe de nível
    while (ficha.nivel < 20 && ficha.xp >= ficha.xp_max) {
      ficha.nivel++;
      log.push(`🎉 Subiu para nível ${ficha.nivel}!`);
      // novo xp_max é o threshold para o próximo nível
      ficha.xp_max = xpTable[ficha.nivel] ?? ficha.xp_max;
    }

    // se já chegou no 20, não deixa ultrapassar
    if (ficha.nivel === 20 && ficha.xp > ficha.xp_max) {
      ficha.xp = ficha.xp_max;
    }

    // salva de volta
    await fs.writeJson(fichaPath, ficha, { spaces: 2 });

    // monta embed final
    const embed = new EmbedBuilder()
      .setTitle('✨ XP Atualizado')
      .setDescription(
        log.join('\n') +
        `\n\nNível: **${ficha.nivel}**\n` +
        `XP: **${ficha.xp}/${ficha.xp_max}**`
      )
      .setColor(0x00cc99);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
