// Clothify — minimal e‑commerce demo (client-side only)
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const currency = n => `QAR ${n.toFixed(2)}`;

// ----- State (localStorage) -----
const CART_KEY = "clothify_cart";
const WISHLIST_KEY = "clothify_wishlist";

const cart = {
  get items(){ return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); },
  set items(v){ localStorage.setItem(CART_KEY, JSON.stringify(v)); },
  add(product, size, qty = 1){
    const items = this.items;
    const existing = items.find(i => i.id === product.id && i.size === size);
    const addQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
    if(existing){ existing.qty += addQty; }
    else { items.push({ id: product.id, name: product.name, price: product.price, image: product.image, size, qty: addQty }); }
    this.items = items;
    updateCartCount();
    showNotification(`${product.name} x${addQty} added to cart!`, 'success');
  },
  update(id, size, delta){
    const items = this.items.map(i => (i.id===id && i.size===size) ? {...i, qty: Math.max(1, i.qty+delta)} : i);
    this.items = items;
    renderCart();
  },
  remove(id, size){
    const items = this.items.filter(i => !(i.id===id && i.size===size));
    this.items = items;
    renderCart();
    showNotification('Item removed from cart', 'info');
  },
  clear(){ this.items = []; renderCart(); updateCartCount(); }
};

const wishlist = {
  get items(){ return JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]"); },
  set items(v){ localStorage.setItem(WISHLIST_KEY, JSON.stringify(v)); },
  add(product){
    const items = this.items;
    const existing = items.find(i => i.id === product.id);
    if(!existing) {
      items.push({ id: product.id, name: product.name, price: product.price, image: product.image, category: product.category });
      this.items = items;
      updateWishlistCount();
      showNotification(`${product.name} added to wishlist!`, 'success');
      return true;
    }
    return false;
  },
  remove(id){
    const items = this.items.filter(i => i.id !== id);
    this.items = items;
    updateWishlistCount();
    renderWishlist();
    showNotification('Item removed from wishlist', 'info');
  },
  has(id){
    return this.items.some(i => i.id === id);
  }
};

// ----- Utilities -----
function updateCartCount(){
  const count = cart.items.reduce((s,i)=>s+i.qty,0);
  const el = $("#cart-count");
  if(el) el.textContent = count;
}

function updateWishlistCount(){
  const count = wishlist.items.length;
  const el = $("#wishlist-count");
  if(el) el.textContent = count;
}

function setYear(){ const y = $("#year"); if(y) y.textContent = new Date().getFullYear(); }

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 100);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function filterByPriceRange(products, range) {
  if (!range) return products;
  
  if (range === '200+') {
    return products.filter(p => p.price >= 200);
  }
  
  const [min, max] = range.split('-').map(Number);
  return products.filter(p => p.price >= min && p.price <= max);
}

// ----- Shop (index.html) -----
async function loadProducts(){
  const grid = $("#products");
  if (grid) grid.innerHTML = `<p class="muted">Loading products…</p>`;
  let all = [];
  try {
    const res = await fetch("products.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    all = await res.json();
  } catch (err) {
    console.error("Failed to load products:", err);
    if (grid) {
      grid.innerHTML = `
        <div class="card">
          <p class="muted">We couldn't load products right now. Please check your internet connection and try again.</p>
        </div>`;
    }
    return;
  }

  const q = ($("#search")?.value || "").toLowerCase();
  const cat = $("#category")?.value || "";
  const sort = $("#sort")?.value || "";
  const priceRange = $("#price-range")?.value || "";
  
  let list = all.filter(p =>
    (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) &&
    (!cat || p.category === cat)
  );
  
  list = filterByPriceRange(list, priceRange);
  
  if(sort==="price-asc") list.sort((a,b)=>a.price-b.price);
  if(sort==="price-desc") list.sort((a,b)=>b.price-a.price);
  if(sort==="name-asc") list.sort((a,b)=>a.name.localeCompare(b.name));
  if(sort==="name-desc") list.sort((a,b)=>b.name.localeCompare(a.name));

  if (!grid) return;
  if(list.length === 0){
    grid.innerHTML = `<p class="muted">No products match your filters.</p>`;
    return;
  }

  grid.innerHTML = list.map(p => `
    <article class="card">
      <div class="card-image">
        <a href="product.html?id=${encodeURIComponent(p.id)}"><img alt="${p.name}" src="${p.image}"></a>
        <button class="wishlist-btn ${wishlist.has(p.id) ? 'active' : ''}" data-id="${p.id}" title="Add to wishlist">
          ${wishlist.has(p.id) ? '❤️' : '🤍'}
        </button>
      </div>
      <h3><a href="product.html?id=${encodeURIComponent(p.id)}">${p.name}</a></h3>
      <div class="price">${currency(p.price)}</div>
      <p class="muted">${p.category}</p>
    </article>
  `).join("");
  
  // Add wishlist event listeners
  $$('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const productId = btn.dataset.id;
      const product = all.find(p => p.id === productId);
      if (wishlist.has(productId)) {
        wishlist.remove(productId);
        btn.textContent = '🤍';
        btn.classList.remove('active');
      } else {
        if (wishlist.add(product)) {
          btn.textContent = '❤️';
          btn.classList.add('active');
        }
      }
    });
  });
}

