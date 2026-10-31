/** Conservative model-code matching: no fuzzy joins, no cross-brand comparisons. */
export const OWN_BRANDS = ['ARÇELİK','BEKO','GRUNDIG'];
export const RETAILERS = ['vatan','mediamarkt','teknosa'];
export const OFFICIAL = ['arcelik','beko','grundig'];
const ascii=s=>String(s||'').toLocaleUpperCase('tr-TR').replace(/İ/g,'I').replace(/Ç/g,'C').replace(/Ğ/g,'G').replace(/Ö/g,'O').replace(/Ş/g,'S').replace(/Ü/g,'U');
export function resolveBrand(title, rawBrand='',store='') {
 const t=ascii(`${rawBrand} ${title}`);
 if(/\bARCELIK\b/.test(t))return 'ARÇELİK';
 if(/\bBEKO\b/.test(t))return 'BEKO';
 if(/\bGRUNDIG\b/.test(t))return 'GRUNDIG';
 const other=ascii(title).match(/\b(SAMSUNG|LG|PHILIPS|TCL|SONY|HISENSE|ONVO|AXEN|SUNNY|PEAQ|THOMSON|VESTEL|TOSHIBA)\b/);
 if(other)return other[1];
 const b=ascii(rawBrand).trim();
 if(b && b.length>1 && b!=='GENERIC' && b!=='BRAND')return b;
 if(OFFICIAL.includes(store))return {arcelik:'ARÇELİK',beko:'BEKO',grundig:'GRUNDIG'}[store];
 return ascii(title).trim().split(/\s+/)[0]||'';
}
export function modelCode(title, brand, hinted='') {
 // Restrict to exact recognizable identifiers, not just diagonal size or marketing language.
 const str=ascii(`${hinted} ${title}`).replace(/[^A-Z0-9]+/g,' ');
 let match;
 if(brand==='ARÇELİK')match=str.match(/\bA\s?(?:6|7|8|9|10|12|14)\d{2}\s?[A-Z](?:\s?AI)?\b/) || str.match(/\bA\s?\d{3,4}\s?[A-Z]\b/);
 else if(brand==='BEKO')match=str.match(/\bB\s?\d{3,4}\s?[A-Z](?:\s?AI)?\b/);
 else if(brand==='GRUNDIG')match=str.match(/\b(?:\d{2}\s?)?(?:GHU|GOU|GCU|GUB|GUT|GUR|GUS|GWN|GKU)\s?\d{3,5}\s?[A-Z]?\b/);
 else return '';
 return match ? match[0].replace(/\s+/g,'').replace(/AI$/,'') : '';
}
export function enrich(p) {
 const brand=resolveBrand(p.title,p.brand,p.store);
 const model=modelCode(p.title,brand,p.model);
 return {...p,brand,model,matchKey:model?`${brand}:${model}`:''};
}
export function comparisons(products) {
 const groups=new Map();
 products.forEach(p=>{if(!OWN_BRANDS.includes(p.brand)||!p.matchKey||!Number.isFinite(p.price))return;const a=groups.get(p.matchKey)||[];a.push(p);groups.set(p.matchKey,a)});
 const out=[];
 for(const [key,items] of groups){
  const official=items.filter(p=>OFFICIAL.includes(p.store)&& ({arcelik:'ARÇELİK',beko:'BEKO',grundig:'GRUNDIG'}[p.store]===p.brand));
  const retail=items.filter(p=>RETAILERS.includes(p.store));
  if(!official.length||!retail.length)continue;
  const base=official.sort((a,b)=>a.price-b.price)[0];
  for(const shop of retail){out.push({key,brand:shop.brand,model:shop.model,retailer:shop.store,retailerPrice:shop.price,retailerUrl:shop.url,retailerImage:shop.image,officialStore:base.store,officialPrice:base.price,officialUrl:base.url,delta:Math.round((shop.price-base.price)*100)/100,pct:Math.round((shop.price-base.price)/base.price*10000)/100,title:shop.title})}
 }
 return out.sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct));
}
