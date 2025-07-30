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
    .setDescription("Visualiza ficha(s) da campanha atual."),

  async execute(interaction) {
    const guild = interaction.guild;
    const userId = interaction.user.id;
    const member = interaction.member;
    const categoryId = interaction.channel.parentId;
    const baseDir = path.join(__dirname, "../fichas/tormenta20");
    const masterRole = guild.roles.cache.find(
      (r) => r.name === `mestre${userId}`
    );
    const isMaster = masterRole && member.roles.cache.has(masterRole.id);

    let options = [];
    if (isMaster) {
      // mestre vê todas as fichas da campanha
      const userFolders = fs.existsSync(baseDir)
        ? await fs.readdir(baseDir)
        : [];
      for (const uid of userFolders) {
        const dir = path.join(baseDir, uid);
        if (!fs.lstatSync(dir).isDirectory()) continue;
        const files = await fs.readdir(dir);
        for (const f of files.filter((f) => f.endsWith(".json"))) {
          // opcionalmente checar campanha dentro do JSON, mas por enquanto lista todos
          const nome = path.basename(f, ".json").replace(/-/g, " ");
          const memberObj = await guild.members.fetch(uid).catch(() => null);
          const username = memberObj ? memberObj.user.username : uid;
          options.push({
            label: `${
              nome.charAt(0).toUpperCase() + nome.slice(1)
            } (${username})`,
            value: `${uid}:${f}`,
          });
        }
      }
    } else {
      // jogador vê só suas próprias fichas
      const dir = path.join(baseDir, userId);
      if (fs.existsSync(dir)) {
        const files = await fs.readdir(dir);
        for (const f of files.filter((f) => f.endsWith(".json"))) {
          const nome = path.basename(f, ".json").replace(/-/g, " ");
          options.push({
            label: nome.charAt(0).toUpperCase() + nome.slice(1),
            value: `${userId}:${f}`,
          });
        }
      }
    }

    if (options.length === 0) {
      return interaction.reply({
        content: isMaster
          ? "❌ Não há fichas nesta campanha."
          : "❌ Você não tem fichas nesta campanha.",
        ephemeral: true,
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`ver_ficha_selecionar:${categoryId}`)
      .setPlaceholder("Selecione a ficha para visualizar")
      .addOptions(options);

    await interaction.reply({
      content: isMaster
        ? `📜 Fichas da campanha:`
        : `🗂️ Suas fichas nesta campanha:`,
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true,
    });
  },

  async handleComponent(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    const [base, categoryId] = interaction.customId.split(":");
    if (base !== "ver_ficha_selecionar") return;

    const value = interaction.values[0]; // "uid:filename"
    const [jogadorId, fichaFile] = value.split(":");
    const userId = interaction.user.id;
    const guild = interaction.guild;
    const masterRole = guild.roles.cache.find(
      (r) => r.name === `mestre${userId}`
    );
    const isMaster =
      masterRole && interaction.member.roles.cache.has(masterRole.id);

    // valida acesso
    if (!isMaster && jogadorId !== userId) {
      return interaction.reply({
        content: "❌ Você não pode visualizar essa ficha.",
        ephemeral: true,
      });
    }

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
    const mec = require("../mechanics/tormenta20/index.js");

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
    const modDES = Math.floor((ficha.atributos.DES - 10) / 2);
    let bonusArmadura = 0;
    if (eq.armadura) {
      const armObj = mec.EQUIPAMENTOS.find((e) => e.nome === eq.armadura) || {};
      bonusArmadura = armObj.bonus_ca || 0;
    }
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
          value: `${valorCA} (10 ${
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
            `• Arma Secundária: ${eq.arma_secondary || "Nada"}`,
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
        text: isMaster
          ? `Visualizado pelo mestre ${interaction.user.username}`
          : `Visualizado por ${interaction.user.username}`,
      });

    await interaction.update({
      embeds: [embed],
      components: [],
      ephemeral: true,
    });
  },
};
