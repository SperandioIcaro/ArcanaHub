const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

// helper para mod de atributo
const mod = (n) => Math.floor((n - 10) / 2);

// monta escolha de atributos
const Atributos = ['FOR','DES','CON','INT','SAB','CAR'];
const Dados = ['d4','d6','d8','d10','d12','d20','d100'];
const Vantagens = [
  { name: 'normal',    value: 'normal' },
  { name: 'vantagem',  value: 'vantagem' },
  { name: 'desvantagem', value: 'desvantagem' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolar_dado')
    .setDescription('Rola qualquer dado com animação estilo BG3 e aplica mod/advantage')
    .addStringOption(o => 
      o.setName('dado')
       .setDescription('Escolha o dado')
       .setRequired(true)
       .addChoices(...Dados.map(d => ({ name: d, value: d })))
    )
    .addStringOption(o =>
      o.setName('atributo')
       .setDescription('Atributo da ficha (opcional)')
       .setRequired(false)
       .addChoices(...Atributos.map(a=>({ name: a, value: a })))
    )
    .addStringOption(o =>
      o.setName('vantagem')
       .setDescription('Normal / Vantagem / Desvantagem')
       .setRequired(false)
       .addChoices(...Vantagens)
    )
    .addStringOption(o =>
      o.setName('acao')
       .setDescription('Nome da ação (percepção, iniciativa etc.)')
       .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    // gera os rolls conforme advantage/disadvantage
    const tipo = interaction.options.getString('dado'); // ex 'd20'
    const qtd = (tipo === 'd100' ? 1 : 1); // sempre 1 dado
    const sides = parseInt(tipo.slice(1),10);
    const modo = interaction.options.getString('vantagem') || 'normal';

    // função que gera um roll
    const rollOnce = () => Math.floor(Math.random() * sides) + 1;
    let rolls = [rollOnce()];
    if (modo !== 'normal') rolls.push(rollOnce());

    // escolhe o resultado conforme vantagem/desv
    let resultadoRaw = rolls[0];
    if (modo === 'vantagem')      resultadoRaw = Math.max(...rolls);
    else if (modo === 'desvantagem') resultadoRaw = Math.min(...rolls);

    // pega atributo da ficha, se existir
    let bonusAttr = 0;
    const att = interaction.options.getString('atributo');
    if (att) {
      const userDir = path.join(__dirname, '..', 'fichas', 'tormenta20', interaction.user.id);
      const files = await fs.readdir(userDir).catch(()=>[]);
      if (files.length) {
        const ficha = await fs.readJson(path.join(userDir, files[0])).catch(()=>null);
        if (ficha && ficha.atributos?.[att] != null) {
          bonusAttr = mod(ficha.atributos[att]);
        }
      }
    }

    // aguarda e anima
    const embed = new EmbedBuilder()
      .setTitle('🎲 Rolando dados…')
      .setDescription(`⌛ Girando ${tipo}…\n${'🎲'.repeat(qtd)}`)
      .setColor(0xFFA500);
    const msg = await interaction.editReply({ embeds: [embed] });

    // depois de 2s, mostra resultado
    setTimeout(async () => {
      const total = resultadoRaw + bonusAttr;
      const acao = interaction.options.getString('acao') || 'Rolagem';
      let desc = `**${acao}**: \`${tipo}\` → [${rolls.join(' | ')}]`;
      if (modo !== 'normal') desc += ` (${modo})`;
      if (bonusAttr)       desc += `\n📑 Mod ${att}: **${bonusAttr>=0?'+':''}${bonusAttr}**`;
      desc += `\n\n**Total:** **${total}**`;
      embed
        .setTitle('🎲 Resultado!')
        .setDescription(desc)
        .setColor(0x00FF00);
      await msg.edit({ embeds: [embed] });
    }, 2000);
  },
};