// ----- Product (product.html) -----
async function loadProduct(){
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const wrap = $("#product-detail");
  if(!id || !wrap){ return; }
  wrap.innerHTML = `<p class="muted">Loading product…</p>`;

  let all = [];
  try {
    const res = await fetch("products.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    all = await res.json();
  } catch (err) {
    console.error("Failed to load product:", err);
    wrap.innerHTML = `<div class="card"><p class="muted">We couldn't load this product. Please try again later.</p></div>`;
    return;
  }

  const p = all.find(x => x.id===id);
  if(!(p)){
    wrap.innerHTML = `<div class="card"><p class="muted">Product not found. <a href="index.html">Back to shop</a>.</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <div><img alt="${p.name}" src="${p.image}"></div>
    <div>
      <h1>${p.name}</h1>
      <div class="price">${currency(p.price)}</div>
      <p class="muted">${p.category}</p>
      <p>${p.description}</p>
      <div class="sizes">${p.sizes.map(s=>`<button class="size" data-size="${s}">${s}</button>`).join("")}</div>
      <div class="qty qty-selector" aria-label="Select quantity">
        <button id="qty-dec" class="dec" aria-label="Decrease quantity">−</button>
        <input id="qty" type="number" min="1" value="1" aria-label="Quantity" />
        <button id="qty-inc" class="inc" aria-label="Increase quantity">+</button>
      </div>
      <button id="add" class="btn" disabled>Add to cart</button>
    </div>
  `;
  let selected = null;
  $$(".size", wrap).forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".size", wrap).forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      selected = btn.dataset.size;
      $("#add").disabled = false;
    });
  });
  // Quantity controls
  const qtyInput = $("#qty", wrap);
  $("#qty-inc", wrap)?.addEventListener("click", ()=>{
    const curr = parseInt(qtyInput.value || "1", 10) || 1;
    qtyInput.value = String(Math.min(curr + 1, 99));
  });
  $("#qty-dec", wrap)?.addEventListener("click", ()=>{
    const curr = parseInt(qtyInput.value || "1", 10) || 1;
    qtyInput.value = String(Math.max(curr - 1, 1));
  });

  $("#add").addEventListener("click", ()=>{
    if(selected) { 
      const qty = Math.max(1, Math.min(99, parseInt(qtyInput.value || "1", 10) || 1));
      cart.add(p, selected, qty); 
      $("#add").textContent = "Added!";
      setTimeout(() => $("#add").textContent = "Add to cart", 2000);
    }
  });
  
  // Add wishlist button to product page
  const wishlistBtn = document.createElement('button');
  wishlistBtn.className = `btn btn-secondary wishlist-product-btn ${wishlist.has(p.id) ? 'active' : ''}`;
  wishlistBtn.textContent = wishlist.has(p.id) ? 'Remove from Wishlist' : 'Add to Wishlist';
  wishlistBtn.addEventListener('click', () => {
    if (wishlist.has(p.id)) {
      wishlist.remove(p.id);
      wishlistBtn.textContent = 'Add to Wishlist';
      wishlistBtn.classList.remove('active');
    } else {
      if (wishlist.add(p)) {
        wishlistBtn.textContent = 'Remove from Wishlist';
        wishlistBtn.classList.add('active');
      }
    }
  });
  $("#add").parentNode.insertBefore(wishlistBtn, $("#add"));
}

