const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} = require("discord.js");
const fs = require("fs-extra");
const path = require("path");
const { experienciaPorNivel } = require("../mechanics/tormenta20/index.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ver_ficha")
    .setDescription("Visualiza uma das fichas de um jogador (somente mestres).")
    .addUserOption((opt) =>
      opt
        .setName("jogador")
        .setDescription("Jogador cuja ficha será visualizada")
        .setRequired(true)
    ),

  // === AQUI RESTAURAMOS O EXECUTE ===
  async execute(interaction) {
    const mestreId = interaction.user.id;
    const roleName = `mestre${mestreId}`;
    const mestreRole = interaction.guild.roles.cache.find(
      (r) => r.name === roleName
    );
    if (!mestreRole || !interaction.member.roles.cache.has(mestreRole.id)) {
      return interaction.reply({
        content: "❌ Você não tem permissão para usar este comando.",
        ephemeral: true,
      });
    }

    const alvo = interaction.options.getUser("jogador");
    const dir = path.join(__dirname, `../fichas/tormenta20/${alvo.id}`);
    if (!fs.existsSync(dir)) {
      return interaction.reply({
        content: "❌ Este jogador ainda não tem nenhuma ficha criada.",
        ephemeral: true,
      });
    }

    const arquivos = await fs.readdir(dir);
    const opcoes = arquivos
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const nomeFicha = path.basename(f, ".json").replace(/-/g, " ");
        return {
          label: nomeFicha[0].toUpperCase() + nomeFicha.slice(1),
          value: f,
        };
      });

    const select = new StringSelectMenuBuilder()
      .setCustomId(`ver_ficha_selecionar:${alvo.id}`)
      .setPlaceholder("Selecione a ficha para visualizar")
      .addOptions(opcoes);

    await interaction.reply({
      content: `👤 Fichas de **${alvo.username}**:\nSelecione uma para visualizar abaixo:`,
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true,
    });
  },

  // === HANDLE COMPONENT COM CÁLCULO DE CA ===
  async handleComponent(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    const [base, jogadorId] = interaction.customId.split(":");
    if (base !== "ver_ficha_selecionar") return;

    // Revalida permissão de mestre
    const mestreId = interaction.user.id;
    const roleName = `mestre${mestreId}`;
    const mestreRole = interaction.guild.roles.cache.find(
      (r) => r.name === roleName
    );
    if (!mestreRole || !interaction.member.roles.cache.has(mestreRole.id)) {
      return interaction.reply({
        content: "❌ Você não tem permissão para visualizar essa ficha.",
        ephemeral: true,
      });
    }

    const fichaFile = interaction.values[0];
    const fichaPath = path.join(
      __dirname,
      `../fichas/tormenta20/${jogadorId}/${fichaFile}`
    );
    if (!fs.existsSync(fichaPath)) {
      return interaction.update({
        content: "❌ Esta ficha não existe mais.",
        components: [],
        ephemeral: true,
      });
    }

    const ficha = await fs.readJson(fichaPath);

    // Carrega mecânica para buscar dados de equipamentos
    const mec = require("../mechanics/tormenta20/index.js");

    // Extrai campos
    const eq = ficha.equipados || {
      arma_principal: null,
      arma_secundaria: null,
      armadura: null,
      outros: [],
    };
    const inv = ficha.inventario || [];
    const cart = {
      TO: ficha.carteira?.TO ?? 0,
      TP: ficha.carteira?.TP ?? 0,
      TC: ficha.carteira?.TC ?? 0,
    };

    // 1) Modificador de Destreza
    const modDES = Math.floor((ficha.atributos.DES - 10) / 2);

    // 2) Bônus da armadura equipada (campo `bonus_ca` no JSON)
    let bonusArmadura = 0;
    if (eq.armadura) {
      const armObj = mec.EQUIPAMENTOS.find((e) => e.nome === eq.armadura) || {};
      bonusArmadura = armObj.bonus_ca || 0;
    }

    // 3) Cálculo de CA
    const valorCA = 10 + modDES + bonusArmadura;

    const nivel = ficha.nivel || 1;
    const xpMaximo =
      experienciaPorNivel[nivel + 1] ?? experienciaPorNivel[nivel] ?? 0;

    const embed = new EmbedBuilder()
      .setTitle(`📜 Ficha de ${ficha.nome}`)
      .setThumbnail(ficha.imagem || null)
      .setColor(0x964b00)
      .addFields(
        { name: "🎭 Classe", value: ficha.classe || "-", inline: true },
        {
          name: "🧬 Raça",
          value: `${ficha.raca || "-"} (${ficha.subraca || "Puro"})`,
          inline: true,
        },
        { name: "📖 Origem", value: ficha.origem || "-", inline: true },
        { name: "🧙 Nível", value: `${ficha.nivel || 1}`, inline: true },
        {
          name: "🙏 Divindade",
          value: ficha.divindade || "Nenhuma",
          inline: true,
        },
        {
          name: "⭐ XP",
          value: `${
            (ficha.xp ?? experienciaPorNivel[nivel]) || 0
          } / ${xpMaximo}`,
          inline: true,
        },
        {
          name: "❤️ Vida",
          value: `${ficha.vida_atual || "?"} / ${ficha.vida_max || "?"}`,
          inline: true,
        },
        {
          name: "🔵 Mana",
          value: `${ficha.mana_atual || "?"} / ${ficha.mana_max || "?"}`,
          inline: true,
        },
        {
          name: "🛡️ CA",
          value: `${valorCA} (10 + ${
            modDES >= 0 ? "+" : ""
          }${modDES} Des + ${bonusArmadura} Arm)`,
          inline: true,
        },
        {
          name: "🧠 Atributos",
          value:
            Object.entries(ficha.atributos || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join(" | ") || "N/A",
          inline: false,
        },
        {
          name: "💰 Carteira",
          value: `${cart.TO} TO • ${cart.TP} TP • ${cart.TC} TC`,
          inline: false,
        },
        {
          name: "📚 Perícias",
          value:
            [...(ficha.pericias_autom || []), ...(ficha.pericias || [])].join(
              ", "
            ) || "Nenhuma",
          inline: false,
        },
        {
          name: "✨ Habilidades",
          value:
            [
              ...(ficha.habilidades_autom || []),
              ...(ficha.habilidades || []),
            ].join(", ") || "Nenhuma",
          inline: false,
        },
        {
          name: "🗡️ Equipados",
          value: [
            `• Arma Principal: ${eq.arma_principal || "Nada"}`,
            `• Arma Secundária: ${eq.arma_secundaria || "Nada"}`,
            `• Armadura: ${eq.armadura || "Nada"} (+${bonusArmadura})`,
            ...(eq.outros.length ? [`• Outros: ${eq.outros.join(", ")}`] : []),
          ].join("\n"),
          inline: false,
        },
        {
          name: "🎒 Mochila",
          value: inv.length > 0 ? inv.join(", ") : "Vazia",
          inline: false,
        }
      )
      .setFooter({
        text: `Visualizado por mestre ${interaction.user.username}`,
      });

    await interaction.update({
      content: "",
      embeds: [embed],
      components: [],
      ephemeral: true,
    });
  },
};
