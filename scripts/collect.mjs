import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {enrich,comparisons,OFFICIAL} from './model.mjs';
const ROOT=process.cwd(),DATA=path.join(ROOT,'data');
const sources={
 vatan:{url:'https://www.vatanbilgisayar.com/televizyon/',maxPages:16},
 mediamarkt:{url:'https://www.mediamarkt.com.tr/tr/category/televizyon-465019.html',maxPages:38},
 teknosa:{url:'https://www.teknosa.com/televizyon-c-101001',maxPages:32},
 arcelik:{url:'https://www.arcelik.com.tr/televizyon',maxPages:14},
 beko:{url:'https://www.beko.com.tr/televizyon',maxPages:14},
 grundig:{url:'https://www.grundig.com.tr/televizyon',maxPages:14}
};
const read=f=>{try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return null}};
const previous=read(path.join(DATA,'latest.json'))||{products:[],stores:{}};
const today=new Date().toISOString();
function normalize(p,store){
 try{
  if(!p.title||!p.url||!Number.isFinite(p.price)||p.price<=0)return null;
  const url=new URL(p.url,sources[store].url);if(!/https?:/.test(url.protocol)||!url.hostname.endsWith(new URL(sources[store].url).hostname.replace(/^www\./,'')))return null;
  url.search='';url.hash='';
  const title=String(p.title).replace(/\s+/g,' ').trim().slice(0,280);
  const brand=String(p.brand||'').trim().toUpperCase();
  const model=(p.model||'').trim().slice(0,100);
  let image='';try{if(p.image)image=new URL(p.image, url).href}catch{}
  const id=`${store}:${url.pathname.toLowerCase().replace(/\/$/,'')}`;
  return enrich({id,store,title,brand,model,price:Math.round(p.price*100)/100,url:url.href,image});
 }catch{return null}
}
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
let output=[],stores={},failed=0;
for(const [store,cfg] of Object.entries(sources)){
 const context=await browser.newContext({locale:'tr-TR',viewport:{width:1440,height:1000},userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'});
 const page=await context.newPage();let all=new Map(),attempts=0,expectedCount=null,error='';
 page.setDefaultTimeout(7000);
 try{
  for(let n=0;n<cfg.maxPages;n++){
   attempts++;
   const url=new URL(cfg.url);
   if(n>0){ if(store==='teknosa')url.searchParams.set('page',String(n));else url.searchParams.set('page',String(n+1)); }
   const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:35000});
   if(response?.status()>=400)throw Error(`HTTP ${response.status()}`);
   await page.waitForTimeout(1700);
   // Dynamic load-more controls: scroll through the listing, then click when available.
   for(let i=0;i<16;i++){
    await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    await page.waitForTimeout(430);
    const btn=page.getByText(/(?:12 ürün daha göster|daha fazla ürün gör|daha fazla göster|load more)/i).last();
    if(await btn.count()&&await btn.isVisible().catch(()=>false)){
     try{await btn.click({timeout:1800});await page.waitForTimeout(900)}catch{}
    }else if(i>3)break;
   }
   const found=await page.evaluate(({store})=>{
    const result=[];const seen=new Set();
    const money=v=>{if(typeof v==='number')return v;const s=String(v||'').replace(/\s/g,'');let m=s.match(/(?:₺|TL)?([\d.,]+)(?:₺|TL)?/i);if(!m)return NaN;let a=m[1];if(a.includes(',')&&a.includes('.'))a=a.replace(/\./g,'').replace(',','.');else if(a.includes(','))a=a.replace(',','.');else if(/^\d{1,3}(?:\.\d{3})+$/.test(a))a=a.replace(/\./g,'');return Number(a)};
    function add(p){if(!p?.url||!p.title||!Number.isFinite(p.price)||p.price<=0)return;const k=p.url;if(seen.has(k))return;seen.add(k);result.push(p)}
    const unwrap=o=>Array.isArray(o)?o.flatMap(unwrap):o?.['@graph']?unwrap(o['@graph']):o?[o]:[];
    for(const s of document.querySelectorAll('script[type="application/ld+json"]')){
      try{for(const obj of unwrap(JSON.parse(s.textContent))){
       if(obj['@type']==='Product'){let offer=Array.isArray(obj.offers)?obj.offers[0]:obj.offers;add({title:obj.name,url:obj.url||offer?.url,price:money(offer?.price||offer?.lowPrice),image:Array.isArray(obj.image)?obj.image[0]:obj.image,brand:typeof obj.brand==='object'?obj.brand.name:obj.brand,model:obj.mpn||obj.sku})}
       if(obj['@type']==='ItemList'){for(const el of obj.itemListElement||[]){let it=el.item||el;let offer=Array.isArray(it.offers)?it.offers[0]:it.offers;add({title:it.name,url:it.url,price:money(offer?.price),image:Array.isArray(it.image)?it.image[0]:it.image})}}
      }}catch{}
    }
    // Site listing anchor + enclosing card; exclude accessories, links without a plausible product price.
    const anchors=[...document.querySelectorAll('a[href]')];
    for(const a of anchors){
     const href=a.getAttribute('href')||'';
     const match=store==='mediamarkt'?/\/tr\/product\//i.test(href):store==='teknosa'?/-p-\d+/i.test(href):store==='vatan'?/\/[^/]+\.html(?:\?|$)/i.test(href):/\/(?:televizyon|tv|[^/]+)\/[^/?#]+(?:\?.*)?$/i.test(href) && !/\/(?:kategori|category|blog|kampanya|support|yardim)\//i.test(href);
     if(!match)continue;
     let card=a.closest('[data-testid*="product"],article,li[class*="product"],div[class*="product-card"],div[class*="productCard"],div[class*="product-item"],div[class*="product-item"]');
     if(!card){let el=a;for(let depth=0;depth<5&&el;depth++,el=el.parentElement){if(el.querySelectorAll('a[href]').length<=6&&/\b(?:TL|₺)\b|₺|\d[.,]\d{3}\s*TL/.test(el.innerText||'')){card=el;break}}}
     if(!card)continue;
     const title=(a.getAttribute('title')||a.querySelector('img')?.alt||a.innerText||card.querySelector('h2,h3,h4')?.innerText||'').trim();
     if(title.length<9)continue;
     let price=NaN;
     const priceEls=[...card.querySelectorAll('[itemprop="price"],[data-testid*="price"],[class*="sales-price"],[class*="price-current"],[class*="priceCurrent"],[class*="price__current"],[class*="price"]')];
     for(const e of priceEls){const v=e.getAttribute('content')||e.innerText||'';if(v.length>45)continue;const parsed=money(v);if(parsed>500){price=parsed;break}}
     if(!Number.isFinite(price)){
      const m=(card.innerText||'').match(/(?:₺\s*|\b)(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{4,7}(?:,\d{2})?)\s*(?:TL|₺|,–)?/i);
      if(m)price=money(m[1]);
     }
     const img=card.querySelector('img');
     add({title,url:a.href,price,image:img?.getAttribute('data-src')||img?.getAttribute('src')||img?.getAttribute('srcset')?.split(',')[0]?.split(' ')[0]||'',brand:''});
    }
    const text=document.body.innerText||'';
    const counts=store==='vatan'?[...text.matchAll(/(?:modellerinde\s+)(\d+)\s+adet ürün/g)]:store==='teknosa'?[...text.matchAll(/(\d+)\s+Sonuç/g)]:['arcelik','beko','grundig'].includes(store)?[...text.matchAll(/(\d+)\s+ürün listelendi/g)]:[...text.matchAll(/\((\d+)\s+ürün\)/g)];
    return {products:result,expectedCount:counts.length?Number(counts[0][1]):null};
   },{store});
   for(const raw of found.products){const p=normalize(raw,store);if(p && (!OFFICIAL.includes(store)||p.brand===({arcelik:'ARÇELİK',beko:'BEKO',grundig:'GRUNDIG'}[store])))all.set(p.id,p)}
   if(found.expectedCount&&(!expectedCount||found.expectedCount>expectedCount))expectedCount=found.expectedCount;
   console.log(`[${store}] page=${n+1} total=${all.size} expected=${expectedCount||'unknown'}`);
   if(expectedCount&&all.size>=expectedCount)break;
   if(n>0&&all.size===lastSize)break;
   var lastSize=all.size;
  }
  if(all.size<5)throw Error(`Too few product entries (${all.size}); website may block requests or markup changed`);
  // Guard against truncated runs: never compare or replace old data if coverage collapses.
  const oldCount=previous.stores?.[store]?.count||0;
  if(oldCount>=20&&all.size<oldCount*0.65)throw Error(`Coverage below 65% of previous count (${all.size}/${oldCount})`);
  // Official category pages can include other brands; do not compare brand-filtered count with category total.
  const complete=OFFICIAL.includes(store)?all.size>=5:!!expectedCount&&all.size>=Math.floor(expectedCount*.85);
  if(!complete)error=`Kapsam doğrulanamadı: ${all.size}/${expectedCount||'?'} ilan; karşılaştırma devre dışı`;
  output.push(...all.values());stores[store]={ok:complete,count:all.size,expectedCount,attempts, ...(error?{error}:{})};
 }catch(e){failed++;error=String(e.message||e);console.error(`[${store}] ${error}`);stores[store]={ok:false,count:0,expectedCount,attempts,error};}
 await context.close();
}
await browser.close();
if(!output.length){console.error('All stores failed: preserving previous snapshot');process.exit(1)}
const oldMap=new Map(previous.products.map(p=>[p.id,p]));
const currentStores=new Set(Object.entries(stores).filter(([,v])=>v.ok).map(([s])=>s));
// Incomplete or blocked stores retain old listings and are not used to generate false "removed"/"new" changes.
for(const p of previous.products){if(!currentStores.has(p.store))output.push(p)}
const productMap=new Map(output.map(p=>[p.id,p]));output=[...productMap.values()].sort((a,b)=>a.store.localeCompare(b.store)||a.title.localeCompare(b.title,'tr'));
const hasBaseline=!!previous.generatedAt;
const changes=[],newProducts=[],removedProducts=[];
for(const p of output){if(!currentStores.has(p.store)||!hasBaseline)continue;const old=oldMap.get(p.id);
 if(!old){newProducts.push(p);continue}
 if(old.price!==p.price){const delta=Math.round((p.price-old.price)*100)/100;changes.push({...p,previousPrice:old.price,delta,pct:Math.round(delta/old.price*10000)/100})}
}
if(hasBaseline)for(const old of previous.products){if(currentStores.has(old.store)&&!productMap.has(old.id))removedProducts.push(old)}
const priceMean=ps=>ps.length?Math.round(ps.reduce((a,p)=>a+p.price,0)/ps.length):null;
const history=[...(previous.history||[]),{date:today,total:output.length,changes:changes.length,newProducts:newProducts.length,meanPrice:priceMean(output.filter(p=>['vatan','mediamarkt','teknosa'].includes(p.store))),stores}].slice(-104);
const matches=comparisons(output.filter(p=>currentStores.has(p.store)));
// Month-over-month means are calculated using the same retailer + product IDs in both snapshots.
const monthAgo=new Date(today);monthAgo.setUTCDate(monthAgo.getUTCDate()-28);
const files=fs.existsSync(path.join(DATA,'history'))?fs.readdirSync(path.join(DATA,'history')).filter(f=>f.endsWith('.json')).sort():[];
const candidate=files.map(f=>read(path.join(DATA,'history',f))).filter(d=>d?.generatedAt&&new Date(d.generatedAt)<=monthAgo).sort((a,b)=>b.generatedAt.localeCompare(a.generatedAt))[0];
let monthComparison=null;
if(candidate){const prior=new Map(candidate.products.filter(p=>['vatan','mediamarkt','teknosa'].includes(p.store)&&candidate.stores?.[p.store]?.ok).map(p=>[p.id,p]));const same=output.filter(p=>['vatan','mediamarkt','teknosa'].includes(p.store)&&currentStores.has(p.store)&&prior.has(p.id));if(same.length>=5){const was=same.reduce((a,p)=>a+prior.get(p.id).price,0)/same.length;const now=same.reduce((a,p)=>a+p.price,0)/same.length;monthComparison={date:candidate.generatedAt,matched:same.length,previousMean:Math.round(was),currentMean:Math.round(now),changePct:Math.round((now-was)/was*10000)/100,up:same.filter(p=>p.price>prior.get(p.id).price).length,down:same.filter(p=>p.price<prior.get(p.id).price).length}}}
const result={generatedAt:today,products:output,changes,newProducts,removedProducts,stores,history,comparisons:matches,monthComparison,status:failed?'partial':'ok',baselineDate:previous.baselineDate||today};
fs.mkdirSync(path.join(DATA,'history'),{recursive:true});const stamp=today.slice(0,10);
fs.writeFileSync(path.join(DATA,'history',`${stamp}.json`),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(DATA,'latest.json'),JSON.stringify(result,null,2));
console.log(`Saved ${output.length} products | ${changes.length} price changes | ${newProducts.length} new listings`);
