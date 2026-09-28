import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CartLine, Product, Receipt, RequestRecord, Settings, SnapshotLine, Topping, proposedProducts, proposedToppings } from './models';
@Injectable({providedIn:'root'})
export class ShopService {
  private http=inject(HttpClient);
  products=signal<Product[]>(proposedProducts);
  toppings=signal<Topping[]>(proposedToppings);
  settings=signal<Settings>({whatsapp:'',deliveryMinimumCents:15000,ordersEnabled:false});
  error=signal('');
  cart=signal<CartLine[]>(this.readCart());
  quantity=computed(()=>this.cart().reduce((n,x)=>n+x.quantity,0));
  subtotal=computed(()=>this.cart().reduce((n,x)=>n+this.lineTotal(x),0));
  inquiryMode=computed(()=>!this.settings().ordersEnabled || this.cart().some(line=>{
    const p=this.products().find(x=>x.id===line.id);
    const requested=this.cart().filter(x=>x.id===line.id).reduce((n,x)=>n+x.quantity,0);
    return !p || p.status!=='active' || p.stock<requested;
  }));
  constructor(){effect(()=>localStorage.setItem('blisscocho-angular-cart',JSON.stringify(this.cart())));this.reload();}
  private readCart():CartLine[]{try{const value=JSON.parse(localStorage.getItem('blisscocho-angular-cart')||'[]');return Array.isArray(value)?value:[]}catch{return []}}
  async reload(){this.products.set(proposedProducts);this.toppings.set(proposedToppings);this.settings.set({whatsapp:'',deliveryMinimumCents:15000,ordersEnabled:false});this.error.set('')}
  product(id:string){return this.products().find(p=>p.id===id)}
  topping(id:string){return this.toppings().find(t=>t.id===id)}
  lineTotal(line:CartLine){const p=this.product(line.id);return (p?.priceCents||0)*line.quantity + line.toppingIds.reduce((n,id)=>n+(this.topping(id)?.priceCents||0)*line.quantity,0)}
  add(id:string,qty=1,ids:string[]=[]){const key=id+'::'+[...ids].sort().join(',');this.cart.update(lines=>{const found=lines.find(x=>x.key===key);return found?lines.map(x=>x.key===key?{...x,quantity:Math.min(99,x.quantity+qty)}:x):[...lines,{key,id,quantity:Math.min(99,qty),toppingIds:ids}]})}
  update(key:string,delta:number){this.cart.update(lines=>lines.map(x=>x.key===key?{...x,quantity:Math.min(99,x.quantity+delta)}:x).filter(x=>x.quantity>0))}
  remove(key:string){this.cart.update(lines=>lines.filter(x=>x.key!==key))}
  clear(){this.cart.set([])}
  async submit(input:{customerName:string;phone:string;note:string;requestedDate:string;delivery:'recoger'|'envio';address:string}){
    const kind=this.inquiryMode()?'inquiry':'order';
    const result=await firstValueFrom(this.http.post<Receipt>('/api/requests',{...input,kind,items:this.cart().map(({id,quantity,toppingIds})=>({id,quantity,toppingIds}))}));
    sessionStorage.setItem('blisscocho-angular-last-request',JSON.stringify({id:result.id,code:result.code}));this.clear();await this.reload();return result;
  }
  async lookup(id:string,code:string){return firstValueFrom(this.http.post<RequestRecord>('/api/lookup',{id:id.toUpperCase().trim(),code:code.toUpperCase().trim()}))}
  lastRequest():{id:string;code:string}|null{try{return JSON.parse(sessionStorage.getItem('blisscocho-angular-last-request')||'null')}catch{return null}}
}
