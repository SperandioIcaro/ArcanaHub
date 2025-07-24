const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("recurso")
    .setDescription("Gasta ou recupera Vida ou Mana da ficha ativa.")
    .addStringOption((opt) =>
      opt
        .setName("tipo")
        .setDescription("Escolha “vida” ou “mana”")
        .setRequired(true)
        .addChoices(
          { name: "Vida", value: "vida" },
          { name: "Mana", value: "mana" }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName("quantidade")
        .setDescription("Positivo para recuperar, negativo para gastar")
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;

    // 1️⃣ busca ficha ativa
    const ativasPath = path.join(__dirname, "../fichas/ativas.json");
    const ativas = await fs.readJson(ativasPath).catch(() => ({}));
    const ativa = ativas[userId];
    if (!ativa) {
      return interaction.reply({
        content: "❌ Você ainda não selecionou uma ficha.",
        ephemeral: true,
      });
    }

    // 2️⃣ carrega JSON da ficha ativa
    const fichaPath = path.join(
      __dirname,
      "../fichas",
      ativa.mecanica,
      userId,
      ativa.arquivo
    );
    if (!(await fs.pathExists(fichaPath))) {
      return interaction.reply({
        content: "❌ Ficha ativa não encontrada.",
        ephemeral: true,
      });
    }
    const ficha = await fs.readJson(fichaPath);

    // 3️⃣ aplica ajuste
    const tipo = interaction.options.getString("tipo"); // 'vida' ou 'mana'
    const delta = interaction.options.getInteger("quantidade");
    const keyAtual = `${tipo}_atual`; // vida_atual ou mana_atual
    const keyMax = `${tipo}_max`;

    const atualAntes = Number(ficha[keyAtual]) ?? 0;
    const max = Number(ficha[keyMax]) ?? 0;
    const novoValor = Math.min(Math.max(atualAntes + delta, 0), max);

    ficha[keyAtual] = novoValor;

    // 4️⃣ salva de volta
    await fs.writeJson(fichaPath, ficha, { spaces: 2 });

    // 5️⃣ resposta
    const titulo =
      tipo === "vida" ? "❤️ Vida Atualizada" : "🔵 Mana Atualizada";
    const cor = tipo === "vida" ? 0xff3333 : 0x3333ff;

    const embed = new EmbedBuilder()
      .setTitle(titulo)
      .setDescription(`Agora **${tipo}**: ${novoValor} / ${max}`)
      .setColor(cor);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
