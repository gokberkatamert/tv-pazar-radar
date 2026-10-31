import fs from 'node:fs';
const d=JSON.parse(fs.readFileSync('data/latest.json','utf8'));
const names={vatan:'Vatan Bilgisayar',mediamarkt:'MediaMarkt',teknosa:'Teknosa',arcelik:'Arçelik Resmi',beko:'Beko Resmi',grundig:'Grundig Resmi'};
const summary=[`TV RADAR — Haftalık yönetici özeti`,`Tarih: ${d.generatedAt||'Tarama henüz yapılmadı'}`,`Toplam TV ilanı: ${d.products.length}`,`Fiyat düşüşü: ${d.changes.filter(p=>p.delta<0).length}`,`Fiyat artışı: ${d.changes.filter(p=>p.delta>0).length}`,`Yeni gözlenen ilan: ${d.newProducts.length}`,`Aynı model koduyla resmi site/perakende eşleşmesi: ${(d.comparisons||[]).length}`,`28+ günlük ortak ilan fiyat değişimi: ${d.monthComparison?d.monthComparison.changePct+'% ('+d.monthComparison.matched+' ilan)':'Henüz yeterli veri yok'}`,...Object.entries(d.stores||{}).map(([k,s])=>`${names[k]}: ${s.count} | ${s.ok?'başarılı':`kısmi/başarısız: ${s.error||''}`}`),`Dashboard: ${process.env.DASHBOARD_URL||'(Vercel URL ayarlanmadı)'}`];
const top=d.changes.slice().sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).slice(0,15);
for(const p of (d.comparisons||[]).slice(0,12))summary.push(`RESMİ KIYAS | ${p.brand} ${p.model} | ${names[p.retailer]} ${p.retailerPrice} TL / ${names[p.officialStore]} ${p.officialPrice} TL | fark ${p.pct}% | ${p.retailerUrl} | ${p.officialUrl}`);
for(const p of top)summary.push(`${names[p.store]} | ${p.title} | ${p.previousPrice} → ${p.price} TL (${p.pct}%) | ${p.url}`);
const text=summary.join('\n');console.log(text);fs.writeFileSync('data/report-latest.txt',text+'\n');
const {RESEND_API_KEY,REPORT_EMAIL_TO,REPORT_EMAIL_FROM}=process.env;
if(RESEND_API_KEY&&REPORT_EMAIL_TO&&REPORT_EMAIL_FROM){
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:REPORT_EMAIL_FROM,to:REPORT_EMAIL_TO.split(',').map(x=>x.trim()),subject:`TV Radar · Haftalık TV fiyat raporu · ${new Date().toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'})}`,text})});
 if(!response.ok){console.error('Email delivery failed',response.status,await response.text());process.exitCode=1}else console.log('Email provider accepted report');
}else console.log('Email not configured; dashboard and saved report still updated.');
