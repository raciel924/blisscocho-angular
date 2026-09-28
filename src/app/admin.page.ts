import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Product, RequestRecord, Settings, Topping, money } from './models';
import { ShopService } from './shop.service';

type AdminState={products:Product[];toppings:Topping[];settings:Settings;requests:RequestRecord[]};
const problem=(e:any)=>e?.error?.error||'No se pudo guardar. Inténtalo de nuevo.';

@Component({imports:[CommonModule,FormsModule],template:`
<main class="section admin">
  <div class="admin-heading"><div><small class="eyebrow">PERFIL ADMINISTRADOR</small><h1>Panel Blisscocho</h1></div>@if(logged){<button class="text-link" (click)="logout()">Cerrar sesión</button>}</div>
  @if(!logged){<div class="login-panel"><h2>Acceso privado</h2><p>Introduce la clave configurada en el servidor. Los clientes no pueden abrir este panel.</p><form (ngSubmit)="login()"><label>Contraseña<input type="password" [(ngModel)]="password" name="password" autocomplete="current-password" required/></label><button class="button" [disabled]="busy">{{busy?'Entrando…':'Entrar al panel →'}}</button></form>@if(error){<p class="error" role="alert">{{error}}</p>}</div>}
  @else {
    <nav class="admin-tabs" aria-label="Secciones del panel">
      @for(tab of tabs;track tab.key){<button [class.selected]="section===tab.key" (click)="section=tab.key">{{tab.label}}</button>}
    </nav>
    @if(message){<p class="success-note" role="status">{{message}}</p>}
    @if(error){<p class="error" role="alert">{{error}}</p>}
    @if(section==='resumen'){
      <div class="stats"><article><small>Consultas abiertas</small><strong>{{count('inquiry')}}</strong></article><article><small>Pedidos por atender</small><strong>{{count('new')}}</strong></article><article><small>Productos activos</small><strong>{{activeCount()}}</strong></article></div>
      <div class="admin-card"><h2>Actividad reciente</h2>@for(r of state?.requests?.slice(0,5);track r.id){<div class="request-compact"><b>{{r.id}}</b><span>{{r.customerName}} · {{statusName(r.status)}}</span><button class="text-link" (click)="section='solicitudes'">Abrir →</button></div>}@empty{<p>Aún no hay solicitudes.</p>}</div>
    }
    @if(section==='catalogo'){
      <div class="section-title"><h2>Catálogo y existencias</h2><button class="button" (click)="newProduct()">+ Nuevo postre</button></div>
      <p class="notice">Los precios son propuestas hasta que los confirmes. Cambia a “Activo” y asigna existencias cuando esté listo.</p>
      <div class="admin-grid"><div class="admin-card">@for(p of state?.products;track p.id){<button class="admin-list-item" [class.selected]="editing?.id===p.id" (click)="editProduct(p)"><span><b>{{p.name}}</b><small>{{p.category}} · {{statusName(p.status)}} · Stock {{p.stock}}</small></span><strong>{{money(p.priceCents)}}</strong></button>}</div>
      @if(editing){<form class="admin-card edit-form" (ngSubmit)="saveProduct()"><h3>{{isNew?'Crear postre':'Editar postre'}}</h3><label>Identificador (URL)<input [(ngModel)]="editing.id" name="id" [disabled]="!isNew" pattern="[-a-z0-9]{2,60}" required/></label><label>Nombre<input [(ngModel)]="editing.name" name="name" required maxlength="100"/></label><div class="form-grid"><label>Categoría<select [(ngModel)]="editing.category" name="category"><option>Panqués</option><option>Roles</option><option>Otros</option></select></label><label>Estado<select [(ngModel)]="editing.status" name="status"><option value="draft">Borrador</option><option value="active">Activo</option><option value="hidden">Oculto</option></select></label><label>Precio MXN<input type="number" [(ngModel)]="pricePesos" name="price" min="0" step="0.01" required/></label><label>Existencias<input type="number" [(ngModel)]="editing.stock" name="stock" min="0" step="1" required/></label></div><label>Descripción<textarea [(ngModel)]="editing.description" name="description" maxlength="1000" rows="3"></textarea></label><label>Ingredientes y alérgenos<textarea [(ngModel)]="editing.ingredients" name="ingredients" maxlength="500" rows="2"></textarea></label><label>Ruta de imagen<input [(ngModel)]="editing.image" name="image" placeholder="/brand/imagen.jpeg"/></label><label>Cargar imagen<input type="file" accept="image/jpeg,image/png,image/webp" (change)="upload($event)"/></label><fieldset><legend>Toppings disponibles</legend>@for(t of state?.toppings;track t.id){<label class="check"><input type="checkbox" [checked]="editing.toppingIds.includes(t.id)" (change)="toggleTopping(t.id,$any($event.target).checked)"/>{{t.name}}</label>}</fieldset><button class="button" [disabled]="busy">{{busy?'Guardando…':'Guardar postre'}}</button></form>}</div>
    }
    @if(section==='toppings'){
      <div class="section-title"><h2>Toppings</h2><button class="button" (click)="newTopping()">+ Nuevo topping</button></div>
      <div class="admin-grid"><div class="admin-card">@for(t of state?.toppings;track t.id){<button class="admin-list-item" (click)="editTopping(t)"><span><b>{{t.name}}</b><small>{{t.active?'Disponible':'Inactivo'}}</small></span><strong>{{money(t.priceCents)}}</strong></button>}</div>
      @if(extra){<form class="admin-card edit-form" (ngSubmit)="saveTopping()"><h3>{{newExtra?'Crear topping':'Editar topping'}}</h3><label>Identificador<input [(ngModel)]="extra.id" name="id" [disabled]="!newExtra" pattern="[-a-z0-9]{2,60}" required/></label><label>Nombre<input [(ngModel)]="extra.name" name="name" maxlength="80" required/></label><label>Precio MXN<input type="number" [(ngModel)]="extraPesos" name="price" min="0" step="0.01" required/></label><label class="check"><input type="checkbox" [(ngModel)]="extra.active" name="active"/>Disponible en el catálogo</label><button class="button" [disabled]="busy">Guardar topping</button></form>}</div>
    }
    @if(section==='solicitudes'){
      <h2>Consultas y pedidos</h2><p class="notice">Las consultas no apartan producto. Los pedidos activos descuentan existencias; al cancelar se restituyen.</p>
      <div class="request-list">@for(r of state?.requests;track r.id){<article class="admin-card request-card"><div class="request-top"><div><small class="eyebrow">{{r.kind==='inquiry'?'CONSULTA':'PEDIDO'}} · {{r.id}}</small><h3>{{r.customerName}}</h3></div><b class="status-pill">{{statusName(r.status)}}</b></div><p><a [href]="'tel:'+r.phone">{{r.phone}}</a> · {{r.requestedDate}} · {{r.delivery==='envio'?'Entrega':'Recolección'}}</p>@if(r.address){<p>Dirección: {{r.address}}</p>}@if(r.note){<p>Nota: {{r.note}}</p>}@for(line of r.items;track $index){<p>{{line.quantity}} × {{line.name}} @if(line.toppings.length){+ {{line.toppings.join(', ')}}} · {{money(line.totalCents)}}</p>}<strong>Subtotal: {{money(r.subtotalCents)}}</strong><div class="actions">@for(option of nextStatuses(r.status);track option){<button class="button outline" [disabled]="busy" (click)="changeStatus(r,option)">{{statusName(option)}} →</button>}</div></article>}@empty{<div class="empty">No hay solicitudes todavía.</div>}</div>
    }
    @if(section==='configuracion' && state){<div class="admin-card settings-card"><h2>Configuración</h2><p>Activa los pedidos solo cuando el catálogo, los precios y las existencias estén revisados.</p><form (ngSubmit)="saveSettings()"><label>WhatsApp de la tienda (código país, solo dígitos)<input [(ngModel)]="state.settings.whatsapp" name="whatsapp" placeholder="529981234567" maxlength="15"/></label><label>Mínimo para envío MXN<input type="number" [(ngModel)]="minimumPesos" name="minimum" min="0" step="0.01" required/></label><label class="check"><input type="checkbox" [(ngModel)]="state.settings.ordersEnabled" name="enabled"/>Activar pedidos con reserva de existencias</label><button class="button" [disabled]="busy">Guardar configuración</button></form></div>}
  }
</main>`})
export class AdminPage implements OnInit {
  private http=inject(HttpClient);private shop=inject(ShopService);
  money=money;logged=false;busy=false;password='';error='';message='';
  section='resumen';tabs=[{key:'resumen',label:'Resumen'},{key:'catalogo',label:'Catálogo'},{key:'toppings',label:'Toppings'},{key:'solicitudes',label:'Solicitudes'},{key:'configuracion',label:'Configuración'}];
  state:AdminState|null=null;editing:Product|null=null;isNew=false;pricePesos=0;extra:Topping|null=null;newExtra=false;extraPesos=0;minimumPesos=150;
  async ngOnInit(){await this.refresh(true)}
  async refresh(silent=false){try{this.state=await firstValueFrom(this.http.get<AdminState>('/api/admin/state'));this.logged=true;this.minimumPesos=this.state.settings.deliveryMinimumCents/100;await this.shop.reload()}catch(e:any){if(e.status===401){this.logged=false;this.state=null}else if(!silent)this.error=problem(e)}}
  async login(){this.busy=true;this.error='';try{await firstValueFrom(this.http.post('/api/admin/login',{password:this.password}));this.password='';await this.refresh();this.message='Sesión iniciada.'}catch(e){this.error=problem(e)}finally{this.busy=false}}
  async logout(){try{await firstValueFrom(this.http.post('/api/admin/logout',{}))}finally{this.logged=false;this.state=null;this.password='';this.message=''}}
  async act(action:()=>Promise<unknown>,success:string){this.busy=true;this.error='';this.message='';try{await action();await this.refresh();this.message=success}catch(e){this.error=problem(e)}finally{this.busy=false}}
  count(status:string){return this.state?.requests.filter(r=>r.status===status).length||0}
  activeCount(){return this.state?.products.filter(p=>p.status==='active').length||0}
  statusName(s:string){return ({inquiry:'Consulta recibida',contacted:'Contactado',closed:'Cerrada',new:'Nuevo',confirmed:'Confirmado',preparing:'En preparación',ready:'Listo',delivered:'Entregado',cancelled:'Cancelado',draft:'Borrador',active:'Activo',hidden:'Oculto'} as Record<string,string>)[s]||s}
  nextStatuses(s:string){return ({inquiry:['contacted'],contacted:['closed'],new:['confirmed','cancelled'],confirmed:['preparing','cancelled'],preparing:['ready','cancelled'],ready:['delivered','cancelled']} as Record<string,string[]>)[s]||[]}
  editProduct(p:Product){this.editing=structuredClone(p);this.isNew=false;this.pricePesos=p.priceCents/100;this.error=''}
  newProduct(){this.editing={id:'',name:'',category:'Panqués',description:'',ingredients:'',priceCents:0,stock:0,status:'draft',image:'',toppingIds:[]};this.isNew=true;this.pricePesos=0}
  toggleTopping(id:string,on:boolean){if(this.editing)this.editing.toppingIds=on?[...this.editing.toppingIds,id]:this.editing.toppingIds.filter(x=>x!==id)}
  saveProduct(){if(!this.editing)return;const p={...this.editing,priceCents:Math.round(this.pricePesos*100)};this.act(()=>firstValueFrom(this.http.put('/api/admin/product',p)),'Postre guardado.');this.isNew=false}
  editTopping(t:Topping){this.extra=structuredClone(t);this.newExtra=false;this.extraPesos=t.priceCents/100}
  newTopping(){this.extra={id:'',name:'',priceCents:0,active:true};this.newExtra=true;this.extraPesos=0}
  saveTopping(){if(!this.extra)return;const t={...this.extra,priceCents:Math.round(this.extraPesos*100)};this.act(()=>firstValueFrom(this.http.put('/api/admin/topping',t)),'Topping guardado.');this.newExtra=false}
  saveSettings(){if(!this.state)return;const s={...this.state.settings,deliveryMinimumCents:Math.round(this.minimumPesos*100)};this.act(()=>firstValueFrom(this.http.put('/api/admin/settings',s)),'Configuración guardada.')}
  changeStatus(r:RequestRecord,status:string){this.act(()=>firstValueFrom(this.http.put('/api/admin/status',{id:r.id,status})),`${r.id}: ${this.statusName(status)}.`)}
  async upload(event:Event){const file=(event.target as HTMLInputElement).files?.[0];if(!file||!this.editing)return;this.busy=true;this.error='';try{const form=new FormData();form.append('image',file);const result=await firstValueFrom(this.http.post<{url:string}>('/api/admin/upload',form));this.editing.image=result.url;this.message='Imagen cargada. Guarda el postre para aplicarla.'}catch(e){this.error=problem(e)}finally{this.busy=false}}
}
