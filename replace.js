import fs from 'fs';
import path from 'path';

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css') || file.endsWith('.html')) {
        results.push(file);
      }
    }
  });
  return results;
};

const srcFiles = walk('./src');
srcFiles.push('./index.html');

srcFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Remplacements stricts et exacts
  content = content.replace(/Pizzaria/g, 'Cave');
  content = content.replace(/pizzeria/g, 'cave');
  content = content.replace(/Pizzas/g, 'Wines');
  content = content.replace(/pizzas/g, 'wines');
  content = content.replace(/Pizza/g, 'Wine');
  content = content.replace(/pizza/g, 'wine');
  content = content.replace(/PIZZAS/g, 'WINES');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated: ${file}`);
  }
});
