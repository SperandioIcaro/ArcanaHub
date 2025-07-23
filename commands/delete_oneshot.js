// commands/delete_oneshot.js
const fs = require("fs");
const path = require("path");
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("delete_oneshot")
    .setDescription("Exclui a campanha atual e todas as fichas relacionadas")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  async execute(interaction) {
    // valida canal de campanha
    const channel = interaction.channel;
    if (!channel.parentId)
      return interaction.reply({
        content: "❌ Este comando só funciona em canais de campanha.",
        ephemeral: true,
      });
    const category = interaction.guild.channels.cache.get(channel.parentId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.reply({
        content: "❌ Categoria da campanha não encontrada.",
        ephemeral: true,
      });
    }

    // valida permissões
    const userId = interaction.user.id;
    const isMaster = interaction.member.roles.cache.some(
      (r) => r.name === `mestre${userId}`
    );
    const isMod = interaction.member.permissions.has(
      PermissionFlagsBits.ManageGuild
    );
    if (!isMaster && !isMod) {
      return interaction.reply({
        content: "🚫 Apenas o mestre ou moderador pode excluir.",
        ephemeral: true,
      });
    }

    // botões de confirmação
    const yesBtn = new ButtonBuilder()
      .setCustomId(`delete_yes_${category.id}`)
      .setLabel("Sim")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true);
    const noBtn = new ButtonBuilder()
      .setCustomId(`delete_no_${category.id}`)
      .setLabel("Não")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(yesBtn, noBtn);
    await interaction.reply({
      content: `❗ Tem certeza que deseja excluir a campanha **${category.name}**?`,
      components: [row],
      ephemeral: true,
    });

    // habilita SIM depois de 7s
    setTimeout(async () => {
      try {
        yesBtn.setDisabled(false);
        await interaction.editReply({
          components: [new ActionRowBuilder().addComponents(yesBtn, noBtn)],
        });
      } catch (err) {
        console.warn("Não foi possível atualizar botões:", err);
      }
    }, 7000);

    // coletor de botões
    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== userId)
        return i.reply({
          content: "🚫 Apenas quem iniciou pode responder.",
          ephemeral: true,
        });
      await i.deferUpdate();

      if (i.customId === `delete_no_${category.id}`) {
        collector.stop("cancelled");
        return interaction
          .editReply({ content: "❌ Exclusão cancelada.", components: [] })
          .catch(console.warn);
      }

      if (i.customId === `delete_yes_${category.id}`) {
        collector.stop("deleted");
        // confirma antes de apagar
        await interaction
          .editReply({ content: "⏳ Excluindo campanha...", components: [] })
          .catch(console.warn);

        // apaga canais e categoria
        interaction.guild.channels.cache
          .filter((ch) => ch.parentId === category.id)
          .forEach((ch) => ch.delete().catch(console.warn));
        await category.delete().catch(console.warn);

        // apaga fichas
        const fichasDir = path.join(__dirname, "..", "fichas");
        fs.readdirSync(fichasDir).forEach((file) => {
          if (file.includes(`_${category.id}.json`)) {
            try {
              fs.unlinkSync(path.join(fichasDir, file));
            } catch (err) {
              console.warn(err);
            }
          }
        });

        // envia sucesso ANTES de canais sumirem
        await interaction
          .followUp({
            content: "✅ Campanha e fichas excluídas com sucesso!",
            ephemeral: true,
          })
          .catch(console.warn);
      }
    });

    collector.on("end", (_, reason) => {
      if (reason === "time") {
        interaction
          .editReply({
            content: "⏰ Tempo esgotado. Exclusão cancelada.",
            components: [],
          })
          .catch(console.warn);
      }
    });
  },
};
