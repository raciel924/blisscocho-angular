import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products as seedProducts, toppings as seedToppings } from './seed.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dbPath=process.env.DB_FILE || path.join(root,'data','blisscocho.db');
await mkdir(path.dirname(dbPath),{recursive:true});
const db=new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS toppings(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,kind TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,customer_name TEXT NOT NULL,phone TEXT NOT NULL,items_json TEXT NOT NULL,subtotal_cents INTEGER NOT NULL,requested_date TEXT NOT NULL,delivery TEXT NOT NULL,address TEXT NOT NULL,note TEXT NOT NULL,lookup_hash TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);`);
for(const p of seedProducts)db.prepare('INSERT OR IGNORE INTO products(id,data) VALUES(?,?)').run(p.id,JSON.stringify(p));
for(const t of seedToppings)db.prepare('INSERT OR IGNORE INTO toppings(id,data) VALUES(?,?)').run(t.id,JSON.stringify(t));
for(const [key,value] of Object.entries({whatsapp:'',deliveryMinimumCents:'15000',ordersEnabled:'false'}))db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(key,value);
const all=(table)=>db.prepare(`SELECT data FROM ${table}`).all().map(row=>JSON.parse(row.data));
const product=(id)=>{const row=db.prepare('SELECT data FROM products WHERE id=?').get(id);return row?JSON.parse(row.data):null};
const setting=()=>Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.key==='whatsapp'?x.value:x.key==='ordersEnabled'?x.value==='true':Number(x.value)]));
const send=(res,status,data)=>{const payload=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(payload)});res.end(payload)};
const failure=(status,message)=>Object.assign(new Error(message),{status});
const hash=(s)=>createHash('sha256').update(s).digest('hex');
const cookieName='blisscocho_admin';
const sessions=new Map();
const cookie=(req)=>req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.split('=')[1] || '';
const admin=(req)=>{const token=cookie(req);const exp=sessions.get(hash(token));if(!token||!exp||exp<Date.now())throw failure(401,'Inicia sesión como administrador.')};
const sameOrigin=(req)=>{const origin=req.headers.origin;if(!origin || new URL(origin).hostname !== (req.headers.host||'').split(':')[0])throw failure(403,'Origen no permitido.')};
async function body(req,limit=16000){let length=0,chunks=[];for await(const chunk of req){length+=chunk.length;if(length>limit)throw failure(413,'Solicitud demasiado grande.');chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw failure(400,'Datos inválidos.')}}
const recent=new Map();function rate(req){const key=req.socket.remoteAddress||'local';const entry=recent.get(key)||{at:Date.now(),count:0};if(Date.now()-entry.at>60000){entry.at=Date.now();entry.count=0}entry.count++;recent.set(key,entry);if(entry.count>30)throw failure(429,'Espera un momento antes de continuar.')}
function safeRequest(row,forAdmin=false){const {lookup_hash,items_json,phone,...rest}=row;return {...rest,items:JSON.parse(items_json),...(forAdmin?{phone}:{})}}
function validateRequest(input){
  if(!input||!['inquiry','order'].includes(input.kind)||!Array.isArray(input.items)||!input.items.length||input.items.length>20||typeof input.customerName!=='string'||input.customerName.trim().length<2||input.customerName.length>100||typeof input.phone!=='string'||!/^\+?[0-9 ()-]{10,22}$/.test(input.phone)||typeof input.note!=='string'||input.note.length>500||typeof input.address!=='string'||input.address.length>300||!['recoger','envio'].includes(input.delivery)||input.delivery==='envio'&&input.address.trim().length<8)throw failure(400,'Revisa tus datos y la selección.');
  const day=String(input.requestedDate||'');const parsed=new Date(day+'T12:00:00Z');const tomorrow=new Date();tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==day||day<tomorrow.toISOString().slice(0,10)||parsed.getTime()>Date.now()+90*86400000)throw failure(400,'Elige una fecha válida dentro de los próximos 90 días.');
  const catalog=new Map(all('products').map(p=>[p.id,p]));const extras=new Map(all('toppings').map(t=>[t.id,t]));const qtys=new Map();const lines=[];
  for(const line of input.items){if(!line||typeof line.id!=='string'||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99||!Array.isArray(line.toppingIds)||line.toppingIds.length>10||new Set(line.toppingIds).size!==line.toppingIds.length)throw failure(400,'Revisa los postres.');
    const p=catalog.get(line.id);if(!p||p.status==='hidden')throw failure(409,'Un postre ya no está disponible.');
    const chosen=line.toppingIds.map(id=>extras.get(id));if(chosen.some((t,i)=>!t||!t.active||!p.toppingIds.includes(line.toppingIds[i])))throw failure(409,'Un topping ya no está disponible.');
    qtys.set(p.id,(qtys.get(p.id)||0)+line.quantity);
    const unitCents=p.priceCents+chosen.reduce((n,t)=>n+t.priceCents,0);
    lines.push({id:p.id,name:p.name,quantity:line.quantity,toppings:chosen.map(t=>t.name),unitCents,totalCents:unitCents*line.quantity});
  }
  const settings=setting();const subtotal=lines.reduce((n,l)=>n+l.totalCents,0);
  if(input.delivery==='envio'&&subtotal<settings.deliveryMinimumCents)throw failure(409,'No alcanzas el mínimo para envío.');
  if(input.kind==='order'&&(!settings.ordersEnabled||[...qtys].some(([id,n])=>catalog.get(id).status!=='active'||catalog.get(id).stock<n)))throw failure(409,'No hay existencias para registrar este pedido. Puedes enviar una consulta.');
  return {lines,qtys,subtotal,settings};
}
function createRequest(input){const {lines,qtys,subtotal,settings}=validateRequest(input);const code=randomBytes(16).toString('hex').toUpperCase(),id=(input.kind==='order'?'BL-':'BC-')+randomBytes(4).toString('hex').toUpperCase(),now=new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');try{
    if(input.kind==='order')for(const [productId,n] of qtys){const p=product(productId);if(!p||p.status!=='active'||p.stock<n)throw failure(409,'Las existencias cambiaron. Revisa tu selección.');p.stock-=n;db.prepare('UPDATE products SET data=? WHERE id=?').run(JSON.stringify(p),productId)}
    db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,input.kind,input.kind==='order'?'new':'inquiry',now,now,input.customerName.trim(),input.phone.trim(),JSON.stringify(lines),subtotal,input.requestedDate,input.delivery,input.address.trim(),input.note.trim(),hash(code));
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
  return {id,code,kind:input.kind,subtotalCents:subtotal,whatsapp:settings.whatsapp};
}
function changeStatus(id,status){const row=db.prepare('SELECT * FROM requests WHERE id=?').get(id);if(!row)throw failure(404,'Solicitud no encontrada.');const allowed={inquiry:['contacted'],contacted:['closed'],new:['confirmed','cancelled'],confirmed:['preparing','cancelled'],preparing:['ready','cancelled'],ready:['delivered','cancelled']};if(!allowed[row.status]?.includes(status))throw failure(409,'El estado cambió. Actualiza la bandeja.');
  db.exec('BEGIN IMMEDIATE');try{
    if(status==='cancelled')for(const line of JSON.parse(row.items_json)){const p=product(line.id);if(p){p.stock+=line.quantity;db.prepare('UPDATE products SET data=? WHERE id=?').run(JSON.stringify(p),p.id)}}
    db.prepare('UPDATE requests SET status=?,updated_at=? WHERE id=? AND status=?').run(status,new Date().toISOString(),id,row.status);db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
}
function validateProduct(p){if(!p||!/^[-a-z0-9]{2,60}$/.test(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!['Panqués','Roles','Otros'].includes(p.category)||!['draft','active','hidden'].includes(p.status)||!Number.isInteger(p.priceCents)||p.priceCents<0||p.priceCents>1e6||!Number.isInteger(p.stock)||p.stock<0||p.stock>1e5||typeof p.description!=='string'||p.description.length>1000||typeof p.ingredients!=='string'||p.ingredients.length>500||!Array.isArray(p.toppingIds)||!p.toppingIds.every(id=>typeof id==='string'&&/^[-a-z0-9]+$/.test(id))||typeof p.image!=='string'||p.image&&!/^\/(brand|uploads)\/[a-zA-Z0-9.-]+$/.test(p.image))throw failure(400,'Revisa los datos del postre.');return {...p,name:p.name.trim()}}
function validateTopping(t){if(!t||!/^[-a-z0-9]{2,60}$/.test(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>80||!Number.isInteger(t.priceCents)||t.priceCents<0||t.priceCents>1e5||typeof t.active!=='boolean')throw failure(400,'Revisa el topping.');return t}
async function upload(req,res){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4500000)throw failure(413,'Imagen demasiado grande.');chunks.push(chunk)}const web=new Request('http://localhost/upload',{method:'POST',headers:{'content-type':req.headers['content-type']||''},body:Buffer.concat(chunks)});const form=await web.formData();const file=form.get('image');if(!file||typeof file==='string'||file.size>4e6||!['image/png','image/jpeg','image/webp'].includes(file.type))throw failure(400,'Elige una imagen JPG, PNG o WebP de hasta 4 MB.');const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];const name=randomUUID()+'.'+ext;const dir=path.join(root,'public','uploads');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,name),Buffer.from(await file.arrayBuffer()));send(res,201,{url:'/uploads/'+name})}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
async function serveStatic(req,res,pathname){let base=process.argv.includes('--static')?path.join(root,'dist','blisscocho-angular','browser'):path.join(root,'public');let relative=decodeURIComponent(pathname).replace(/^\/+/, '');if(!relative)relative='index.html';let target=path.resolve(base,relative);if(!target.startsWith(base+path.sep)&&target!==base)throw failure(403,'Ruta no permitida.');if(!existsSync(target)){if(relative.startsWith('uploads/'))target=path.resolve(root,'public',relative);else if(process.argv.includes('--static'))target=path.join(base,'index.html');else throw failure(404,'Archivo no encontrado.')}
  const info=await stat(target);if(!info.isFile())throw failure(404,'Archivo no encontrado.');res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Content-Length':info.size});res.end(await readFile(target));}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url||'/',`http://${req.headers.host}`),route=url.pathname;
  if(route==='/api/catalog'&&req.method==='GET')return send(res,200,{products:all('products').filter(p=>p.status!=='hidden'),toppings:all('toppings'),settings:setting()});
  if(route==='/api/requests'&&req.method==='POST'){sameOrigin(req);rate(req);return send(res,201,createRequest(await body(req)))}
  if(route==='/api/lookup'&&req.method==='POST'){sameOrigin(req);rate(req);const input=await body(req);if(!/^B[LC]-[A-F0-9]{8}$/.test(input.id)||!/^[A-F0-9]{32}$/.test(input.code))throw failure(404,'Número o código incorrecto.');const row=db.prepare('SELECT * FROM requests WHERE id=?').get(input.id);if(!row||row.lookup_hash!==hash(input.code))throw failure(404,'No encontramos una solicitud con ese número y código.');return send(res,200,safeRequest(row))}
  if(route==='/api/admin/login'&&req.method==='POST'){sameOrigin(req);rate(req);if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<12)throw failure(503,'Configura ADMIN_PASSWORD (mínimo 12 caracteres) en el servidor.');const input=await body(req),a=Buffer.from(String(input.password||'')),b=Buffer.from(process.env.ADMIN_PASSWORD);if(a.length!==b.length||!timingSafeEqual(a,b))throw failure(401,'Clave incorrecta.');const token=randomBytes(32).toString('hex');sessions.set(hash(token),Date.now()+8*3600000);res.setHeader('Set-Cookie',`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='1'?'; Secure':''}`);return send(res,200,{ok:true})}
  if(route==='/api/admin/logout'&&req.method==='POST'){sameOrigin(req);sessions.delete(hash(cookie(req)));res.setHeader('Set-Cookie',`${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);return send(res,200,{ok:true})}
  if(route.startsWith('/api/admin/')){admin(req);if(req.method!=='GET')sameOrigin(req);
    if(route==='/api/admin/state'&&req.method==='GET')return send(res,200,{products:all('products'),toppings:all('toppings'),settings:setting(),requests:db.prepare('SELECT * FROM requests ORDER BY created_at DESC LIMIT 200').all().map(x=>safeRequest(x,true))});
    if(route==='/api/admin/product'&&req.method==='PUT'){const p=validateProduct(await body(req));db.prepare('INSERT INTO products(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(p.id,JSON.stringify(p));return send(res,200,{ok:true})}
    if(route==='/api/admin/topping'&&req.method==='PUT'){const t=validateTopping(await body(req));db.prepare('INSERT INTO toppings(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(t.id,JSON.stringify(t));return send(res,200,{ok:true})}
    if(route==='/api/admin/settings'&&req.method==='PUT'){const s=await body(req);if(typeof s.ordersEnabled!=='boolean'||!Number.isInteger(s.deliveryMinimumCents)||s.deliveryMinimumCents<0||s.deliveryMinimumCents>1e6||typeof s.whatsapp!=='string'||!/^\d{0,15}$/.test(s.whatsapp)||s.whatsapp&&s.whatsapp.length<10)throw failure(400,'Revisa la configuración.');if(s.ordersEnabled&&!all('products').some(p=>p.status==='active'&&p.stock>0))throw failure(409,'Publica un postre con stock antes de activar pedidos.');for(const [k,v] of Object.entries(s))db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,String(v));return send(res,200,{ok:true})}
    if(route==='/api/admin/status'&&req.method==='PUT'){const {id,status}=await body(req);changeStatus(id,status);return send(res,200,{ok:true})}
    if(route==='/api/admin/upload'&&req.method==='POST')return await upload(req,res);
  }
  if(route.startsWith('/api/'))throw failure(404,'No encontrado.');
  if(req.method==='GET')return await serveStatic(req,res,route);
  throw failure(405,'Método no permitido.');
}catch(error){console.error(error);send(res,error.status||500,{error:error.status?error.message:'Ocurrió un error en el servidor.'})}});
const port=Number(process.env.PORT||3001);server.listen(port,()=>console.log(`Blisscocho API en http://localhost:${port}`));
