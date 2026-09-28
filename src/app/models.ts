export interface Product { id:string; name:string; category:string; description:string; ingredients:string; priceCents:number; stock:number; status:'draft'|'active'|'hidden'; image:string; toppingIds:string[] }
export interface Topping { id:string; name:string; priceCents:number; active:boolean }
export interface Settings { whatsapp:string; deliveryMinimumCents:number; ordersEnabled:boolean }
export interface CartLine { key:string; id:string; quantity:number; toppingIds:string[] }
export interface SnapshotLine { id:string; name:string; quantity:number; toppings:string[]; unitCents:number; totalCents:number }
export interface RequestRecord { id:string; kind:'inquiry'|'order'; status:string; createdAt:string; customerName:string; phone?:string; items:SnapshotLine[]; subtotalCents:number; requestedDate:string; delivery:'recoger'|'envio'; address:string; note:string }
export interface Receipt { id:string; code:string; kind:'inquiry'|'order'; subtotalCents:number; whatsapp:string }
export interface Catalog { products:Product[]; toppings:Topping[]; settings:Settings }
export const money = (cents:number) => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(cents/100);
export const proposedProducts:Product[] = [
  {id:'panque-de-limon',name:'Panqué de limón',category:'Panqués',description:'Panqué artesanal de limón con glaseado.',ingredients:'Limón, harina, huevo',priceCents:5200,stock:0,status:'draft',image:'/brand/limon.jpeg',toppingIds:[]},
  {id:'panque-de-zanahoria-y-nuez',name:'Panqué de zanahoria & nuez',category:'Panqués',description:'Una receta casera de zanahoria y nuez.',ingredients:'Zanahoria, nuez, harina, huevo',priceCents:6500,stock:0,status:'draft',image:'',toppingIds:[]},
  {id:'panque-de-platano-con-chocolate',name:'Panqué de plátano con chocolate',category:'Panqués',description:'Panqué casero de plátano y chispas de chocolate semiamargo.',ingredients:'Plátano, chocolate, harina, huevo',priceCents:4500,stock:0,status:'draft',image:'/brand/chocolate.jpeg',toppingIds:['nutella','nuez','almendras','glaseado-extra']},
  {id:'panque-limonada-de-fresa',name:'Panqué “Limonada de fresa”',category:'Panqués',description:'Fresa y limón bajo un glaseado suave.',ingredients:'Fresa, limón, harina, huevo',priceCents:4500,stock:0,status:'draft',image:'/brand/fresa.jpeg',toppingIds:[]},
  {id:'rol-de-oreo',name:'Rol de Oreo',category:'Roles',description:'Masa suave horneada al día, rellena de galleta Oreo y glaseado de la casa.',ingredients:'Masa madre, glaseado, galleta Oreo, mantequilla',priceCents:8500,stock:0,status:'draft',image:'',toppingIds:['nutella','nuez','almendras']}
];
export const proposedToppings:Topping[] = [
  {id:'nutella',name:'Nutella',priceCents:1500,active:true},{id:'nuez',name:'Nuez',priceCents:1500,active:true},
  {id:'almendras',name:'Almendras',priceCents:1500,active:true},{id:'glaseado-extra',name:'Extra glaseado',priceCents:1000,active:true}
];
