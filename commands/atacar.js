const fs = require('fs-extra');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function rollD20() {
  return 1 + Math.floor(Math.random() * 20);
}
function mod(attr) {
  return Math.floor((attr - 10) / 2);
}

// Rola um termo "NdM", retorna { rolls: [...], total }
function rolarTermo(term) {
  const m = term.match(/(\d+)d(\d+)/);
  if (!m) return { rolls: [], total: 0 };
  const [, qtd, faces] = m.map(Number);
  const rolls = Array.from({ length: qtd }, () => 1 + Math.floor(Math.random() * faces));
  return { rolls, total: rolls.reduce((a,b)=>a+b, 0) };
}

// Rola uma expressão como "1d12 + 1d4 + 3", retorna { groups: [{term, rolls, total}], constantSum }
function rolarExpressao(expr) {
  const parts = expr.split('+').map(p => p.trim());
  const groups = [];
  let constantSum = 0;

  for (const p of parts) {
    const termo = rolarTermo(p);
    if (termo.rolls.length) {
      groups.push({ term: p, rolls: termo.rolls, total: termo.total });
    } else if (!isNaN(Number(p))) {
      constantSum += Number(p);
    }
  }

  return { groups, constantSum };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('atacar')
    .setDescription('Faz um ataque com arma equipada ou mão livre')
    .addStringOption(o =>
      o.setName('arma')
        .setDescription('Selecione sua arma ou "mão livre"')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(o =>
      o.setName('modo')
        .setDescription('Modo de ataque (se disponível)')
        .addChoices(
          { name: 'Corpo a Corpo', value: 'cc' },
          { name: 'Distância',     value: 'alcance' }
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const userId = interaction.user.id;
    const ativas = await fs.readJson(path.join(__dirname, '../fichas/ativas.json')).catch(() => ({}));
    const ativa = ativas[userId]; if (!ativa) return interaction.respond([]);
    const ficha = await fs.readJson(path.join(__dirname, '../fichas', ativa.mecanica, userId, ativa.arquivo)).catch(() => null);
    if (!ficha) return interaction.respond([]);

    const equips = ficha.equipados || {};
    const opcoes = ['mão livre', equips.arma_principal, equips.arma_secundaria].filter(Boolean);
    return interaction.respond(
      opcoes
        .filter(i => i.toLowerCase().includes(focused.toLowerCase()))
        .slice(0,25)
        .map(i => ({ name: i, value: i }))
    );
  },

  async execute(interaction) {
    const userId = interaction.user.id;
    const ativas = await fs.readJson(path.join(__dirname, '../fichas/ativas.json')).catch(() => ({}));
    const ativa = ativas[userId];
    if (!ativa) return interaction.reply({ content: '❌ Você ainda não selecionou uma ficha.', ephemeral: true });

    const fichaPath = path.join(__dirname, '../fichas', ativa.mecanica, userId, ativa.arquivo);
    if (!await fs.pathExists(fichaPath)) {
      return interaction.reply({ content: '❌ Ficha ativa não encontrada.', ephemeral: true });
    }
    const ficha = await fs.readJson(fichaPath);

    const escolha = interaction.options.getString('arma').toLowerCase();
    const modoOpt = interaction.options.getString('modo'); // 'cc' ou 'alcance'
    const equips = ficha.equipados || {};
    const todasEquips = [equips.arma_principal, equips.arma_secundaria].filter(Boolean);

    const isMaoLivre = escolha === 'mão livre';
    if (!isMaoLivre && !todasEquips.some(a => a.toLowerCase() === escolha)) {
      return interaction.reply({ content: `❌ Você não está usando **${escolha}**.`, ephemeral: true });
    }

    let armaConfig = null;
    if (!isMaoLivre) {
      const allArmas = require(path.join(__dirname, '..', 'mechanics', 'tormenta20', 'armas.json'));
      armaConfig = allArmas.find(a => a.nome.toLowerCase() === escolha);
      if (!armaConfig) {
        return interaction.reply({ content: `❌ Dados da arma **${escolha}** não encontrados.`, ephemeral: true });
      }
    }

    // determina modo
    let modo = 'cc';
    if (!isMaoLivre) {
      if (modoOpt) modo = modoOpt;
      else {
        const props = armaConfig.propriedades.join(' ').toLowerCase();
        if (/arremesso/.test(props) || /armas de longo alcance|besta|arco|pistola|mosquete/.test(armaConfig.categoria)) {
          modo = 'alcance';
        }
      }
      if (modo === 'alcance' && !/arremesso/.test(armaConfig.propriedades.join(' ').toLowerCase())) {
        return interaction.reply({ content: `❌ **${armaConfig.nome}** não possui ataque de alcance.`, ephemeral: true });
      }
    }

    // 1) Ataque
    const nat = rollD20();
    const atributo = (modo === 'alcance') ? 'DES' : 'FOR';
    const atributoMod = mod(ficha.atributos[atributo] ?? 10);
    const prof = isMaoLivre ? 0 : (Math.ceil(ficha.nivel/4)+1);
    const bonusArma = isMaoLivre ? 0 : (armaConfig.bonus||0);
    const totalAtaque = nat + atributoMod + prof + bonusArma;
    const isCrit = (!isMaoLivre && modo==='cc' && nat >= armaConfig.cri_treshold);

    // 2) Dano
    let danoTotal=0;
    let detalheRolls='';
    if (isMaoLivre) {
      // mão livre: 1d3 + FOR
      const { rolls, total } = rolarTermo('1d3');
      danoTotal = total + atributoMod;
      detalheRolls = `${rolls.join(', ')} + (${atributoMod>=0?'+':''}${atributoMod})`;
    } else {
      // arma: dano expr pode ser "1d12 + 1d4" etc
      const expr = armaConfig.dano;
      const { groups, constantSum } = rolarExpressao(expr);
      // soma dados
      let sumDice = 0;
      const partes = [];
      groups.forEach(g => {
        let t = g.rolls.join(',');
        partes.push(`[${g.term}: ${t}]`);
        sumDice += g.total;
      });
      if (constantSum) {
        partes.push(constantSum.toString());
      }
      // crítico: dobra todas as rolagens de dado (multiplica totalDice por multiplier)
      if (isCrit) {
        const extra = sumDice * (armaConfig.cri_multiplier - 1);
        sumDice = sumDice * armaConfig.cri_multiplier;
        partes.push(`x${armaConfig.cri_multiplier} (crítico)`);
      }
      // agora bônus for/bonusArma
      danoTotal = sumDice + atributoMod + bonusArma;
      if (atributoMod) partes.push(`(${atributoMod>=0?'+':''}${atributoMod})`);
      if (bonusArma)    partes.push(`+${bonusArma}`);
      detalheRolls = partes.join(' + ');
    }

    // 3) Embed
    const titulo = isMaoLivre
      ? `🤜 Ataque Corpo-a-Corpo (Mão Livre)`
      : `${isCrit ? '💥 CRÍTICO!' : '⚔️ Ataque'} — ${armaConfig.nome} (${modo})`;

    const embed = new EmbedBuilder()
      .setTitle(titulo)
      .addFields(
        { name:'🎲 Rolagem',      value:`${nat}`, inline:true },
        { name:'Mod Atributo',   value:`${atributoMod>=0?'+':''}${atributoMod}`, inline:true },
        { name:'Proficiência',   value: prof>0?`+${prof}`:'-', inline:true },
        { name:'Bônus Arma',     value:`${bonusArma>=0?'+':''}${bonusArma}`, inline:true },
        { name:'🏆 Total ATA',    value:`${totalAtaque}`, inline:true },
        { name:'💥 DANO',        value:`${detalheRolls} = **${danoTotal}**`, inline:false }
      )
      .setColor(isCrit?0xff0000:0x00cc66);

    return interaction.reply({ embeds:[embed] });
  }
};
