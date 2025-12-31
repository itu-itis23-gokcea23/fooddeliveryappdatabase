export type CartItem = {
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
};

export type Cart = {
  restaurant_id: number;
  restaurant_name: string;
  items: CartItem[];
};

const KEY = 'ys_cart_v1';

export function getCart(): Cart | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Cart;
  } catch {
    return null;
  }
}

export function clearCart() {
  localStorage.removeItem(KEY);
}

export function addToCart(next: { restaurant_id: number; restaurant_name: string; menu_item_id: number; name: string; price: number }) {
  const curr = getCart();
  const base: Cart =
    curr && curr.restaurant_id === next.restaurant_id
      ? curr
      : { restaurant_id: next.restaurant_id, restaurant_name: next.restaurant_name, items: [] };

  const idx = base.items.findIndex((i) => i.menu_item_id === next.menu_item_id);
  if (idx >= 0) base.items[idx].quantity += 1;
  else base.items.push({ menu_item_id: next.menu_item_id, name: next.name, price: next.price, quantity: 1 });

  localStorage.setItem(KEY, JSON.stringify(base));
  return base;
}

export function setQuantity(menu_item_id: number, quantity: number) {
  const curr = getCart();
  if (!curr) return null;
  const items = curr.items
    .map((i) => (i.menu_item_id === menu_item_id ? { ...i, quantity } : i))
    .filter((i) => i.quantity > 0);
  const next = { ...curr, items };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function cartTotal(cart: Cart | null): number {
  if (!cart) return 0;
  return cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}


