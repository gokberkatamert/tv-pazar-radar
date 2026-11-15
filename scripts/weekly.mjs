import fs from 'node:fs';
import path from 'node:path';

/** Compare identical store/listing IDs, not changing catalog-wide averages. */
export function computeWeeklyComparison({today,currentProducts,currentStores,historyDir}) {
  const now=Date.parse(today);
  if(!Number.isFinite(now)||!fs.existsSync(historyDir))return null;
  const snapshots=fs.readdirSync(historyDir).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .map(name=>{try{return JSON.parse(fs.readFileSync(path.join(historyDir,name),'utf8'))}catch{return null}})
    .filter(s=>s?.generatedAt && Number.isFinite(Date.parse(s.generatedAt)))
    // At least six days ago, so repeated runs during one week aren't mislabelled weekly.
    .filter(s=>now-Date.parse(s.generatedAt)>=6*86400000)
    .sort((a,b)=>Date.parse(b.generatedAt)-Date.parse(a.generatedAt));
  const prior=snapshots[0];
  if(!prior)return null;
  const priorProducts=new Map((prior.products||[]).filter(p=>prior.stores?.[p.store]?.ok && Number.isFinite(p.price)).map(p=>[p.id,p]));
  const pairs=(currentProducts||[]).filter(p=>currentStores.has(p.store)&&prior.stores?.[p.store]?.ok&&priorProducts.has(p.id)&&Number.isFinite(p.price)&&priorProducts.get(p.id).price>0)
    .map(p=>({current:p,old:priorProducts.get(p.id)}));
  if(!pairs.length)return {date:prior.generatedAt,matched:0,up:0,down:0,unchanged:0,changePct:null,previousMean:null,currentMean:null,byStore:[],topUp:[],topDown:[],note:'Ortak ve doğrulanmış fiyatlı ürün yok'};
  const change=p=>({id:p.current.id,store:p.current.store,title:p.current.title,brand:p.current.brand,model:p.current.model,url:p.current.url,image:p.current.image,price:p.current.price,previousPrice:p.old.price,delta:Math.round((p.current.price-p.old.price)*100)/100,pct:Math.round((p.current.price-p.old.price)/p.old.price*10000)/100});
  const changed=pairs.map(change);
  const prevMean=pairs.reduce((t,p)=>t+p.old.price,0)/pairs.length;
  const currMean=pairs.reduce((t,p)=>t+p.current.price,0)/pairs.length;
  const pct=prevMean?Math.round((currMean-prevMean)/prevMean*10000)/100:null;
  const byStore=[...new Set(pairs.map(p=>p.current.store))].sort().map(store=>{
    const list=pairs.filter(p=>p.current.store===store);const before=list.reduce((t,p)=>t+p.old.price,0)/list.length;const after=list.reduce((t,p)=>t+p.current.price,0)/list.length;
    return {store,matched:list.length,previousMean:Math.round(before),currentMean:Math.round(after),changePct:Math.round((after-before)/before*10000)/100,up:list.filter(p=>p.current.price>p.old.price).length,down:list.filter(p=>p.current.price<p.old.price).length};
  });
  return {date:prior.generatedAt,matched:pairs.length,previousMean:Math.round(prevMean),currentMean:Math.round(currMean),changePct:pct,
    up:changed.filter(p=>p.delta>0).length,down:changed.filter(p=>p.delta<0).length,unchanged:changed.filter(p=>p.delta===0).length,
    byStore,topUp:changed.filter(p=>p.delta>0).sort((a,b)=>b.pct-a.pct).slice(0,10),topDown:changed.filter(p=>p.delta<0).sort((a,b)=>a.pct-b.pct).slice(0,10)};
}
