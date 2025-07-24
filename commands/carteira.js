// commands/carteira.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs-extra");
const path = require("path");
const { moedasParaCobre, cobreParaTexto } = require("../utils/moedas");

const ATIVAS_PATH = path.join(__dirname, "..", "fichas", "ativas.json");

const slugify = (txt) =>
  txt
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

function resolveFichaPath(mec, userId) {
  if (fs.existsSync(ATIVAS_PATH)) {
    const todas = fs.readJsonSync(ATIVAS_PATH);
    const entry = todas[userId];
    if (entry && entry.arquivo && entry.mecanica) {
      const p = path.join(
        __dirname,
        "..",
        "fichas",
        entry.mecanica,
        userId,
        entry.arquivo
      );
      if (fs.existsSync(p)) return p;
    }
  }
  const nested = path.join(
    __dirname,
    "..",
    "fichas",
    mec,
    userId,
    `${userId}.json`
  );
  const flat = path.join(__dirname, "..", "fichas", mec, `${userId}.json`);
  if (fs.existsSync(nested)) return nested;
  if (fs.existsSync(flat)) return flat;
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("carteira")
    .setDescription("Gerencia suas moedas na ficha ativa")
    .addStringOption((o) =>
      o
        .setName("acao")
        .setDescription("O que deseja fazer?")
        .setRequired(true)
        .addChoices(
          { name: "📊 Saldo", value: "saldo" },
          { name: "➕ Adicionar", value: "adicionar" },
          { name: "➖ Remover", value: "remover" }
        )
    )
    // para adicionar/remover, solicitamos quantidades de cada tipo
    .addIntegerOption((o) =>
      o.setName("to").setDescription("Tostões (TO)").setMinValue(0)
    )
    .addIntegerOption((o) =>
      o.setName("tp").setDescription("Prata (TP)").setMinValue(0)
    )
    .addIntegerOption((o) =>
      o.setName("tc").setDescription("Cobre (TC)").setMinValue(0)
    ),

  async execute(interaction) {
    const acao = interaction.options.getString("acao");
    const toAmt = interaction.options.getInteger("to") ?? 0;
    const tpAmt = interaction.options.getInteger("tp") ?? 0;
    const tcAmt = interaction.options.getInteger("tc") ?? 0;

    const userId = interaction.user.id;
    const channelName = interaction.channel.parent?.name || "";
    const mec = (
      channelName.match(/\[(.*?)\]/)?.[1] || channelName
    ).toLowerCase();
    const fichaPath = resolveFichaPath(mec, userId);

    if (!fichaPath) {
      return interaction.reply({
        content: "❌ Você não possui uma ficha ativa.",
        ephemeral: true,
      });
    }

    const ficha = await fs.readJson(fichaPath);
    const c = ficha.carteira || {};
    ficha.carteira = {
      TO: c.TO ?? 0,
      TP: c.TP ?? 0,
      TC: c.TC ?? 0,
    };

    // SALDO
    if (acao === "saldo") {
      const totalCobre = moedasParaCobre(
        `${ficha.carteira.TO} TO ${ficha.carteira.TP} TP ${ficha.carteira.TC} TC`
      );
      const texto = cobreParaTexto(totalCobre);

      const embed = new EmbedBuilder()
        .setTitle("💰 Seu Saldo")
        .setDescription(texto)
        .addFields(
          {
            name: "Tostões (TO)",
            value: String(ficha.carteira.TO),
            inline: true,
          },
          {
            name: "Prata (TP)",
            value: String(ficha.carteira.TP),
            inline: true,
          },
          { name: "Cobre (TC)", value: String(ficha.carteira.TC), inline: true }
        )
        .setColor(0xffd700)
        .setFooter({ text: `Total em cobre: ${totalCobre} TC` });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ADD / REMOVE
    // calcula delta total em cobre
    const deltaCobre = toAmt * 100 + tpAmt * 10 + tcAmt;
    if (deltaCobre === 0) {
      return interaction.reply({
        content: "ℹ️ Nenhuma moeda especificada para adicionar/remover.",
        ephemeral: true,
      });
    }

    const atualCobre = moedasParaCobre(
      `${ficha.carteira.TO} TO ${ficha.carteira.TP} TP ${ficha.carteira.TC} TC`
    );
    let novoCobre =
      acao === "adicionar" ? atualCobre + deltaCobre : atualCobre - deltaCobre;

    if (acao === "remover" && novoCobre < 0) {
      return interaction.reply({
        content: "❌ Saldo insuficiente.",
        ephemeral: true,
      });
    }

    // reconverte para TO, TP, TC
    ficha.carteira.TO = Math.floor(novoCobre / 100);
    ficha.carteira.TP = Math.floor((novoCobre % 100) / 10);
    ficha.carteira.TC = novoCobre % 10;

    await fs.writeJson(fichaPath, ficha, { spaces: 2 });

    const actionVerb = acao === "adicionar" ? "Adicionado" : "Removido";
    return interaction.reply({
      content: `✅ ${actionVerb} **${cobreParaTexto(
        deltaCobre
      )}** à carteira.\nSaldo atual: **${cobreParaTexto(novoCobre)}**`,
      ephemeral: true,
    });
  },
};
