// commands/create_oneshot.js
const ICONS = ["🔥", "🛡️", "⚔️", "🧙", "🐉", "🌌", "💀", "🏹", "🗺️", "🔮"];
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

// Load available mechanics dynamically from /mechanics directory
const mechanicsDir = path.join(__dirname, "..", "mechanics");
const availableMechanics = fs
  .readdirSync(mechanicsDir)
  .filter((file) => fs.statSync(path.join(mechanicsDir, file)).isDirectory());

module.exports = {
  data: new SlashCommandBuilder()
    .setName("create_oneshot")
    .setDescription("Cria uma categoria + canais para uma oneshot")
    .addStringOption((opt) =>
      opt.setName("name").setDescription("Nome da campanha").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("mechanic")
        .setDescription("Sistema de regras para a oneshot")
        .setRequired(true)
        .addChoices(...availableMechanics.map((m) => ({ name: m, value: m })))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // 0) Captura opções
    const rawName = interaction.options.getString("name");
    const mech = interaction.options.getString("mechanic");
    const guild = interaction.guild;
    const userId = interaction.user.id;
    const roleName = `mestre${userId}`;

    // 1) Cria cargo exclusivo para o mestre
    let mestreRole = guild.roles.cache.find((r) => r.name === roleName);
    if (!mestreRole) {
      mestreRole = await guild.roles.create({
        name: roleName,
        mentionable: false,
        permissions: [
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ViewChannel,
        ],
      });
    }
    await interaction.member.roles.add(mestreRole);

    // 2) Escolhe ícone e formata nome
    const icon = ICONS[Math.floor(Math.random() * ICONS.length)];
    const categoryName = `${icon} ${rawName.toUpperCase()} [${mech}]`;

    // 3) Cria categoria com permissão negada ao everyone
    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      ],
    });

    // 4) Define e cria canais
    const channels = [
      {
        name: "sessao",
        overwrites: [
          {
            id: guild.roles.everyone,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ],
          },
        ],
      },
      {
        name: "rolagens",
        overwrites: [
          {
            id: guild.roles.everyone,
            allow: [PermissionFlagsBits.AddReactions],
            deny: [PermissionFlagsBits.SendMessages],
          },
        ],
      },
      {
        name: "fichas",
        overwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: mestreRole.id, allow: [PermissionFlagsBits.ViewChannel] },
          { id: userId, allow: [PermissionFlagsBits.ViewChannel] },
        ],
      },
      {
        name: "npcs-mobs",
        overwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: mestreRole.id, allow: [PermissionFlagsBits.ViewChannel] },
        ],
      },
    ];
    for (const ch of channels) {
      await guild.channels.create({
        name: ch.name,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: ch.overwrites,
      });
    }
    await guild.channels.create({
      name: "sala-de-voz",
      type: ChannelType.GuildVoice,
      parent: category,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.Connect] },
        { id: mestreRole.id, allow: [PermissionFlagsBits.Connect] },
      ],
    });

    // 5) Botão para novos jogadores
    await new Promise((res) => setTimeout(res, 1000));
    const sessionChannel = guild.channels.cache.find(
      (ch) => ch.parentId === category.id && ch.name === "sessao"
    );
    if (!sessionChannel) return console.error("Canal 'sessao' não encontrado.");

    const joinRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`join_oneshot_${category.id}`)
        .setLabel("Juntar-se à campanha")
        .setStyle(ButtonStyle.Primary)
    );
    const joinMsg = await sessionChannel.send({
      content: "💬 Clique abaixo para se juntar à campanha!",
      components: [joinRow],
    });

    const collector = sessionChannel.createMessageComponentCollector({
      componentType: ComponentType.Button,
    });
    collector.on("collect", async (i) => {
      if (i.customId !== `join_oneshot_${category.id}`) return;

      // Desabilita/remova o botão
      await i.update({ components: [] });

      const isMaster = i.user.id === userId;
      const playerRoleName = `jogador${i.user.id}_${category.id}`;
      const already =
        i.member.roles.cache.some((r) => r.name === playerRoleName) || isMaster;

      if (already) {
        // Mensagem para quem já está
        await i.followUp({
          content: isMaster
            ? "🛡️ Mestre, você já iniciou a sessão."
            : "⚠️ Você já faz parte desta campanha.",
          ephemeral: true,
        });
      } else {
        // Novo jogador: cria cargo e dá permissões
        const playerRole = await guild.roles.create({
          name: playerRoleName,
          mentionable: false,
        });
        await i.member.roles.add(playerRole);
        guild.channels.cache
          .filter((c) => c.parentId === category.id)
          .forEach((c) => {
            c.permissionOverwrites.edit(playerRole, {
              ViewChannel: true,
              SendMessages: c.type === ChannelType.GuildText,
            });
          });
        await i.followUp({
          content: "🎉 Bem-vindo à história!",
          ephemeral: true,
        });
      }
    });

    // 6) Confirmação final
    await interaction.editReply({
      content: `✅ Oneshot **${rawName}** criada em **${categoryName}**!`,
    });
  },
};
