const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ver_ficha')
    .setDescription('Visualiza uma das fichas de um jogador (somente mestres).')
    .addUserOption(opt =>
      opt.setName('jogador')
        .setDescription('Jogador cuja ficha será visualizada')
        .setRequired(true)
    ),

  async execute(interaction) {
    const mestreId = interaction.user.id;
    const roleName = `mestre${mestreId}`;
    const mestreRole = interaction.guild.roles.cache.find(r => r.name === roleName);

    if (!mestreRole || !interaction.member.roles.cache.has(mestreRole.id)) {
      return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', ephemeral: true });
    }

    const alvo = interaction.options.getUser('jogador');
    const dir = path.join(__dirname, `../fichas/${alvo.id}`);

    if (!fs.existsSync(dir)) {
      return interaction.reply({ content: '❌ Este jogador ainda não tem nenhuma ficha criada.', ephemeral: true });
    }

    const arquivos = await fs.readdir(dir);
    const opcoes = arquivos.filter(f => f.endsWith('.json')).map(f => {
      const nomeFicha = path.basename(f, '.json').replace(/-/g, ' ');
      return {
        label: nomeFicha.charAt(0).toUpperCase() + nomeFicha.slice(1),
        value: f
      };
    });

    if (opcoes.length === 0) {
      return interaction.reply({ content: '❌ Este jogador não possui fichas salvas.', ephemeral: true });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`ver_ficha_selecionar:${alvo.id}`)
      .setPlaceholder('Selecione a ficha para visualizar')
      .addOptions(opcoes);

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({
      content: `👤 Fichas de **${alvo.username}**:
Selecione uma para visualizar abaixo:`,
      components: [row],
      ephemeral: true
    });
  },

  async handleComponent(interaction) {
    if (!interaction.isStringSelectMenu()) return;

    const [base, jogadorId] = interaction.customId.split(':');
    if (base !== 'ver_ficha_selecionar') return;

    const mestreId = interaction.user.id;
    const roleName = `mestre${mestreId}`;
    const mestreRole = interaction.guild.roles.cache.find(r => r.name === roleName);

    if (!mestreRole || !interaction.member.roles.cache.has(mestreRole.id)) {
      return interaction.reply({ content: '❌ Você não tem permissão para visualizar essa ficha.', ephemeral: true });
    }

    const fichaSelecionada = interaction.values[0];
    const fichaPath = path.join(__dirname, `../fichas/${jogadorId}/${fichaSelecionada}`);

    if (!fs.existsSync(fichaPath)) {
      return interaction.update({ content: '❌ Esta ficha não existe mais.', components: [], ephemeral: true });
    }

    const ficha = await fs.readJson(fichaPath);
    const embed = new EmbedBuilder()
      .setTitle(`📜 Ficha de ${ficha.nome}`)
      .setThumbnail(ficha.imagem || null)
      .setColor(0x964b00)
      .addFields(
        { name: '🎭 Classe', value: ficha.classe, inline: true },
        { name: '🧬 Raça', value: ficha.raca, inline: true },
        { name: '📖 Origem', value: ficha.origem, inline: true },
        { name: '🧙 Nível', value: ficha.nivel.toString(), inline: true },
        { name: '⭐ XP', value: `${ficha.xp || 0} / ${ficha.xp_next || '??'}`, inline: true },
        { name: '❤️ Vida', value: `${ficha.vida_atual || '?'} / ${ficha.vida_max || '?'}`, inline: true },
        { name: '🔵 Mana', value: `${ficha.mana_atual || 0}/${ficha.mana_max || 0}`, inline: true },
        { name: '🛡️ CA', value: ficha.ca?.toString() || '?', inline: true },
        { name: '🎲 Dados de Vida', value: ficha.dados_vida || 'N/A', inline: true },
        { name: '🎒 Itens', value: (ficha.itens || []).join(', ') || 'Nenhum', inline: false },
        { name: '🧰 Equipado', value: (ficha.equipado || []).join(', ') || 'Nada equipado', inline: false },
        { name: '🧠 Atributos', value: Object.entries(ficha.atributos || {}).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(' | ') || 'N/A', inline: false },
        { name: '📚 Perícias', value: (ficha.pericias || []).join(', ') || 'Nenhuma', inline: false },
        { name: '✨ Habilidades', value: (ficha.habilidades || []).join(', ') || 'Nenhuma', inline: false }
      )
      .setFooter({ text: `Visualizado por mestre ${interaction.user.username}` });

    await interaction.update({ content: '', embeds: [embed], components: [], ephemeral: true });
  }
};
