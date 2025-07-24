const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
} = require("discord.js");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Gerencia seu XP (status, adicionar, remover)."),

  async execute(interaction) {
    const userId = interaction.user.id;

    const ativasPath = path.join(__dirname, "../fichas/ativas.json");
    const ativas = await fs.readJson(ativasPath).catch(() => ({}));
    const ativa = ativas[userId];

    if (!ativa) {
      return interaction.reply({
        content: "❌ Você ainda não selecionou uma ficha.",
        ephemeral: true,
      });
    }

    const fichaPath = path.join(
      __dirname,
      "../fichas",
      ativa.mecanica,
      userId,
      ativa.arquivo
    );
    if (!fs.existsSync(fichaPath)) {
      return interaction.reply({
        content: "❌ Ficha ativa não encontrada.",
        ephemeral: true,
      });
    }

    const ficha = await fs.readJson(fichaPath);
    const mecPath = path.join(
      __dirname,
      "..",
      "mechanics",
      ativa.mecanica,
      "index.js"
    );
    const mec = require(mecPath);
    const xpTable = mec.experienciaPorNivel || {};
    const nivelAtual = ficha.nivel || 1;

    ficha.xp = ficha.xp ?? xpTable[nivelAtual] ?? 0;

    const select = new StringSelectMenuBuilder()
      .setCustomId("xp_menu")
      .setPlaceholder("O que deseja fazer com o XP?")
      .addOptions(
        {
          label: "📊 Ver status",
          value: "status",
          description: "Mostra seu XP atual e quanto falta pro próximo nível",
        },
        {
          label: "➕ Adicionar XP",
          value: "add",
          description: "Adiciona XP à ficha atual e sobe de nível se possível",
        },
        {
          label: "➖ Remover XP",
          value: "remove",
          description: "Remove XP da ficha atual",
        }
      );

    await interaction.reply({
      content: "Escolha uma opção para gerenciar seu XP:",
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true,
    });

    interaction.client.cachedXpFichas ??= {};
    interaction.client.cachedXpFichas[interaction.user.id] = {
      fichaPath,
      ficha,
      xpTable,
    };
  },

  async handleComponent(interaction) {
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "xp_menu"
    ) {
      const opcao = interaction.values[0];
      const cache = interaction.client.cachedXpFichas?.[interaction.user.id];

      if (!cache) {
        return interaction.reply({
          content: "❌ Erro interno. Use /xp novamente.",
          ephemeral: true,
        });
      }

      const { ficha, fichaPath, xpTable } = cache;
      const nivel = ficha.nivel || 1;
      const xpAtual = ficha.xp ?? xpTable[nivel] ?? 0;
      const xpProximo = xpTable[nivel + 1] ?? xpAtual;

      if (opcao === "status") {
        const embed = new EmbedBuilder()
          .setTitle("📊 Seu XP")
          .setDescription(
            `Nível: **${nivel}**\nXP: **${xpAtual}/${xpProximo}**\nFaltam **${Math.max(
              xpProximo - xpAtual,
              0
            )} XP** para subir de nível.`
          )
          .setColor(0x00cc99);

        return interaction.update({
          embeds: [embed],
          components: [],
          ephemeral: true,
        });
      }

      // Modal para adicionar/remover XP
      const modal = new ModalBuilder()
        .setCustomId(`xp_modal_${opcao}`)
        .setTitle(`${opcao === "add" ? "➕ Adicionar" : "➖ Remover"} XP`);

      const input = new TextInputBuilder()
        .setCustomId("xp_input")
        .setLabel("Quantidade de XP")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 500")
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }

    // Processa modal de XP
    if (interaction.type === InteractionType.ModalSubmit) {
      const [_, __, modo] = interaction.customId.split("_");
      const cache = interaction.client.cachedXpFichas?.[interaction.user.id];

      if (!cache) {
        return interaction.reply({
          content: "❌ Algo deu errado. Tente novamente.",
          ephemeral: true,
        });
      }

      const { ficha, fichaPath, xpTable } = cache;
      const nivel = ficha.nivel || 1;
      const xpAtual = ficha.xp ?? xpTable[nivel] ?? 0;

      const input = interaction.fields.getTextInputValue("xp_input");
      let valor = parseInt(input.trim());
      if (isNaN(valor)) {
        return interaction.reply({
          content: "❌ Valor inválido.",
          ephemeral: true,
        });
      }

      if (modo === "remove") valor *= -1;

      ficha.xp = xpAtual + valor;
      const log = [`${valor >= 0 ? "+" : ""}${valor} XP`];

      // Nivelamento
      while (ficha.nivel < 20 && ficha.xp >= xpTable[ficha.nivel + 1]) {
        ficha.nivel++;
        log.push(`🎉 Subiu para nível ${ficha.nivel}!`);
      }

      while (ficha.nivel > 1 && ficha.xp < xpTable[ficha.nivel]) {
        ficha.nivel--;
        log.push(`⬇️ Caiu para nível ${ficha.nivel}!`);
      }

      if (ficha.nivel === 20 && ficha.xp > xpTable[20]) {
        ficha.xp = xpTable[20];
      }

      await fs.writeJson(fichaPath, ficha, { spaces: 2 });

      const embed = new EmbedBuilder()
        .setTitle("✨ XP Atualizado")
        .setDescription(
          log.join("\n") +
            `\n\nNível: **${ficha.nivel}**\nXP: **${ficha.xp}/${
              xpTable[ficha.nivel + 1] || ficha.xp
            }**`
        )
        .setColor(0x00cc99);

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
