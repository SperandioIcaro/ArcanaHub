// commands/mercador_criar.js
const { SlashCommandBuilder } = require('discord.js');
const fs   = require('fs-extra');
const path = require('path');

const slugify = text => text.toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\w\s-]/g, '')
  .trim().replace(/\s+/g, '-');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mercador-criar')
    .setDescription('Mestre: cria um novo mercador para esta história.')
    .addStringOption(opt =>
      opt.setName('nome')
        .setDescription('Nome do mercador (ex: Clóvis)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('descrição')
        .setDescription('Breve descrição/função (ex: "mercador da floresta")')
        .setRequired(true)
    ),

  async execute(interaction) {
    // só no canal npcs-mobs
    if (interaction.channel.name !== 'npcs-mobs') {
      return interaction.reply({ content: '❌ Este comando só funciona em #npcs-mobs.', ephemeral: true });
    }

    // pega história e mecânica
    const historia = interaction.channel.parent?.name;
    if (!historia) {
      return interaction.reply({ content: '❌ Canal sem categoria de história.', ephemeral: true });
    }
    const mecanica = (historia.match(/\[(.*?)\]/)?.[1] || historia).toLowerCase();

    // opções
    const mercadorNome = interaction.options.getString('nome');
    const mercadorDesc = interaction.options.getString('descrição');
    const slugHist     = slugify(historia);
    const slugNome     = slugify(mercadorNome);

    // caminhos
    const baseDir  = path.join(__dirname, '..', 'fichas', mecanica, 'mercadores', slugHist);
    const filePath = path.join(baseDir, `${slugNome}.json`);

    // não sobrescrever
    if (await fs.pathExists(filePath)) {
      return interaction.reply({ content: `❌ Já existe um mercador chamado **${mercadorNome}** nesta história.`, ephemeral: true });
    }

    // estrutura inicial
    const mercador = {
      nome: mercadorNome,
      descrição: mercadorDesc,
      ativo: false,
      itens: {}  // { "Adaga": { preco: 1, qtd: 5 }, ... }
    };

    await fs.ensureDir(baseDir);
    await fs.writeJson(filePath, mercador, { spaces: 2 });

    return interaction.reply({
      content: `✅ Mercador **${mercadorNome}** (_${mercadorDesc}_) criado para **${historia}**.`,
      ephemeral: true
    });
  }
};
