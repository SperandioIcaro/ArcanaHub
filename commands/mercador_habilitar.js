// commands/mercador_habilitar.js
const { SlashCommandBuilder } = require('discord.js');
const fs   = require('fs-extra');
const path = require('path');

const slugify = txt => txt.toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^\w\s-]/g,'')
  .trim().replace(/\s+/g,'-');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mercador-habilitar')
    .setDescription('Mestre: ativa ou desativa um mercador')
    .addStringOption(opt =>
      opt.setName('mercador')
         .setDescription('Nome do mercador')
         .setRequired(true)
         .setAutocomplete(true)
    )
    .addBooleanOption(opt =>
      opt.setName('ativo')
         .setDescription('true para abrir loja, false para fechar')
         .setRequired(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();

    const historia = interaction.channel.parent?.name;
    if (!historia) return interaction.respond([]);

    const mecanica = (historia.match(/\[(.*?)\]/)?.[1] || historia).toLowerCase();
    const slugHist = slugify(historia);
    const dir = path.join(__dirname, '..', 'fichas', mecanica, 'mercadores', slugHist);
    if (!await fs.pathExists(dir)) return interaction.respond([]);

    const arquivos = await fs.readdir(dir);
    const sugest = [];

    for (const file of arquivos) {
      if (!file.endsWith('.json')) continue;
      const json = await fs.readJson(path.join(dir, file)).catch(() => null);
      if (!json || !json.nome) continue;
      if (json.nome.toLowerCase().includes(focused)) {
        sugest.push({ name: json.nome, value: json.nome });
      }
    }

    return interaction.respond(sugest.slice(0, 25));
  },


  async execute(interaction) {
    if (interaction.channel.name !== 'npcs-mobs')
      return interaction.reply({ content: '❌ Use apenas em #npcs-mobs.', ephemeral: true });

    const historia = interaction.channel.parent?.name;
    if (!historia) return interaction.reply({ content: '❌ Sem categoria de história.', ephemeral: true });
    const mecanica = (historia.match(/\[(.*?)\]/)?.[1] || historia).toLowerCase();

    const nomeMerc = interaction.options.getString('mercador');
    const ativo    = interaction.options.getBoolean('ativo');
    const slugHist = slugify(historia);
    const slugMerc = slugify(nomeMerc);
    const mercPath = path.join(__dirname, '..', 'fichas', mecanica, 'mercadores', slugHist, `${slugMerc}.json`);

    if (!await fs.pathExists(mercPath)) {
      return interaction.reply({ content: `❌ Mercador **${nomeMerc}** não encontrado.`, ephemeral: true });
    }

    const merc = await fs.readJson(mercPath);
    merc.ativo = ativo;
    await fs.writeJson(mercPath, merc, { spaces: 2 });

    return interaction.reply({
      content: `✅ Mercador **${nomeMerc}** agora está **${ativo ? 'ATIVO' : 'INATIVO'}**.`,
      ephemeral: true
    });
  }
};
