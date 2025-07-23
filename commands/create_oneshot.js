// commands/create_oneshot.js
const ICONS = ['🔥','🛡️','⚔️','🧙','🐉','🌌','💀','🏹','🗺️','🔮'];
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

// Load available mechanics dynamically from /mechanics directory
const mechanicsDir = path.join(__dirname, '..', 'mechanics');
const availableMechanics = fs.readdirSync(mechanicsDir)
  .filter(file => fs.statSync(path.join(mechanicsDir, file)).isDirectory());

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create_oneshot')
    .setDescription('Cria uma categoria + canais para uma oneshot')
    .addStringOption(opt => 
      opt.setName('name')
         .setDescription('Nome da campanha')
         .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('mechanic')
         .setDescription('Sistema de regras para a oneshot')
         .setRequired(true)
         .addChoices(
           ...availableMechanics.map(m => ({ name: m, value: m }))
         )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // 0) Captura opções
    const rawName = interaction.options.getString('name');
    const mech = interaction.options.getString('mechanic');
    const guild   = interaction.guild;
    const userId  = interaction.user.id;
    const roleName = `mestre${userId}`;

    // 1) Cria cargo exclusivo para o mestre
    let mestreRole = guild.roles.cache.find(r => r.name === roleName);
    if (!mestreRole) {
      mestreRole = await guild.roles.create({
        name: roleName,
        mentionable: false,
        permissions: [
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ViewChannel
        ]
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
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] }
      ]
    });

    // 4) Define canais de texto
    const channels = [
      { name: 'sessao',    overwrites: [
          { id: guild.roles.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      },
      { name: 'rolagens',  overwrites: [
          { id: guild.roles.everyone, allow: [PermissionFlagsBits.AddReactions], deny: [PermissionFlagsBits.SendMessages] }
        ]
      },
      { name: 'fichas',    overwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: mestreRole.id,        allow: [PermissionFlagsBits.ViewChannel] },
          { id: userId,               allow: [PermissionFlagsBits.ViewChannel] }
        ]
      },
      { name: 'npcs-mobs', overwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: mestreRole.id,        allow: [PermissionFlagsBits.ViewChannel] }
        ]
      }
    ];

    // 5) Cria canais de texto na categoria
    for (const ch of channels) {
      await guild.channels.create({
        name: ch.name,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: ch.overwrites
      });
    }

    // 6) Cria canal de voz
    await guild.channels.create({
      name: 'sala-de-voz',
      type: ChannelType.GuildVoice,
      parent: category,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.Connect] },
        { id: mestreRole.id,        allow: [PermissionFlagsBits.Connect] }
      ]
    });

    // 7) Resposta final
    try {
      await interaction.editReply({ 
        content: `✅ Oneshot **${rawName}** criada com sucesso sob o sistema **${mech}** como **${categoryName}**!`
      });
    } catch (err) {
      console.error("Erro ao responder a interação:", err);
    }
  }
};
