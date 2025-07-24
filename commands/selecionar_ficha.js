const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} = require("discord.js");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("selecionar_ficha")
    .setDescription("Seleciona e ativa uma ficha para você nesta história."),

  async execute(interaction) {
    const userId = interaction.user.id;
    const historia = interaction.channel.parent?.name;
    if (!historia) {
      return interaction.reply({
        content: "❌ Comando válido apenas dentro de uma história (categoria).",
        ephemeral: true,
      });
    }

    // Determinar a mecânica pela pasta base
    const mecanica = (
      historia.match(/\[(.*?)\]/)?.[1] || historia
    ).toLowerCase();
    const baseDir = path.join(__dirname, "../fichas", mecanica, userId);

    if (!(await fs.pathExists(baseDir))) {
      return interaction.reply({
        content: "❌ Você não possui fichas nesta história.",
        ephemeral: true,
      });
    }

    const arquivos = await fs.readdir(baseDir);
    const options = [];
    for (const arquivo of arquivos) {
      if (!arquivo.endsWith(".json")) continue;
      const ficha = await fs.readJson(path.join(baseDir, arquivo));
      if (ficha.historia === historia) {
        options.push({
          label: `${ficha.nome} (Nv ${ficha.nivel})`,
          value: arquivo,
        });
      }
    }

    if (options.length === 0) {
      return interaction.reply({
        content: "❌ Nenhuma ficha encontrada nesta história.",
        ephemeral: true,
      });
    }

    // Lê ficha ativa atual (opcional)
    const ativasPath = path.join(__dirname, "../fichas", "ativas.json");
    const ativas = await fs.readJson(ativasPath).catch(() => ({}));
    const ativa = ativas[userId];

    const header = ativa
      ? `🔸 Ficha ativa atual: **${ativa.nome || ativa}**\n`
      : "";

    const select = new StringSelectMenuBuilder()
      .setCustomId(`selecionar_ficha:${mecanica}`)
      .setPlaceholder("Selecione uma ficha...")
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);

    return interaction.reply({
      content: `${header}🎯 Selecione sua ficha para esta história:`,
      components: [row],
      ephemeral: true,
    });
  },

  async handleComponent(interaction) {
    if (
      !interaction.isStringSelectMenu() ||
      !interaction.customId.startsWith("selecionar_ficha:")
    )
      return;

    const userId = interaction.user.id;
    const historia = interaction.channel.parent?.name;
    const mecanica = interaction.customId.split(":")[1];
    const fichasDir = path.join(__dirname, "../fichas", mecanica, userId);
    const arquivo = interaction.values[0];
    const fichaPath = path.join(fichasDir, arquivo);

    const ficha = await fs.readJson(fichaPath);
    if (ficha.historia !== historia) {
      return interaction.update({
        content: "❌ Essa ficha não pertence à história atual.",
        components: [],
        ephemeral: true,
      });
    }

    // Atualiza ficha ativa com nome, mecanica, arquivo e historia
    const ativasPath = path.join(__dirname, "../fichas", "ativas.json");
    const ativas = await fs.readJson(ativasPath).catch(() => ({}));
    ativas[userId] = {
      nome: ficha.nome,
      mecanica,
      arquivo,
      historia,
    };
    await fs.writeJson(ativasPath, ativas, { spaces: 2 });

    // Cria embed estilo cartão
    // Cria embed estilo cartão
    const embed = new EmbedBuilder()
      .setTitle(`🪪 ${ficha.nome}`)
      .setThumbnail(ficha.imagem || null)
      .setColor(0x964b00)
      .addFields(
        {
          name: "🎭 Classe",
          value: ficha.classe || "?",
          inline: true,
        },
        {
          name: "🧬 Raça",
          value: ficha.selecoes?.raca
            ? `${ficha.selecoes.raca}${
                ficha.selecoes.subraca && ficha.selecoes.subraca !== "Nenhuma"
                  ? ` (${ficha.selecoes.subraca})`
                  : ""
              }`
            : "?",
          inline: true,
        },
        {
          name: "🧙 Nível",
          value: ficha.nivel?.toString() || "?",
          inline: true,
        },
        {
          name: "❤️ Vida",
          value: `${ficha.vida_atual ?? "?"} / ${ficha.vida_max ?? "?"}`,
          inline: true,
        },
        {
          name: "💧 Mana",
          value: `${ficha.mana_atual ?? "?"} / ${ficha.mana_max ?? "?"}`,
          inline: true,
        },
        {
          name: "🛡️ Armadura",
          value: ficha.armadura?.toString() || "?",
          inline: true,
        }
      )
      .setFooter({ text: `Ativada por ${interaction.user.username}` });

    return interaction.update({
      content: "✅ Ficha selecionada e ativada!",
      embeds: [embed],
      components: [],
      ephemeral: true,
    });
  },
};
