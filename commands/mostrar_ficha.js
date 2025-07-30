const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ChannelType,
} = require("discord.js");
const fs = require("fs-extra");
const path = require("path");
const { experienciaPorNivel } = require("../mechanics/tormenta20/index.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mostrar_ficha")
    .setDescription(
      "Mostra a ficha selecionada publicamente no canal de sessão."
    ),

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

    // coletar opções de ficha como em ver_ficha
    let options = [];
    const userFolders = fs.existsSync(baseDir) ? await fs.readdir(baseDir) : [];
    for (const uid of userFolders) {
      if (!fs.lstatSync(path.join(baseDir, uid)).isDirectory()) continue;
      const files = await fs.readdir(path.join(baseDir, uid));
      for (const f of files.filter((f) => f.endsWith(".json"))) {
        const fichaId = `${uid}:${f}`;
        // somente incluir se for mestre ou seja do próprio
        if (isMaster || uid === userId) {
          const nome = path.basename(f, ".json").replace(/-/g, " ");
          const label =
            isMaster && uid !== userId
              ? `${nome.charAt(0).toUpperCase() + nome.slice(1)} (${
                  (await guild.members.fetch(uid)).user.username
                })`
              : nome.charAt(0).toUpperCase() + nome.slice(1);
          options.push({ label, value: fichaId });
        }
      }
    }

    if (!options.length) {
      return interaction.reply({
        content: isMaster
          ? "❌ Não há fichas para mostrar nesta campanha."
          : "❌ Você não tem fichas para mostrar nesta campanha.",
        ephemeral: true,
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`mostrar_ficha_select:${categoryId}`)
      .setPlaceholder("Selecione a ficha para mostrar")
      .addOptions(options);

    await interaction.reply({
      content: `🖼️ Selecione a ficha para exibir:`,
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true,
    });
  },

  async handleComponent(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    const [base, categoryId] = interaction.customId.split(":");
    if (base !== "mostrar_ficha_select") return;

    const [jogadorId, fichaFile] = interaction.values[0].split(":");
    const userId = interaction.user.id;
    const guild = interaction.guild;
    const masterRole = guild.roles.cache.find(
      (r) => r.name === `mestre${userId}`
    );
    const isMaster =
      masterRole && interaction.member.roles.cache.has(masterRole.id);
    if (!isMaster && jogadorId !== userId) {
      return interaction.reply({
        content: "🚫 Acesso negado.",
        ephemeral: true,
      });
    }

    const fichaPath = path.join(
      __dirname,
      `../fichas/tormenta20/${jogadorId}/${fichaFile}`
    );
    if (!fs.existsSync(fichaPath)) {
      return interaction.update({
        content: "❌ Ficha não encontrada.",
        components: [],
        ephemeral: true,
      });
    }

    const ficha = await fs.readJson(fichaPath);
    const mec = require("../mechanics/tormenta20/index.js");
    // gerar embed igual ver_ficha
    const eq = ficha.equipados || {
      arma_principal: null,
      arma_secundaria: null,
      armadura: null,
      outros: [],
    };
    const inv = ficha.inventario || [];
    const cart = {
      TO: ficha.carteira?.TO || 0,
      TP: ficha.carteira?.TP || 0,
      TC: ficha.carteira?.TC || 0,
    };
    const modDES = Math.floor((ficha.atributos.DES - 10) / 2);
    const bonusArmadura = eq.armadura
      ? mec.EQUIPAMENTOS.find((e) => e.nome === eq.armadura)?.bonus_ca || 0
      : 0;
    const valorCA = 10 + modDES + bonusArmadura;
    const nivel = ficha.nivel || 1;
    // tenta nivel+1, depois nivel, e por fim 0
    const xpMax =
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
        { name: "⭐ XP", value: `${ficha.xp || 0} / ${xpMax}`, inline: true },
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
          }${modDES} + ${bonusArmadura})`,
          inline: true,
        },
        {
          name: "🎒 Mochila",
          value: inv.length ? inv.join(", ") : "Vazia",
          inline: false,
        }
      )
      .setFooter({
        text: isMaster
          ? `Mestre ${interaction.user.username}`
          : interaction.user.username,
      });

    // enviar embed no canal texto da campanha
    const sessionChannel = guild.channels.cache.find(
      (ch) => ch.parentId === categoryId && ch.name === "sessao"
    );
    if (sessionChannel && sessionChannel.type === ChannelType.GuildText) {
      await sessionChannel.send({ embeds: [embed] });
      await interaction.update({
        content: "✅ Ficha enviada publicamente.",
        components: [],
        ephemeral: true,
      });
    } else {
      await interaction.update({
        content: "❌ Canal de sessão não encontrado.",
        components: [],
        ephemeral: true,
      });
    }
  },
};
