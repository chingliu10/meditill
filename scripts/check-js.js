const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function walk(dir) {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const p=path.join(dir,entry.name);
    return entry.isDirectory()?walk(p):[p];
  });
}

const files = [...walk('src'),...walk('database'),...walk('public/js')].filter(f=>f.endsWith('.js'));
for (const file of files) execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
console.log(`Checked ${files.length} JavaScript files`);