// ----- Cart (cart.html) -----
async function renderCart(){
  const itemsEl = $("#cart-items");
  const summary = $("#cart-summary");
  if(!itemsEl || !summary) return;
  const items = cart.items;
  if(items.length===0){
    itemsEl.innerHTML = `<p class="muted">Your cart is empty. <a href="index.html">Continue shopping</a>.</p>`;
    summary.classList.add("hidden");
    updateCartCount();
    return;
  }
  summary.classList.remove("hidden");
  itemsEl.innerHTML = items.map(i => `
    <div class="cart-item">
      <img src="${i.image}" alt="${i.name}" width="72" height="72">
      <div>
        <div><strong>${i.name}</strong> <span class="muted">(${i.size})</span></div>
        <div class="muted">${currency(i.price)} each</div>
        <span class="remove" data-id="${i.id}" data-size="${i.size}">Remove</span>
      </div>
      <div class="qty">
        <button class="dec" data-id="${i.id}" data-size="${i.size}">−</button>
        <span>${i.qty}</span>
        <button class="inc" data-id="${i.id}" data-size="${i.size}">+</button>
      </div>
    </div>
  `).join("");

  const subtotalVal = items.reduce((s,i)=>s + i.price * i.qty, 0);
  $("#subtotal").textContent = currency(subtotalVal);
  $("#total").textContent = currency(subtotalVal); // free shipping

  $$(".inc").forEach(b=>b.addEventListener("click",()=>cart.update(b.dataset.id, b.dataset.size, +1)));
  $$(".dec").forEach(b=>b.addEventListener("click",()=>cart.update(b.dataset.id, b.dataset.size, -1)));
  $$(".remove").forEach(b=>b.addEventListener("click",()=>cart.remove(b.dataset.id, b.dataset.size)));

    $("#checkout-btn").onclick = () => { location.href = "checkout.html"; };

  updateCartCount();
}

// ----- Checkout (checkout.html) -----
const ORDERS_KEY = "clothify_orders";

function saveOrder(order){
  const list = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
  list.push(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
}

function renderCheckout(){
  const page = $("#checkout-page");
  if(!page) return;
  const items = cart.items;
  const empty = $("#checkout-empty");
  const listEl = $("#checkout-items");
  const subtotalEl = $("#checkout-subtotal");
  const totalEl = $("#checkout-total");
  const payBtn = $("#pay-btn");

  if(items.length === 0){
    empty?.classList.remove('hidden');
    $(".checkout-grid")?.classList.add('hidden');
    return;
  }

  const subtotalVal = items.reduce((s,i)=>s + i.price * i.qty, 0);
  const totalVal = subtotalVal; // free shipping
  subtotalEl.textContent = currency(subtotalVal);
  totalEl.textContent = currency(totalVal);
  if (payBtn) payBtn.textContent = `Pay ${currency(totalVal)}`;

  listEl.innerHTML = items.map(i => `
    <div class="cart-item">
      <img src="${i.image}" alt="${i.name}" width="64" height="64">
      <div>
        <div><strong>${i.name}</strong> <span class="muted">(${i.size})</span></div>
        <div class="muted">${currency(i.price)} × ${i.qty}</div>
      </div>
      <div class="price">${currency(i.price * i.qty)}</div>
    </div>
  `).join("");
}

function initCheckoutForm(){
  const form = $("#checkout-form");
  if(!form) return;
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());

    // Basic client validation
    const errors = [];
    if(!data.fullName) errors.push('Full name is required');
    if(!data.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) errors.push('Valid email is required');
    if(!data.address) errors.push('Address is required');
    if(!data.city) errors.push('City is required');
    if(!data.country) errors.push('Country is required');
    if(!data.zip) errors.push('ZIP is required');
    if(!data.cardName) errors.push('Name on card is required');
    if(!data.cardNumber || !/^\d{12,19}$/.test(String(data.cardNumber).replace(/\s+/g,''))) errors.push('Card number looks invalid');
    if(!data.expiry || !/^(0[1-9]|1[0-2])\/(\d{2})$/.test(data.expiry)) errors.push('Expiry must be MM/YY');
    if(!data.cvc || !/^\d{3,4}$/.test(data.cvc)) errors.push('CVC looks invalid');
    if(!$("#agree").checked) errors.push('You must accept the demo notice');

    if(errors.length){
      showNotification(errors[0], 'error');
      return;
    }

    // Create order (do NOT store card details)
    const orderId = `ORD-${Date.now()}`;
    const items = cart.items;
    const subtotalVal = items.reduce((s,i)=>s + i.price * i.qty, 0);
    const order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customer: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
        zip: data.zip
      },
      items,
      subtotal: subtotalVal,
      total: subtotalVal,
      currency: 'QAR',
      status: 'paid-demo'
    };

    saveOrder(order);
    cart.clear();
    updateCartCount();
    location.href = `order-success.html?id=${encodeURIComponent(orderId)}`;
  });
}

