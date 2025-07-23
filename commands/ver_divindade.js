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
    .setName("ver_divindade")
    .setDescription("Exibe a ficha técnica de uma divindade"),

  async execute(interaction) {
    // Agora apontamos para o JSON original que você já possui
    const filePath = path.join(
      __dirname,
      "../mechanics/tormenta20/divindades.json"
    );

    let divs;
    try {
      divs = await fs.readJson(filePath);
    } catch (err) {
      console.error("Falha ao ler divindades.json:", err);
      return interaction.reply({
        content: "❌ Não consegui carregar a lista de divindades.",
        ephemeral: true,
      });
    }

    const options = divs.map((d, i) => ({
      label: d.nome,
      value: String(i),
    }));

    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_div")
      .setPlaceholder("Escolha a divindade")
      .addOptions(options);

    await interaction.reply({
      content: "🕊️ Selecione a divindade:",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    });
  },

  async handleComponent(interaction) {
    if (
      !interaction.isStringSelectMenu() ||
      interaction.customId !== "select_div"
    )
      return;

    const idx = parseInt(interaction.values[0], 10);
    const filePath = path.join(
      __dirname,
      "../mechanics/tormenta20/divindades.json"
    );

    let divs;
    try {
      divs = await fs.readJson(filePath);
    } catch (err) {
      console.error("Falha ao ler divindades.json:", err);
      return interaction.update({
        content: "❌ Erro ao carregar ficha da divindade.",
        components: [],
        ephemeral: true,
      });
    }

    const d = divs[idx];
    if (!d) {
      return interaction.update({
        content: "❌ Divindade inválida.",
        components: [],
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔱 ${d.nome}`)
      .setThumbnail(`attachment://${d.nome}.jpg`) // vamos usar attachment para enviar a imagem junto
      .setColor(0x0099ff)
      .addFields(
        { name: "🎯 Crenças e Objetivos", value: d.crencas_objetivos },
        { name: "🛐 Símbolo", value: d.simbolo_sagrado, inline: true },
        { name: "🔋 Canaliza", value: d.canalizar_energia, inline: true },
        { name: "⚔️ Arma", value: d.arma_preferida, inline: true },
        { name: "🤝 Devotos", value: (d.devotos || []).join(", ") || "—" },
        { name: "🚫 Restrição", value: d.obrigacoes_restricoes || "—" },
        {
          name: "✨ Poderes Concedidos",
          value:
            (d.poderes_concedidos || [])
              .map(
                (p) =>
                  `**${p.nome}** (${p.custo_pm} PM) — ${p.descricao}` +
                  (p.alcance ? ` Alcance: ${p.alcance}.` : "") +
                  (p.duracao ? ` Duração: ${p.duracao}.` : "")
              )
              .join("\n\n") || "—",
        }
      )
      .setFooter({ text: `Fichinha lírica para inspirar sua mesa` });

    // Carregamos a imagem como attachment para que o .setThumbnail funcione
    const imgPath = path.join(
      __dirname,
      "../mechanics/tormenta20/inputs",
      `${d.nome}.jpg`
    );

    await interaction.update({
      content: "",
      embeds: [embed],
      components: [],
      files: [{ attachment: imgPath, name: `${d.nome}.jpg` }],
    });
  },
};
