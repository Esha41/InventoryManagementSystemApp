import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

interface CategoryCard {
  id: string;
  name: string;
  nameKey: string;
  image: string;
  route: string;
}

@Component({
  selector: 'app-ammunition-display',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './ammunition-display.component.html',
  styleUrls: ['./ammunition-display.component.css']
})
export class AmmunitionDisplayComponent {
  categories: CategoryCard[] = [
    {
      id: 'ammunition',
      name: 'Ammunition Warehouse',
      nameKey: 'inventoryCategory.ammunitionWarehouse',
      image: 'assets/Ammunition.png',
      route: '/warehouse/ammunition'
    },
    {
      id: 'explosives',
      name: 'Explosives Warehouse',
      nameKey: 'inventoryCategory.explosivesWarehouse',
      image: 'assets/Explosives.png',
      route: '/warehouse/explosives'
    },
    {
      id: 'weapon',
      name: 'Weapon Warehouse',
      nameKey: 'inventoryCategory.weaponWarehouse',
      image: 'assets/Weapon .png',
      route: '/warehouse/weapon'
    }
  ];

  constructor(private router: Router) {}

  onView(category: CategoryCard): void {
    // Navigate to category detail page
    this.router.navigate([category.route]);
  }
}

