const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('equipar')
    .setDescription('Equipar ou desequipar itens.')
    .addStringOption(opt =>
      opt.setName('ação')
        .setDescription('equipar ou desequipar')
        .setRequired(true)
        .addChoices(
          { name: 'equipar', value: 'equipar' },
          { name: 'desequipar', value: 'desequipar' }
        )
    )
    .addStringOption(opt =>
      opt.setName('item')
        .setDescription('Nome do item (veja sugestões dinâmicas)')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt =>
      opt.setName('slot')
        .setDescription('Slot para equipar o item')
        .setRequired(true)
        .addChoices(
          { name: 'Arma Principal', value: 'arma_principal' },
          { name: 'Arma Secundária', value: 'arma_secundaria' },
          { name: 'Armadura', value: 'armadura' },
          { name: 'Outros', value: 'outros' }
        )
    ),

  async autocomplete(interaction) {
    const userId = interaction.user.id;
    const focused = interaction.options.getFocused();
    const action = interaction.options.getString('ação');

    const ativasPath = path.join(__dirname, '../fichas/ativas.json');
    const ativas = await fs.readJson(ativasPath).catch(() => ({}));
    const ativa = ativas[userId];
    if (!ativa) return interaction.respond([]);

    const filePath = path.join(__dirname, '../fichas', ativa.mecanica, userId, ativa.arquivo);
    const ficha = await fs.readJson(filePath).catch(() => null);
    if (!ficha) return interaction.respond([]);

    ficha.inventario = ficha.inventario || ficha.equipamentos || [];
    delete ficha.equipamentos;

    ficha.equipados = ficha.equipados || {
      arma_principal: null,
      arma_secundaria: null,
      armadura: null,
      outros: []
    };

    let itens = [];

    if (action === 'equipar') {
      itens = ficha.inventario;
    } else if (action === 'desequipar') {
      itens = [
        ficha.equipados.arma_principal,
        ficha.equipados.arma_secundaria,
        ficha.equipados.armadura,
        ...(ficha.equipados.outros || [])
      ].filter(Boolean);
    }

    const sugestões = itens
      .filter(i => i.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25)
      .map(i => ({ name: i, value: i }));

    return interaction.respond(sugestões);
  },

  async execute(interaction) {
    const userId = interaction.user.id;

    const ativasPath = path.join(__dirname, '../fichas/ativas.json');
    const ativas = await fs.readJson(ativasPath).catch(() => ({}));
    const ativa = ativas[userId];

    if (!ativa) {
      return interaction.reply({ content: '❌ Você ainda não selecionou uma ficha.', ephemeral: true });
    }

    const filePath = path.join(__dirname, '../fichas', ativa.mecanica, userId, ativa.arquivo);
    if (!await fs.pathExists(filePath)) {
      return interaction.reply({ content: '❌ A ficha ativa não foi encontrada.', ephemeral: true });
    }

    const ficha = await fs.readJson(filePath);
    const ação = interaction.options.getString('ação');
    const item = interaction.options.getString('item');
    const slot = interaction.options.getString('slot');

    ficha.inventario = ficha.inventario || ficha.equipamentos || [];
    delete ficha.equipamentos;

    ficha.equipados = ficha.equipados || {
      arma_principal: null,
      arma_secundaria: null,
      armadura: null,
      outros: []
    };

    if (ação === 'equipar') {
      const itemIndex = ficha.inventario.findIndex(i => i.toLowerCase() === item.toLowerCase());
      if (itemIndex === -1) {
        return interaction.reply({ content: `❌ Você não tem **${item}** no inventário.`, ephemeral: true });
      }

      // Slot já ocupado?
      if (slot !== 'outros' && ficha.equipados[slot]) {
        return interaction.reply({
          content: `⚠️ O slot **${slot.replace('_', ' ')}** já está ocupado com **${ficha.equipados[slot]}**.\nDeseja substituir?`,
          ephemeral: true
        });
      }

      // Slot arma principal sem perícia
      if (
        slot === 'arma_principal' &&
        ficha.equipados.arma_principal &&
        !ficha.pericias_autom?.includes('Combater com Duas Armas')
      ) {
        return interaction.reply({
          content: `⚠️ Você já está empunhando uma arma principal (**${ficha.equipados.arma_principal}**) e **não possui a perícia "Combater com Duas Armas"**.\nDeseja substituir a arma equipada?`,
          ephemeral: true
        });
      }

      ficha.inventario.splice(itemIndex, 1);

      if (['arma_principal', 'arma_secundaria', 'armadura'].includes(slot)) {
        ficha.equipados[slot] = item;
      } else {
        ficha.equipados.outros.push(item);
      }

      // Ajustes de bônus de armadura
      if (slot === 'armadura') {
        const bonus = parseInt(item.match(/\+(\d+)/)?.[1]) || 0;
        const tipo = item.toLowerCase().includes('vida') ? 'vida' : 'armadura';

        if (tipo === 'vida') {
          ficha.vida_max = (ficha.vida_max || ficha.vida || 0) + bonus;
          ficha.vida = Math.min(ficha.vida || 0, ficha.vida_max);
        } else {
          ficha.armadura = 10 + Math.floor((ficha.atributos.DES - 10) / 2) + bonus;
        }
      }

      await fs.writeJson(filePath, ficha, { spaces: 2 });
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🛡️ Equipado')
          .setDescription(`Você equipou **${item}** no slot **${slot.replace('_', ' ')}**.`)
          .setColor('Green')],
        ephemeral: true
      });
    }

    // Desequipar
    let removed = false;
    ['arma_principal', 'arma_secundaria', 'armadura'].forEach(s => {
      if (ficha.equipados[s]?.toLowerCase() === item.toLowerCase()) {
        // remove bônus se for armadura
        if (s === 'armadura') {
          const bonus = parseInt(item.match(/\+(\d+)/)?.[1]) || 0;
          const tipo = item.toLowerCase().includes('vida') ? 'vida' : 'armadura';

          if (tipo === 'vida') {
            ficha.vida_max = Math.max((ficha.vida_max || 0) - bonus, 1);
            ficha.vida = Math.min(ficha.vida, ficha.vida_max);
          } else {
            ficha.armadura = 10 + Math.floor((ficha.atributos.DES - 10) / 2);
          }
        }

        ficha.equipados[s] = null;
        removed = true;
      }
    });

    if (!removed) {
      const idx = ficha.equipados.outros.findIndex(i => i.toLowerCase() === item.toLowerCase());
      if (idx !== -1) {
        ficha.equipados.outros.splice(idx, 1);
        removed = true;
      }
    }

    if (!removed) {
      return interaction.reply({ content: `❌ **${item}** não está equipado.`, ephemeral: true });
    }

    ficha.inventario.push(item);
    await fs.writeJson(filePath, ficha, { spaces: 2 });

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle('📤 Desequipado')
        .setDescription(`Você desequipou **${item}**.`)
        .setColor('Orange')],
      ephemeral: true
    });
  }
};
