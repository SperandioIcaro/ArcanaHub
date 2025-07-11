const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if (command && command.data && command.data.name) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[Aviso] O comando em ${file} está com exportação inválida.`);
  }
}

client.once('ready', () => {
  console.log(`Bot ${client.user.tag} está online!`);
});

client.on('interactionCreate', async interaction => {
  // Comando de chat (slash)
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('Erro executando comando:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Ocorreu um erro ao executar esse comando.',
          ephemeral: true
        });
      }
    }
  }
  // Autocomplete (se você usar)
  else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error('Erro no autocomplete:', error);
    }
  }
  // Componentes: Select Menus, Botões e Modals
  else if (
    interaction.isStringSelectMenu() ||
    interaction.isButton() ||
    interaction.isModalSubmit()
  ) {
    // Descobre de qual comando veio a mensagem original
    let commandName = interaction.message?.interaction?.commandName;
    if (!commandName) {
      // fallback caso não exista
      commandName = 'criar_ficha';
    }
    const command = client.commands.get(commandName);
    if (!command || !command.handleComponent) return;
    try {
      await command.handleComponent(interaction);
    } catch (error) {
      console.error('Erro ao manipular componente:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Erro na interação.',
          ephemeral: true
        });
      }
    }
  }
});

client.login(process.env.TOKEN);