// ----- Wishlist (wishlist.html) -----
async function renderWishlist(){
  const itemsEl = $("#wishlist-items");
  const emptyEl = $("#wishlist-empty");
  if(!itemsEl) return;
  
  const items = wishlist.items;
  
  if(items.length === 0){
    itemsEl.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    return;
  }
  
  emptyEl?.classList.add('hidden');
  itemsEl.innerHTML = items.map(item => `
    <div class="wishlist-item card">
      <a href="product.html?id=${encodeURIComponent(item.id)}"><img src="${item.image}" alt="${item.name}"></a>
      <div class="wishlist-content">
        <h3><a href="product.html?id=${encodeURIComponent(item.id)}">${item.name}</a></h3>
        <div class="price">${currency(item.price)}</div>
        <p class="muted">${item.category}</p>
        <div class="wishlist-actions">
          <a href="product.html?id=${encodeURIComponent(item.id)}" class="btn btn-primary">View Product</a>
          <button class="btn btn-secondary remove-wishlist" data-id="${item.id}">Remove</button>
        </div>
      </div>
    </div>
  `).join("");
  
  $$('.remove-wishlist').forEach(btn => {
    btn.addEventListener('click', () => {
      wishlist.remove(btn.dataset.id);
    });
  });
}

// ----- Contact Form -----
function initContactForm() {
  const form = $("#contact-form");
  const successEl = $("#form-success");
  
  if (!form) return;
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Simulate form submission
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // In a real application, you would send this data to a server
    console.log('Form submission:', data);
    
    form.style.display = 'none';
    successEl?.classList.remove('hidden');
    
    showNotification('Message sent successfully!', 'success');
    
    // Reset form after delay
    setTimeout(() => {
      form.reset();
      form.style.display = 'block';
      successEl?.classList.add('hidden');
    }, 5000);
  });
}

// ----- Init per page -----
document.addEventListener("DOMContentLoaded", ()=>{
  setYear(); 
  updateCartCount(); 
  updateWishlistCount();
  
  // Shop page
  if($("#products")) {
    loadProducts();
    $("#search")?.addEventListener("input", loadProducts);
    $("#category")?.addEventListener("change", loadProducts);
    $("#sort")?.addEventListener("change", loadProducts);
    $("#price-range")?.addEventListener("change", loadProducts);
  }
  
  // Product page
  if($("#product-detail")) loadProduct();
  
  // Cart page
  if($("#cart-items")) renderCart();
  
  // Wishlist page
  if($("#wishlist-items")) renderWishlist();
  
  // Contact page
  initContactForm();

  // Checkout page
  renderCheckout();
  initCheckoutForm();
});
