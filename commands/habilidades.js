const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("habilidade")
    .setDescription("Veja detalhes de uma habilidade da sua ficha.")
    .addStringOption((option) =>
      option
        .setName("nome")
        .setDescription("Escolha a habilidade")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const userId = interaction.user.id;
    const ativasPath = path.join(__dirname, "../fichas/ativas.json");
    const ativas = await fs.readJson(ativasPath).catch(() => ({}));
    const ativa = ativas[userId];
    if (!ativa) return interaction.respond([]);

    const fichaPath = path.join(
      __dirname,
      "../fichas",
      ativa.mecanica,
      userId,
      ativa.arquivo
    );
    if (!fs.existsSync(fichaPath)) return interaction.respond([]);

    const ficha = await fs.readJson(fichaPath);
    // Adaptação: busca todos os campos relevantes
    const todasHabilidades = [
      ...(ficha.habilidades || []),
      ...(ficha.habilidades_autom || []),
      ...(ficha.poderes_raciais || []),
      ...(ficha.vantagens_subraca || []),
    ];

    const focused = interaction.options.getFocused();
    const sugestões = todasHabilidades
      .filter((h) => h.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25)
      .map((h) => ({ name: h, value: h }));

    return interaction.respond(sugestões);
  },

  async execute(interaction) {
    const userId = interaction.user.id;
    const nome = interaction.options.getString("nome");

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

    const habilidadesHerdadasPath = path.join(
      __dirname,
      "../mechanics",
      ativa.mecanica,
      "habilidades_herdadas.json"
    );
    const habilidadesJsonPath = path.join(
      __dirname,
      "../mechanics",
      ativa.mecanica,
      "habilidades.json"
    );
    const divindadesPath = path.join(
      __dirname,
      "../mechanics",
      ativa.mecanica,
      "divindades.json"
    );

    const habilidadesHerdadas = await fs
      .readJson(habilidadesHerdadasPath)
      .catch(() => []);
    const habilidadesJson = await fs
      .readJson(habilidadesJsonPath)
      .catch(() => []);
    const divindades = await fs.readJson(divindadesPath).catch(() => []);

    let habilidade =
      habilidadesHerdadas.find((h) => h.nome === nome) ||
      habilidadesJson.find((h) => h.nome === nome) ||
      (() => {
        for (const divindade of divindades) {
          const poder = (divindade.poderes_concedidos || []).find(
            (p) => p.nome === nome
          );
          if (poder) return poder;
        }
        return null;
      })();

    if (!habilidade) {
      habilidade = {
        nome,
        descricao: "Descrição não encontrada.",
        custo_pm: 0,
        alcance: "?",
        duracao: "?",
      };
    }

    const embed = new EmbedBuilder()
      .setTitle(`🌀 ${habilidade.nome}`)
      .setDescription(`_${habilidade.descricao}_`)
      .addFields(
        {
          name: "Custo",
          value: `${habilidade.custo_pm ?? 0} PM`,
          inline: true,
        },
        {
          name: "Alcance",
          value: habilidade.alcance || "-",
          inline: true,
        },
        {
          name: "Duração",
          value: habilidade.duracao || "-",
          inline: true,
        }
      )
      .setColor(0x9966cc);

    if (habilidade.dano)
      embed.addFields({ name: "Dano", value: habilidade.dano, inline: true });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
