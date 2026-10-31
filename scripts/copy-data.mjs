import fs from 'node:fs';
import path from 'node:path';
// Vite doesn't copy arbitrary root-level data. Publish snapshot files to /data.
const src=path.resolve('data'),dst=path.resolve('dist/data');
fs.mkdirSync(dst,{recursive:true});
for(const name of ['latest.json','report-latest.txt']){
 const file=path.join(src,name);if(fs.existsSync(file))fs.copyFileSync(file,path.join(dst,name));
}
console.log('Published snapshot files into dist/data');
