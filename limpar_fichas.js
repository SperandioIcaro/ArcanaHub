const fs = require('fs-extra');
const path = require('path');

async function limpar() {
  const dir = path.join(__dirname, 'fichas');
  // opcional: faça backup primeiro
  // await fs.move(dir, dir + '_backup', { overwrite: true });
  await fs.emptyDir(dir);
  console.log('Pasta "fichas" limpa com sucesso.');
}

limpar().catch(err => {
  console.error('Erro ao limpar fichas:', err);
  process.exit(1);
});
