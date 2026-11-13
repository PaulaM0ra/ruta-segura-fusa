import express from'express';import dotenv from'dotenv';dotenv.config();const app=express();app.use(express.json());app.use(express.static('public'));
const TYPES=['Vidrio roto','Aguja o elemento punzante','Metal cortante','Residuo biológico','Residuo químico','Otro peligro'];
function local(m){
 const t=m.toLowerCase(); let type='Otro peligro',risk='Amarillo';
 const medical=/hospital|clínic|clinica|médic|medic|quirúrg|quirurg|sangre|biológ|biolog|infecc|gasa|guante contaminado|material de curación|residuo sanitario/.test(t);
 const needle=/aguja|jeringa|lanceta|bistur[ií]|punzocortante|cortopunzante/.test(t);
 if(needle) type='Aguja o elemento punzante';
 else if(medical) type='Residuo biológico';
 else if(/vidrio|botella|cristal|espejo/.test(t)) type='Vidrio roto';
 else if(/lata|metal|cuchill|alambre|lámina|lamina/.test(t)) type='Metal cortante';
 else if(/químic|quimic|ácido|acido|solvente|pintura|veneno|mercurio/.test(t)) type='Residuo químico';
 if(medical||needle||/suelto|derrame|urgente|niñ|vía pública|via publica/.test(t)) risk='Rojo';
 else if(/roto|cortante|peligro|contaminado/.test(t)) risk='Naranja';
 const recommendation=(medical||needle)
  ?'No manipular directamente. Aislar el área, usar un recipiente rígido identificado y solicitar manejo por personal autorizado.'
  :type==='Vidrio roto'?'Empacar en caja resistente, cerrar y marcar como vidrio roto.'
  :'Separar, empacar de forma resistente y marcar el peligro.';
 return{type,risk,recommendation,confidence:.78,source:'clasificador local'};
}
async function classify(message){const key=process.env.GEMINI_API_KEY;if(!key||key==='PEGA_AQUI_TU_CLAVE')return local(message);const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';const u=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;const prompt=`Clasifica este reporte de residuos. Devuelve JSON. Categorías: ${TYPES.join(', ')}. Riesgo: Amarillo, Naranja o Rojo. REGLAS OBLIGATORIAS: todo residuo hospitalario, clínico, biológico, con sangre, aguja, jeringa, bisturí o material potencialmente infeccioso se clasifica ROJO. Un objeto cortante roto se clasifica mínimo NARANJA. No inventes ubicación. Reporte: ${message}`;const body={contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{type:{type:'STRING',enum:TYPES},risk:{type:'STRING',enum:['Amarillo','Naranja','Rojo']},recommendation:{type:'STRING'},confidence:{type:'NUMBER'}},required:['type','risk','recommendation','confidence']}}};const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d?.error?.message||'Error Gemini');const out=JSON.parse(d.candidates[0].content.parts[0].text);const t=message.toLowerCase();const medical=/hospital|clínic|clinica|médic|medic|quirúrg|quirurg|sangre|biológ|biolog|infecc|gasa|jeringa|aguja|lanceta|bistur[ií]|material de curación|residuo sanitario/.test(t);if(medical){out.risk='Rojo';if(/aguja|jeringa|lanceta|bistur[ií]/.test(t))out.type='Aguja o elemento punzante';else out.type='Residuo biológico';out.recommendation='No manipular directamente. Aislar el área, usar un recipiente rígido identificado y solicitar manejo por personal autorizado.'}else if(/vidrio|cristal|botella rota|cortante/.test(t)&&out.risk==='Amarillo')out.risk='Naranja';return{...out,source:`Google Gemini (${model})`}}
app.get('/api/health',(q,s)=>s.json({ok:true,geminiConfigured:!!process.env.GEMINI_API_KEY&&process.env.GEMINI_API_KEY!=='PEGA_AQUI_TU_CLAVE',model:process.env.GEMINI_MODEL||'gemini-2.5-flash'}));
app.post('/api/classify',async(q,s)=>{try{s.json(await classify(String(q.body.message||'')))}catch(e){s.json({...local(q.body.message||''),warning:e.message})}});
const KNOWN={
 'centro':[4.337,-74.364],'balmoral':[4.329,-74.371],'la venta':[4.346,-74.357],
 'la pampa':[4.330,-74.381],'pekín':[4.342,-74.352],'pekin':[4.342,-74.352],
 'lucero':[4.333,-74.358],'santa anita':[4.322,-74.369],'la gran colombia':[4.340,-74.370],
 'villa patria':[4.326,-74.362],'comuneros':[4.331,-74.353],'san mateo':[4.344,-74.366]
};
function norm(x){return x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function insideFusa(lat,lng){return lat>=4.25&&lat<=4.43&&lng>=-74.45&&lng<=-74.28}
app.get('/api/geocode',async(q,s)=>{
 try{
  const address=String(q.query.address||q.query.barrio||'').trim();
  if(!address)return s.status(400).json({error:'Escribe un barrio, dirección o punto de referencia.',manual:true,lat:4.336,lng:-74.364});
  const queries=[`${address}, Fusagasugá, Cundinamarca, Colombia`,`${address}, Fusagasugá, Colombia`,address];
  let candidates=[];
  for(const text of queries){
   const u=new URL('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates');
   u.searchParams.set('SingleLine',text);u.searchParams.set('f','json');u.searchParams.set('maxLocations','10');u.searchParams.set('location','-74.36378,4.33646');u.searchParams.set('distance','25000');u.searchParams.set('outFields','Match_addr,Addr_type');
   const d=await(await fetch(u)).json();candidates.push(...(d.candidates||[]));
  }
  const inside=x=>x.location.y>=4.25&&x.location.y<=4.43&&x.location.x>=-74.45&&x.location.x<=-74.28;
  candidates=candidates.filter(inside).sort((a,b)=>b.score-a.score);
  const c=candidates[0];
  if(!c||c.score<55)return s.status(404).json({error:'No se encontró la dirección con seguridad. Selecciona el punto manualmente en el mapa.',manual:true,lat:4.336,lng:-74.364});
  s.json({lat:+c.location.y.toFixed(5),lng:+c.location.x.toFixed(5),address:c.address,score:c.score,needsReview:true});
 }catch(e){s.status(500).json({error:'No fue posible buscar la dirección. Selecciona el punto manualmente.',manual:true,lat:4.336,lng:-74.364})}
});
app.listen(process.env.PORT||3000,()=>console.log('http://localhost:'+(process.env.PORT||3000)));
