import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ShopService } from './shop.service';
@Component({selector: 'app-root', imports: [RouterOutlet,RouterLink,RouterLinkActive], templateUrl: './app.html', styleUrl: './app.css'})
export class App { shop = inject(ShopService); }
