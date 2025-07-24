const { EmbedBuilder } = require("discord.js");

const manualEmbed = new EmbedBuilder()
  .setTitle("📜 Manual de Comandos do Mestre Poneizito")
  .setDescription(
    "Bem-vindo ao ArcanaHub! Aqui estão os comandos disponíveis para jogadores e mestres navegarem pelo caos controlado do RPG."
  )
  .setColor("#964B00")
  .addFields(
    {
      name: "🧙‍♂️ /cria_ficha",
      value:
        "Cria uma nova ficha com prompts guiados: raça, classe, atributos, etc.\n" +
        "• **Uso:** `/cria_ficha`\n" +
        "• A imagem do personagem é opcional.\n" +
        "• A ficha é vinculada automaticamente à história (categoria).",
      inline: false,
    },
    {
      name: "🎯 /selecionar_ficha",
      value:
        "Ativa uma das suas fichas para usar nos demais comandos.\n" +
        "• **Uso:** `/selecionar_ficha`\n" +
        "• Apenas uma ficha pode estar ativa por vez.\n" +
        "• A ficha deve estar associada à história atual.",
      inline: false,
    },
    {
      name: "📄 /ver_ficha",
      value:
        "Mostra a ficha ativa (ou de outro jogador, se você for mestre).\n" +
        "• **Uso:** `/ver_ficha`\n" +
        "• Use sem parâmetros para ver sua ficha.",
      inline: false,
    },
    {
      name: "📚 /listar_fichas",
      value:
        "Lista todas as fichas que você criou.\n" +
        "• **Uso:** `/listar_fichas`\n" +
        "• Mostra nome, nível, classe e status de cada ficha.",
      inline: false,
    },
    {
      name: "⚔️ /atacar",
      value:
        "Realiza um ataque com arma equipada ou ataque desarmado.\n" +
        "• **Uso:** `/atacar`\n" +
        "• Considera modificadores da ficha automaticamente.",
      inline: false,
    },
    {
      name: "🛡️ /equipar",
      value:
        "Equipa armas ou armaduras na ficha ativa.\n" +
        "• **Uso:** `/equipar`\n" +
        "• Escolha slot (principal, secundária, armadura) e item.",
      inline: false,
    },
    {
      name: "🎒 /mochila",
      value:
        "Mostra o inventário completo da ficha ativa.\n" +
        "• **Uso:** `/mochila`",
      inline: false,
    },
    {
      name: "💰 /carteira",
      value: "Mostra as moedas da ficha ativa.\n" + "• **Uso:** `/carteira`",
      inline: false,
    },
    {
      name: "✨ /habilidade",
      value:
        "Exibe as habilidades conhecidas da ficha.\n" +
        "• **Uso:** `/habilidade`",
      inline: false,
    },
    {
      name: "🧠 /xp",
      value:
        "Mostra ou modifica a experiência da ficha.\n" +
        "• **Uso (jogador):** `/xp`\n" +
        "• **Uso (mestre):** `/xp jogador:<@alvo> quantidade:<número>`",
      inline: false,
    },
    {
      name: "🏪 /negociar_mercador",
      value:
        "Abre a loja do mercador para comprar ou vender itens.\n" +
        "• **Uso:** `/negociar_mercador mercador:<nome>`",
      inline: false,
    },
    {
      name: "⚙️ Mestre: Gestão de Campanha",
      value:
        "**/create_oneshot** — Cria uma nova história com salas, permissões e cargo de mestre.\n" +
        "**/delete_oneshot** — Exclui uma história existente (com confirmação).\n" +
        "**/mercador_criar** — Cria um mercador com nome personalizado.\n" +
        "**/mercador_adicionar** — Adiciona itens ao inventário do mercador.\n" +
        "**/mercador_habilitar** — Deixa o mercador visível para jogadores.",
      inline: false,
    },
    {
      name: "📌 Dicas Gerais",
      value:
        "• Use comandos dentro da história correspondente (categoria).\n" +
        "• As interações são privadas (ephemeral) por padrão.\n" +
        "• Imagem de ficha deixa tudo mais estiloso, use com carinho.\n" +
        "• Para dúvidas, chame o Mestre ou use o canal de suporte.",
      inline: false,
    }
  )
  .setFooter({ text: "Mestre Poneizito • ArcanaHub" })
  .setTimestamp();

module.exports = { manualEmbed };
