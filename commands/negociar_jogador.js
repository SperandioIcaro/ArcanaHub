const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} = require("discord.js");
const fs = require("fs-extra");
const path = require("path");
const { moedasParaCobre, cobreParaTexto } = require("../utils/moedas");
const ATIVAS_PATH = path.join(__dirname, "..", "fichas", "ativas.json");

// Carrega dados de preço dos itens (armas e equipamentos)
const ARMAS_PATH = path.join(
  __dirname,
  "..",
  "mechanics",
  "tormenta20",
  "armas.json"
);
const EQ_PATH = path.join(
  __dirname,
  "..",
  "mechanics",
  "tormenta20",
  "equipamentos.json"
);
let PRICE_MAP = {};
(async () => {
  const [armas, equips] = await Promise.all([
    fs.readJson(ARMAS_PATH),
    fs.readJson(EQ_PATH),
  ]);
  armas.forEach((a) => (PRICE_MAP[a.nome] = a.preco));
  equips.forEach((e) => (PRICE_MAP[e.nome] = e.preco));
})();

// Estado temporário das negociações
const pending = new Map();

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
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("negociar_jogador")
    .setDescription("Negocia itens ou moedas entre jogadores")
    .addUserOption((opt) =>
      opt.setName("alvo").setDescription("Jogador alvo").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("acao")
        .setDescription("Ação a realizar")
        .setRequired(true)
        .addChoices(
          { name: "Vender item", value: "vender" },
          { name: "Comprar item", value: "comprar" },
          { name: "Enviar item/dinheiro", value: "enviar" }
        )
    ),

  // === EXECUTE: fluxo público de iniciar negociação ===
  async execute(interaction) {
    const userId = interaction.user.id;
    const alvo = interaction.options.getUser("alvo");
    const channel = interaction.channel;

    // validação de fichas
    const mec = (
      channel.parent?.name.match(/\[(.*?)\]/)?.[1] ||
      channel.parent?.name ||
      ""
    ).toLowerCase();
    const pathOrigem = resolveFichaPath(mec, userId);
    const pathAlvo = resolveFichaPath(mec, alvo.id);
    if (!pathOrigem || !pathAlvo) {
      return interaction.reply({
        content: "❌ Ambos devem ter ficha ativa.",
        ephemeral: true,
      });
    }

    // Mensagem pública com botões “Vender” e “Comprar”
    const btnVender = new ButtonBuilder()
      .setCustomId(`neg_vender_${userId}_${alvo.id}`)
      .setLabel("Vender")
      .setStyle(ButtonStyle.Primary);
    const btnComprar = new ButtonBuilder()
      .setCustomId(`neg_comprar_${userId}_${alvo.id}`)
      .setLabel("Comprar")
      .setStyle(ButtonStyle.Success);
    const btnEnviar = new ButtonBuilder()
      .setCustomId(`neg_enviar_${userId}_${alvo.id}`)
      .setLabel("Enviar")
      .setStyle(ButtonStyle.Secondary);

    // Publica só o aviso geral, sem botões, para não poluir o canal
    await channel.send(
      `🔄 **Negociação iniciada**: ${interaction.user.tag} propôs negociação a ${alvo.tag}`
    );

    // Envia **somente ao alvo** o menu de ações em ephemeral
    // Envia **somente ao alvo** o menu de ações em ephemeral
    return interaction.reply({
      content: `📩 ${interaction.user.tag} deseja negociar com você. Escolha uma ação:`,
      components: [
        new ActionRowBuilder().addComponents(btnVender, btnComprar, btnEnviar),
      ],
      ephemeral: true,
    });
  },

  async handleComponent(interaction) {
    const userId = interaction.user.id;

    // === Responde botões públicos de iniciar negociação ===
    if (
      interaction.customId.startsWith("neg_vender_") ||
      interaction.customId.startsWith("neg_comprar_") ||
      interaction.customId.startsWith("neg_enviar_")
    ) {
      const [actionPart, , origemId, destinoId] =
        interaction.customId.split("_");
      const acao =
        actionPart === "neg_vender"
          ? "vender"
          : actionPart === "neg_comprar"
          ? "comprar"
          : "enviar";

      // apenas quem iniciou pode clicar em “vender”
      if (acao === "vender" && interaction.user.id !== origemId) {
        return interaction.reply({
          content: "❌ Só quem iniciou pode confirmar venda.",
          ephemeral: true,
        });
      }
      // apenas o alvo pode clicar em “comprar”
      if (acao === "comprar" && interaction.user.id !== destinoId) {
        return interaction.reply({
          content: "❌ Só o alvo pode aceitar proposta de compra.",
          ephemeral: true,
        });
      }

      if (acao === "enviar" && interaction.user.id !== origemId) {
        return interaction.reply({
          content: "❌ Só quem iniciou pode enviar.",
          ephemeral: true,
        });
      }

      // salva no pending e confirma em ephemeral
      pending.set(origemId, { action: acao, alvoId: destinoId });
      return interaction.reply({
        content:
          acao === "vender"
            ? "📦 Você escolheu VENDER — agora defina item e preço via resposta privada."
            : acao === "comprar"
            ? "🛒 Você escolheu COMPRAR — agora defina item e preço via resposta privada."
            : "🎁 Você escolheu ENVIAR — agora defina item ou valor via resposta privada.",
        ephemeral: true,
      });
    }

    const data = pending.get(userId);
    if (!data) return;

    // ------ VENDER ------
    if (interaction.customId === "sel_vender") {
      const item = interaction.values[0];
      // pega preço padrão do PRICE_MAP
      const priceStr = PRICE_MAP[item] || "0 TO 0 TP 0 TC";
      data.item = item;
      data.valorPadrao = priceStr;

      const btn1 = new ButtonBuilder()
        .setCustomId("btn_padrao")
        .setLabel(`Usar ${priceStr}`)
        .setStyle(ButtonStyle.Primary);
      const btn2 = new ButtonBuilder()
        .setCustomId("btn_custom")
        .setLabel("Definir outro valor")
        .setStyle(ButtonStyle.Secondary);

      await interaction.deferUpdate();
      return interaction.followUp({
        content: `📦 Você escolheu vender **${item}** a preço padrão ${data.valorPadrao}.`,
        ephemeral: true,
      });
    }

    // ------ COMPRAR ------
    if (interaction.customId === "sel_proposta") {
      const item = interaction.values[0];
      const priceStr = PRICE_MAP[item] || "0 TO 0 TP 0 TC";
      data.item = item;
      data.valorPadrao = priceStr;

      const btn1 = new ButtonBuilder()
        .setCustomId("btn_padrao")
        .setLabel(`Usar ${priceStr}`)
        .setStyle(ButtonStyle.Primary);
      const btn2 = new ButtonBuilder()
        .setCustomId("btn_custom")
        .setLabel("Definir outro valor")
        .setStyle(ButtonStyle.Secondary);

      await interaction.deferUpdate();
      return interaction.update({
        content: `🛒 Ofertar **${item}** — escolha preço:`,
        ephemeral: true,
      });
    }

    // ------ ENVIAR ------
    if (interaction.customId === "sel_enviar_tipo") {
      const tipo = interaction.values[0];
      data.tipo = tipo;

      if (tipo === "item") {
        const fOrig = await fs.readJson(resolveFichaPath("", userId));
        const itens = [...new Set(fOrig.inventario || [])];
        const sel = new StringSelectMenuBuilder()
          .setCustomId("sel_enviar_item")
          .setPlaceholder("Selecione item")
          .addOptions(itens.map((i) => ({ label: i, value: i })));
        return interaction.update({
          content: "🎁 Selecione item para enviar:",
          components: [
            new ActionRowBuilder().addComponents(sel),
            new ActionRowBuilder().addComponents(btnEnviar),
          ],
        });
      }

      if (tipo === "dinheiro") {
        data.item = null;
        data.valorPadrao = "0 TO 0 TP 0 TC";
        const btn1 = new ButtonBuilder()
          .setLabel(`Propor ${priceStr}`)
          .setLabel("Enviar 0")
          .setStyle(ButtonStyle.Primary);
        const btn2 = new ButtonBuilder()
          .setCustomId("btn_custom")
          .setLabel("Definir outro valor")
          .setStyle(ButtonStyle.Secondary);
        return interaction.update({
          content: "💰 Escolha valor:",
          components: [new ActionRowBuilder().addComponents(btn1, btn2)],
        });
      }
    }

    // ------ ENVIAR ITEM SELECT ------
    if (interaction.customId === "sel_enviar_item") {
      const item = interaction.values[0];
      data.item = item;
      const btn1 = new ButtonBuilder()
        .setCustomId("btn_padrao")
        .setLabel("Usar 0 moeda")
        .setStyle(ButtonStyle.Primary);
      const btn2 = new ButtonBuilder()
        .setCustomId("btn_custom")
        .setLabel("Definir valor")
        .setStyle(ButtonStyle.Secondary);
      return interaction.update({
        content: `🎁 Enviar **${item}** — escolha valor:`,
        components: [new ActionRowBuilder().addComponents(btn1, btn2)],
      });
    }

    // === Confirmação de preço ou envio custom ===
    if (
      interaction.customId === "btn_padrao" ||
      interaction.customId === "btn_custom"
    ) {
      // Se for custom, manda instrução e encerra
      if (interaction.customId === "btn_custom") {
        return interaction.reply({
          content: "✏️ Use `/negociar_jogador valor:<valor>` para continuar.",
          ephemeral: true,
        });
      }

      // finaliza com valorPadrao
      const valor = data.valorPadrao;
      const cobre = moedasParaCobre(valor);
      const origP = resolveFichaPath("", userId);
      const alvoP = resolveFichaPath("", data.alvoId);
      let [fOrig, fAlvo] = await Promise.all([
        fs.readJson(origP),
        fs.readJson(alvoP),
      ]);

      // aplicar transação
      if (data.action === "vender") {
        fOrig.inventario = fOrig.inventario.filter((i) => i !== data.item);
        fAlvo.inventario.push(data.item);
        let sO = moedasParaCobre(
          `${fOrig.carteira.TO} TO ${fOrig.carteira.TP} TP ${fOrig.carteira.TC} TC`
        );
        let sA = moedasParaCobre(
          `${fAlvo.carteira.TO} TO ${fAlvo.carteira.TP} TP ${fAlvo.carteira.TC} TC`
        );
        sO += cobre;
        sA -= cobre;
        fOrig.carteira = {
          TO: Math.floor(sO / 100),
          TP: Math.floor((sO % 100) / 10),
          TC: sO % 10,
        };
        fAlvo.carteira = {
          TO: Math.floor(sA / 100),
          TP: Math.floor((sA % 100) / 10),
          TC: sA % 10,
        };
      }
      if (data.action === "comprar") {
        fAlvo.inventario = fAlvo.inventario.filter((i) => i !== data.item);
        fOrig.inventario.push(data.item);
        let sO = moedasParaCobre(
          `${fOrig.carteira.TO} TO ${fOrig.carteira.TP} TP ${fOrig.carteira.TC} TC`
        );
        let sA = moedasParaCobre(
          `${fAlvo.carteira.TO} TO ${fAlvo.carteira.TP} TP ${fAlvo.carteira.TC} TC`
        );
        sO -= cobre;
        sA += cobre;
        fOrig.carteira = {
          TO: Math.floor(sO / 100),
          TP: Math.floor((sO % 100) / 10),
          TC: sO % 10,
        };
        fAlvo.carteira = {
          TO: Math.floor(sA / 100),
          TP: Math.floor((sA % 100) / 10),
          TC: sA % 10,
        };
      }
      if (data.action === "enviar") {
        if (data.tipo === "item") {
          fOrig.inventario = fOrig.inventario.filter((i) => i !== data.item);
          fAlvo.inventario.push(data.item);
        } else {
          let sO = moedasParaCobre(
            `${fOrig.carteira.TO} TO ${fOrig.carteira.TP} TP ${fOrig.carteira.TC} TC`
          );
          let sA = moedasParaCobre(
            `${fAlvo.carteira.TO} TO ${fAlvo.carteira.TP} TP ${fAlvo.carteira.TC} TC`
          );
          sO -= cobre;
          sA += cobre;
          fOrig.carteira = {
            TO: Math.floor(sO / 100),
            TP: Math.floor((sO % 100) / 10),
            TC: sO % 10,
          };
          fAlvo.carteira = {
            TO: Math.floor(sA / 100),
            TP: Math.floor((sA % 100) / 10),
            TC: sA % 10,
          };
        }
      }

      // salva mudanças
      await Promise.all([
        fs.writeJson(origP, fOrig, { spaces: 2 }),
        fs.writeJson(alvoP, fAlvo, { spaces: 2 }),
      ]);

      // atualiza a mensagem pública
      await interaction.update({
        content: `✅ ${data.action} de **${
          data.item || "dinheiro"
        }** por ${valor} concluído.`,
        components: [],
      });

      // se for 'enviar', envia ephemerals pra A e B
      if (data.action === "enviar") {
        // pra quem enviou
        await interaction.followUp({
          content: `✅ Você enviou **${
            data.item || "dinheiro"
          }** por ${valor} para <@${data.alvoId}>.`,
          ephemeral: true,
        });
        // pra quem recebeu
        await interaction.followUp({
          content: `🎉 Você recebeu **${
            data.item || "dinheiro"
          }** por ${valor} de <@${userId}>.`,
          ephemeral: true,
        });
      }

      pending.delete(userId);
      return;
    }
  },
};
