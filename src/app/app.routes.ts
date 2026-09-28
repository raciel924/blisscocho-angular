import { Routes } from '@angular/router';
import { LandingPage, CatalogPage, DetailPage, StoryPage, CartPage, CheckoutPage, LookupPage } from './customer.pages';
import { AdminPage } from './admin.page';
export const routes: Routes = [
  {path:'',component:LandingPage,title:'Blisscocho · Repostería artesanal'},
  {path:'postres',component:CatalogPage,title:'Postres · Blisscocho'},
  {path:'postres/:id',component:DetailPage,title:'Detalle · Blisscocho'},
  {path:'nuestra-historia',component:StoryPage,title:'Nuestra historia · Blisscocho'},
  {path:'carrito',component:CartPage,title:'Carrito · Blisscocho'},
  {path:'pedidos',component:CheckoutPage,title:'Hacer pedido · Blisscocho'},
  {path:'mi-pedido',component:LookupPage,title:'Mi pedido · Blisscocho'},
  {path:'admin',component:AdminPage,title:'Administración · Blisscocho'},
  {path:'**',redirectTo:''}
];
