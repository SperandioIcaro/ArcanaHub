const { EmbedBuilder } = require('discord.js');

const manualEmbed = new EmbedBuilder()
  .setTitle('📜 Manual de Comandos do Mestre Poneizito')
  .setDescription('Bem-vindo ao seu sistema de RPG automatizado! Aqui estão os comandos disponíveis para você dominar a campanha.')
  .setColor('#964B00')
  .addFields(
    {
      name: '🔹 /criar_ficha',
      value: 
        `Cria uma ficha completa de personagem em etapas interativas.\n` +
        `• Uso: \`/criar_ficha nome:<nome> nivel:<nível> imagem:<anexo opcional>\`\n` +
        `• Escolha raça, sub-raça, origem, classe, perícias, habilidades.\n` +
        `• Imagem é opcional e pode ser anexada no início.\n` +
        `*Dica:* Use menus e botões para facilitar a seleção.`,
      inline: false
    },
    {
      name: '🔹 /usar_ficha',
      value:
        `Define uma ficha ativa para seus comandos.\n` +
        `• Uso: \`/usar_ficha nome:<nome da ficha>\`\n` +
        `• Apenas uma ficha ativa por vez.\n` +
        `*Dica:* Troque a ficha ativa para controlar diferentes personagens.`,
      inline: false
    },
    {
      name: '🔹 /ver_ficha',
      value:
        `Visualiza fichas de jogadores (somente mestres).\n` +
        `• Uso: \`/ver_ficha jogador:<@usuário>\`\n` +
        `• Após escolher jogador, selecione a ficha desejada.\n` +
        `*Nota:* Jogadores não podem ver fichas dos mestres.`,
      inline: false
    },
    {
      name: '🔹 /listar_fichas',
      value:
        `Lista todas as suas fichas criadas.\n` +
        `• Uso: \`/listar_fichas\`\n` +
        `• Veja nome, nível, classe e ficha ativa.\n` +
        `*Dica:* Conferir suas fichas rápido e fácil.`,
      inline: false
    },
    {
      name: '🔹 Comandos de Gestão de Ficha',
      value:
        `• \`/dmg valor:<n>\` — Aplica dano à ficha ativa.\n` +
        `• \`/cura valor:<n>\` — Aplica cura.\n` +
        `• \`/xp valor:<n>\` — Adiciona XP (subida de nível automática).\n` +
        `• \`/mana valor:<n>\` — Altera mana da ficha.\n` +
        `• \`/eqp item:<nome>\` — Equipa item.\n` +
        `• \`/unq item:<nome>\` — Desequipa item.\n` +
        `• \`/add_item item:<nome>\` — Adiciona item ao inventário.\n` +
        `• \`/rem_item item:<nome>\` — Remove item do inventário.`,
      inline: false
    },
    {
      name: '🔹 /mestre iniciar',
      value:
        `Cria sala de campanha e cargo de mestre.\n` +
        `• Uso: \`/mestre iniciar\`\n` +
        `• Organize campanhas com permissões exclusivas.\n` +
        `*Dica:* Ideal para campanhas privadas e organizadas.`,
      inline: false
    },
    {
      name: '🔹 /resetar_ficha',
      value:
        `Remove sua ficha ativa (irreversível).\n` +
        `• Uso: \`/resetar_ficha\`\n` +
        `• Use com cuidado e confirme antes.`,
      inline: false
    },
    {
      name: '🧠 Dicas Gerais',
      value:
        `• Use comandos em canais apropriados (ex: #🎲・jogadas, #🗂️・fichas).\n` +
        `• Interações são ephemerais (visíveis só para você).\n` +
        `• A imagem da ficha é opcional, mas valoriza o visual.\n` +
        `• Para dúvidas, consulte o mestre ou o canal de suporte.`,
      inline: false
    }
  )
  .setFooter({ text: 'Mestre Poneizito • Seu bot de RPG' })
  .setTimestamp();

module.exports = { manualEmbed };
