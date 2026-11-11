
import { createClient } from '@supabase/supabase-js'
import './style.css'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

const app = document.querySelector('#app')

let products = []
let categories = []
let customers = []
let orders = []
let orderDetails = []
let cart = []
let lastReceipt = null

let currentCustomer = JSON.parse(
  localStorage.getItem('computerStoreCustomer') || 'null'
)

let page = 'store'
let searchText = ''
let categoryFilter = 'all'
let isAdmin = false

const placeholder = 'https://placehold.co/400x300?text=Computer+Product'
const money = n => Number(n || 0).toLocaleString('th-TH')

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]))

async function loadData() {
  const [p,c,cu,o,d] = await Promise.all([
    supabase.from('products').select('*').order('product_id'),
    supabase.from('categories').select('*').order('category_id'),
    supabase.from('customers').select('*').order('customer_id'),
    supabase.from('orders').select('*').order('order_id',{ascending:false}),
    supabase.from('order_details').select('*')
  ])

  for (const r of [p,c,cu,o,d]) if(r.error) throw r.error

  products=p.data||[]
  categories=c.data||[]
  customers=cu.data||[]
  orders=o.data||[]
  orderDetails=d.data||[]
}

/* ===== ROUTING ===== */

function goPath(path) {
  history.pushState({}, '', path)
  start()
}

window.goPath = goPath

window.addEventListener('popstate', start)

window.go = async name => {
  page = name
  await loadData()
  render()
}

function layout(content,admin=false) {
  app.innerHTML=`
    <aside class="sidebar">
      <h2>🖥 COMPUTER STORE</h2>
      <p>${admin?'ADMIN MANAGEMENT':'ร้านอุปกรณ์คอมพิวเตอร์'}</p>
      <nav>
        ${admin?`
          <button onclick="go('dashboard')">ภาพรวม</button>
          <button onclick="go('products')">สินค้า</button>
          <button onclick="go('categories')">หมวดหมู่</button>
          <button onclick="go('customers')">ลูกค้า</button>
          <button onclick="go('orders')">ประวัติการขาย</button>
          <button onclick="go('stock-history')">ประวัติสต็อก</button>
          <button onclick="adminLogout()">ออกจากระบบ</button>
          <button onclick="goPath('/')">กลับหน้าร้าน</button>
        `:`
          <button onclick="go('store')">หน้าร้าน</button>
          <button onclick="go('sales')">ตะกร้า / สั่งซื้อ</button>
          <button onclick="goPath('/admin')">Admin</button>
        `}
      </nav>
    </aside>
    <main class="main-content">
      <div class="page-content">${content}</div>
    </main>
  `
}

function render() {
  if(!isAdmin) {
    if(page==='sales') renderSales()
    else renderStore()
    return
  }

  if(page==='dashboard') renderDashboard()
  if(page==='products') renderProducts()
  if(page==='categories') renderCategories()
  if(page==='customers') renderCustomers()
  if(page==='orders') renderOrders()
  if(page==='stock-history') renderStockHistory()
}

function categoryName(id) {
  return categories.find(c=>String(c.category_id)===String(id))
    ?.category_name || 'ไม่ระบุหมวด'
}

function getCustomer(id) {
  return customers.find(c=>String(c.customer_id)===String(id))
}

/* ===== ADMIN AUTH ===== */

async function checkAdmin() {
  const {data,error}=await supabase.auth.getSession()
  if(error) throw error
  return !!data.session
}

window.adminLogout=async()=>{
  await supabase.auth.signOut()
  isAdmin=false
  goPath('/admin')
}

function showAdminLogin() {
  app.innerHTML=`
    <div class="admin-login">
      <form class="login-card" id="adminLoginForm">
        <h1>🖥 Admin Login</h1>
        <p>Computer Store Management</p>
        <label>Email</label>
        <input id="adminEmail" type="email" required>
        <label>Password</label>
        <input id="adminPassword" type="password" required>
        <button class="primary" type="submit">เข้าสู่ระบบ</button>
        <button type="button" onclick="location.href='/'">กลับหน้าร้าน</button>
      </form>
    </div>
  `

  document.querySelector('#adminLoginForm').onsubmit=async e=>{
    e.preventDefault()
    const email=document.querySelector('#adminEmail').value
    const password=document.querySelector('#adminPassword').value

    const {error}=await supabase.auth.signInWithPassword({email,password})
    if(error)return alert('Login ไม่สำเร็จ: '+error.message)

    goPath('/admin')
  }
}

async function start() {
  const path=location.pathname

  try {
    if(path.startsWith('/admin')) {
      isAdmin=await checkAdmin()
      if(!isAdmin) return showAdminLogin()

      page='dashboard'
      layout('<h2>กำลังโหลดข้อมูล...</h2>',true)
      await loadData()
      render()
    } else {
      isAdmin=false
      page='store'
      layout('<h2>กำลังโหลดสินค้า...</h2>')
      await loadData()
      renderStore()
    }
  } catch(error) {
    console.error(error)
    app.innerHTML=`<div style="padding:30px"><h2>โหลดข้อมูลไม่สำเร็จ</h2><p>${esc(error.message)}</p></div>`
  }
}

/* ===== ADMIN DASHBOARD ===== */

function renderDashboard() {
  const revenue=orders.reduce((s,o)=>s+Number(o.total||0),0)
  const stock=products.reduce((s,p)=>s+Number(p.stock||0),0)

  layout(`
    <h1>ภาพรวมร้านค้า</h1>
    <div class="dashboard-grid">
      <div class="stat-card"><h3>สินค้า</h3><h2>${products.length}</h2></div>
      <div class="stat-card"><h3>สต็อก</h3><h2>${stock}</h2></div>
      <div class="stat-card"><h3>ลูกค้า</h3><h2>${customers.length}</h2></div>
      <div class="stat-card"><h3>ยอดขายรวม</h3><h2>${money(revenue)} บาท</h2></div>
    </div>
  `,true)
}

/* ===== ADMIN PRODUCTS ===== */

function renderProducts() {
  const list=products.filter(p=>{
    const q=searchText.toLowerCase()
    return (p.product_name||'').toLowerCase().includes(q) &&
      (categoryFilter==='all'||String(p.category_id)===String(categoryFilter))
  })

  layout(`
    <h1>จัดการสินค้า</h1>
    <section class="panel">
      <div class="panel-head">
        <h2>รายการสินค้า</h2>
        <button class="primary" onclick="openProductForm()">＋ เพิ่มสินค้า</button>
      </div>
      <div class="filter-row">
        <input placeholder="ค้นหาสินค้า..." value="${esc(searchText)}"
          oninput="searchProducts(this.value)">
        <select onchange="filterCategory(this.value)">
          <option value="all">ทุกหมวด</option>
          ${categories.map(c=>`<option value="${c.category_id}" ${String(categoryFilter)===String(c.category_id)?'selected':''}>${esc(c.category_name)}</option>`).join('')}
        </select>
      </div>
      <div class="product-grid">
        ${list.map(p=>`
          <div class="product-card">
            <div class="product-image"><img src="${esc(p.image_url||placeholder)}" onerror="this.src='${placeholder}'"></div>
            <div class="product-info">
              <h3>${esc(p.product_name)}</h3>
              <p>${esc(categoryName(p.category_id))} · Stock ${p.stock}</p>
              <div class="price">${money(p.price)} บาท</div>
              <div class="button-row">
                <button onclick="editProduct(${p.product_id})">แก้ไข</button>
                <button class="danger" onclick="deleteProduct(${p.product_id})">ลบ</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `,true)
}

window.searchProducts=value=>{
  searchText=value
  renderProducts()
  const input=document.querySelector('.filter-row input')
  input?.focus()
  input?.setSelectionRange(value.length,value.length)
}

window.filterCategory=value=>{
  categoryFilter=value
  renderProducts()
}

window.openProductForm=id=>{
  const p=id?products.find(x=>x.product_id===id):null

  app.insertAdjacentHTML('beforeend',`
    <div class="product-modal" id="productModal">
      <div class="product-form">
        <h2>${p?'แก้ไขสินค้า':'เพิ่มสินค้า'}</h2>
        <form id="productForm">
          <label>ชื่อสินค้า</label><input name="product_name" required value="${esc(p?.product_name||'')}">
          <label>ราคา</label><input name="price" type="number" min="0" required value="${p?.price??''}">
          <label>จำนวน Stock</label><input name="stock" type="number" min="0" required value="${p?.stock??0}">
          <label>หมวดหมู่</label>
          <select name="category_id" required>
            <option value="">เลือกหมวดหมู่</option>
            ${categories.map(c=>`<option value="${c.category_id}" ${String(p?.category_id)===String(c.category_id)?'selected':''}>${esc(c.category_name)}</option>`).join('')}
          </select>
          <label>URL รูปสินค้า</label><input name="image_url" id="imageUrl" value="${esc(p?.image_url||'')}">
          <img id="previewImage" class="form-preview" src="${esc(p?.image_url||placeholder)}">
          <div class="button-row">
            <button type="button" onclick="closeProductForm()">ยกเลิก</button>
            <button class="primary" type="submit">บันทึก</button>
          </div>
        </form>
      </div>
    </div>
  `)

  const form=document.querySelector('#productForm')
  const image=document.querySelector('#imageUrl')
  const preview=document.querySelector('#previewImage')
  image.oninput=()=>preview.src=image.value||placeholder
  preview.onerror=()=>preview.src=placeholder

  form.onsubmit=async e=>{
    e.preventDefault()
    const f=new FormData(form)
    const item={
      product_name:f.get('product_name').trim(),
      price:Number(f.get('price')),
      stock:Number(f.get('stock')),
      category_id:Number(f.get('category_id')),
      image_url:f.get('image_url').trim()
    }

    const result=p
      ? await supabase.from('products').update(item).eq('product_id',id)
      : await supabase.from('products').insert(item)

    if(result.error)return alert(result.error.message)
    closeProductForm()
    await loadData()
    renderProducts()
  }
}

window.closeProductForm=()=>document.querySelector('#productModal')?.remove()
window.editProduct=id=>openProductForm(id)

window.deleteProduct=async id=>{
  if(!confirm('ยืนยันลบสินค้า?'))return
  const {error}=await supabase.from('products').delete().eq('product_id',id)
  if(error)return alert(error.message)
  await loadData()
  renderProducts()
}

/* ===== ADMIN CATEGORIES ===== */

function renderCategories() {
  layout(`
    <h1>หมวดหมู่สินค้า</h1>
    <section class="panel">
      <div class="panel-head"><h2>รายการหมวดหมู่</h2>
      <button class="primary" onclick="addCategory()">＋ เพิ่มหมวดหมู่</button></div>
      <table>
        <thead><tr><th>ID</th><th>ชื่อหมวด</th><th>จัดการ</th></tr></thead>
        <tbody>${categories.map(c=>`
          <tr><td>${c.category_id}</td><td>${esc(c.category_name)}</td>
          <td><button class="danger" onclick="deleteCategory(${c.category_id})">ลบ</button></td></tr>
        `).join('')}</tbody>
      </table>
    </section>
  `,true)
}

window.addCategory=async()=>{
  const name=prompt('ชื่อหมวดหมู่:')
  if(!name)return
  const {error}=await supabase.from('categories').insert({category_name:name})
  if(error)return alert(error.message)
  await loadData()
  renderCategories()
}

window.deleteCategory=async id=>{
  if(!confirm('ลบหมวดหมู่?'))return
  const {error}=await supabase.from('categories').delete().eq('category_id',id)
  if(error)return alert(error.message)
  await loadData()
  renderCategories()
}

/* ===== ADMIN CUSTOMERS ===== */

function renderCustomers() {
  layout(`
    <h1>จัดการลูกค้า</h1>
    <section class="panel">
      <table>
        <thead><tr><th>ID</th><th>ชื่อ</th><th>Email</th><th>เบอร์โทร</th></tr></thead>
        <tbody>${customers.map(c=>`
          <tr><td>${c.customer_id}</td><td>${esc(c.customer_name)}</td>
          <td>${esc(c.email)}</td><td>${esc(c.phone||'-')}</td></tr>
        `).join('')}</tbody>
      </table>
    </section>
  `,true)
}

/* ===== ADMIN ORDERS ===== */



/* ===== CUSTOMER LOGIN / REGISTER ===== */

window.loginCustomer=()=>{
  app.insertAdjacentHTML('beforeend',`
    <div class="product-modal" id="customerModal"><div class="product-form">
      <h2>เข้าสู่ระบบลูกค้า</h2>
      <form id="loginForm">
        <label>เบอร์โทร</label><input name="phone" required>
        <button class="primary" type="submit">เข้าสู่ระบบ</button>
        <button type="button" onclick="registerCustomer()">ลงทะเบียนใหม่</button>
        <button type="button" onclick="closeCustomerModal()">ปิด</button>
      </form>
    </div></div>
  `)

  document.querySelector('#loginForm').onsubmit=async e=>{
    e.preventDefault()
    const phone=new FormData(e.target).get('phone').trim()
    const customer=customers.find(c=>c.phone===phone)
    if(!customer)return alert('ไม่พบเบอร์นี้ กรุณาลงทะเบียน')
    setCustomer(customer)
    closeCustomerModal()
    go('sales')
  }
}

window.registerCustomer=()=>{
  document.querySelector('#customerModal')?.remove()
  app.insertAdjacentHTML('beforeend',`
    <div class="product-modal" id="customerModal"><div class="product-form">
      <h2>ลงทะเบียนลูกค้า</h2>
      <form id="registerForm">
        <label>ชื่อ-นามสกุล</label><input name="customer_name" required>
        <label>เบอร์โทร</label><input name="phone" required>
        <label>ที่อยู่</label><textarea name="address" required></textarea>
        <button class="primary" type="submit">สมัครสมาชิก</button>
        <button type="button" onclick="closeCustomerModal()">ยกเลิก</button>
      </form>
    </div></div>
  `)

  document.querySelector('#registerForm').onsubmit=async e=>{
    e.preventDefault()
    const f=new FormData(e.target)
    const item={
      customer_name:f.get('customer_name').trim(),
      phone:f.get('phone').trim(),
      address:f.get('address').trim()
    }
    if(customers.some(c=>c.phone===item.phone))return alert('เบอร์นี้ลงทะเบียนแล้ว')

    const {error}=await supabase.from('customers').insert(item)
    if(error)return alert(error.message)
    await loadData()
    currentCustomer=null
    localStorage.removeItem('computerStoreCustomer')
    closeCustomerModal()
    alert('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ')
    loginCustomer()
  }
}

function setCustomer(customer) {
  currentCustomer=customer
  localStorage.setItem('computerStoreCustomer',JSON.stringify(customer))
}

window.logoutCustomer=()=>{
  currentCustomer=null
  localStorage.removeItem('computerStoreCustomer')
  renderSales()
}

window.closeCustomerModal=()=>document.querySelector('#customerModal')?.remove()

/* ===== STORE FRONT ===== */

function renderStore() {
  const list=products.filter(p=>
    (p.product_name||'').toLowerCase().includes(searchText.toLowerCase()) &&
    (categoryFilter==='all'||String(p.category_id)===String(categoryFilter))
  )

  layout(`
    <h1>🖥️ ร้านขายอุปกรณ์คอมพิวเตอร์</h1>
    <section class="panel">
      <div class="panel-head"><h2>สินค้าแนะนำ</h2>
      <button class="primary" onclick="go('sales')">ตะกร้า / สั่งซื้อ</button></div>
      <div class="filter-row">
        <input placeholder="ค้นหาสินค้า..." value="${esc(searchText)}" oninput="storeSearch(this.value)">
        <select onchange="storeCategory(this.value)">
          <option value="all">ทุกหมวดหมู่</option>
          ${categories.map(c=>`<option value="${c.category_id}" ${String(categoryFilter)===String(c.category_id)?'selected':''}>${esc(c.category_name)}</option>`).join('')}
        </select>
      </div>
      <div class="product-grid">
        ${list.map(p=>`
          <div class="product-card">
            <div class="product-image"><img src="${esc(p.image_url||placeholder)}" onerror="this.src='${placeholder}'"></div>
            <div class="product-info">
              <h3>${esc(p.product_name)}</h3>
              <p>${esc(categoryName(p.category_id))} · คงเหลือ ${p.stock}</p>
              <div class="price">${money(p.price)} บาท</div>
              <button class="primary" onclick="addCart(${p.product_id})" ${p.stock<=0?'disabled':''}>เพิ่มลงตะกร้า</button>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `)
}

window.storeSearch=value=>{searchText=value;renderStore()}
window.storeCategory=value=>{categoryFilter=value;renderStore()}

/* ===== SALES / CART ===== */

function renderSales() {
  layout(`
    <h1>ตะกร้าสินค้า / สั่งซื้อ</h1>
    <section class="panel">
      <div class="panel-head"><h2>ข้อมูลลูกค้า</h2>
      ${currentCustomer
        ? `<button onclick="logoutCustomer()">ออกจากระบบลูกค้า</button>`
        : `<button class="primary" onclick="loginCustomer()">Login / ลงทะเบียน</button>`}
      </div>
      ${currentCustomer?`
        <div class="customer-box">
          <b>ลูกค้า:</b> ${esc(currentCustomer.customer_name)}<br>
          <b>เบอร์:</b> ${esc(currentCustomer.phone)}<br>
          <b>ที่อยู่:</b> ${esc(currentCustomer.address)}
        </div>
      `:''}
      <h2>เลือกสินค้า</h2>
      <input id="saleSearch" placeholder="ค้นหาสินค้า..." oninput="searchSale(this.value)">
      <div id="saleProducts" class="product-grid">${saleProductCards(products)}</div>
    </section>
    <section class="panel">
      <h2>ตะกร้าสินค้า</h2>
      <div class="table-scroll"><table>
        <thead><tr><th>สินค้า</th><th>จำนวน</th><th>ราคา</th><th>รวม</th><th></th></tr></thead>
        <tbody>${cart.map((x,i)=>`
          <tr><td>${esc(x.product_name)}</td><td>${x.quantity}</td>
          <td>${money(x.price)}</td><td>${money(x.price*x.quantity)}</td>
          <td><button class="danger" onclick="removeCart(${i})">ลบ</button></td></tr>
        `).join('')}</tbody>
      </table></div>
      <h2>ยอดรวม ${money(cart.reduce((s,x)=>s+x.price*x.quantity,0))} บาท</h2>
      <button class="primary" onclick="checkout()">สั่งซื้อสินค้า</button>
      <button onclick="clearCart()">ล้างตะกร้า</button>
    </section>
  `)
}

function saleProductCards(list) {
  return list.map(p=>`
    <div class="product-card">
      <div class="product-image"><img src="${esc(p.image_url||placeholder)}" onerror="this.src='${placeholder}'"></div>
      <div class="product-info">
        <h3>${esc(p.product_name)}</h3>
        <p>คงเหลือ ${p.stock}</p>
        <div class="price">${money(p.price)} บาท</div>
        <button class="primary" onclick="addCart(${p.product_id})" ${p.stock<=0?'disabled':''}>เพิ่มลงตะกร้า</button>
      </div>
    </div>
  `).join('')
}

window.searchSale=value=>{
  const list=products.filter(p=>(p.product_name||'').toLowerCase().includes(value.toLowerCase()))
  document.querySelector('#saleProducts').innerHTML=saleProductCards(list)
}

window.addCart=id=>{
  const p=products.find(x=>x.product_id===id)
  if(!p)return
  const item=cart.find(x=>x.product_id===id)
  if(item){
    if(item.quantity>=p.stock)return alert('สินค้าในสต็อกไม่เพียงพอ')
    item.quantity++
  }else{
    if(p.stock<=0)return alert('สินค้าหมด')
    cart.push({...p,quantity:1})
  }
  renderSales()
}

window.removeCart=index=>{
  cart.splice(index,1)
  renderSales()
}

window.clearCart=()=>{
  if(!confirm('ล้างตะกร้าสินค้าทั้งหมด?'))return
  cart=[]
  renderSales()
}

/* ===== CHECKOUT ===== */

window.checkout=async()=>{
  if(!currentCustomer)return alert('กรุณา Login / ลงทะเบียนลูกค้าก่อน')
  if(!cart.length)return alert('กรุณาเลือกสินค้า')

  await loadData()
  for(const item of cart){
    const p=products.find(x=>String(x.product_id)===String(item.product_id))
    if(!p||Number(p.stock)<item.quantity)return alert(`สินค้า ${p?.product_name||''} มีไม่เพียงพอ`)
  }

  const items=cart.map(x=>({...x}))
  const total=items.reduce((s,x)=>s+Number(x.price)*x.quantity,0)
  if(!confirm(`ยืนยันสั่งซื้อ ${money(total)} บาท?`))return

  const {data:order,error}=await supabase.from('orders')
    .insert({customer_id:currentCustomer.customer_id,order_date:new Date().toISOString(),total})
    .select().single()
  if(error)return alert(error.message)

  const detail=items.map(x=>({order_id:order.order_id,product_id:x.product_id,quantity:x.quantity,price:x.price}))
  const {error:de}=await supabase.from('order_details').insert(detail)
  if(de)return alert('สร้างรายการสั่งซื้อแล้ว แต่บันทึกรายละเอียดไม่สำเร็จ: '+de.message)

  for(const item of items){
    const p=products.find(x=>String(x.product_id)===String(item.product_id))
    const {error}=await supabase.from('products').update({stock:Number(p.stock)-item.quantity}).eq('product_id',item.product_id)
    if(error)return alert('บันทึกออเดอร์แล้ว แต่ตัดสต็อกไม่สำเร็จ: '+error.message)
  }

  lastReceipt={
    order_id:order.order_id,
    order_date:order.order_date||new Date().toISOString(),
    customer:{...currentCustomer},
    items,
    total
  }
  cart=[]
  await loadData()
  renderReceipt()
}

function renderReceipt(){
  if(!lastReceipt)return renderSales()
  const r=lastReceipt
  layout(`
    <section class="panel receipt" id="receipt">
      <div class="receipt-head">
        <h1>🖥 COMPUTER STORE</h1>
        <h2>ใบเสร็จรับเงิน / รายละเอียดคำสั่งซื้อ</h2>
      </div>
      <p><b>เลขที่คำสั่งซื้อ:</b> ${esc(r.order_id)}</p>
      <p><b>วันที่:</b> ${new Date(r.order_date).toLocaleString('th-TH')}</p>
      <hr>
      <p><b>ลูกค้า:</b> ${esc(r.customer.customer_name)}</p>
      <p><b>เบอร์โทร:</b> ${esc(r.customer.phone||'-')}</p>
      <p><b>ที่อยู่:</b> ${esc(r.customer.address||'-')}</p>
      <div class="table-scroll"><table>
        <thead><tr><th>สินค้า</th><th>จำนวน</th><th>ราคาต่อชิ้น</th><th>รวม</th></tr></thead>
        <tbody>${r.items.map(x=>`<tr><td>${esc(x.product_name)}</td><td>${x.quantity}</td><td>${money(x.price)}</td><td>${money(x.price*x.quantity)}</td></tr>`).join('')}</tbody>
      </table></div>
      <h2 class="receipt-total">ยอดรวมสุทธิ ${money(r.total)} บาท</h2>
      <p style="text-align:center">ขอบคุณที่ใช้บริการ</p>
    </section>
    <div class="button-row no-print">
      <button class="primary" onclick="printReceipt()">🖨 พิมพ์ใบเสร็จ</button>
      <button onclick="go('store')">กลับหน้าร้าน</button>
      <button onclick="go('sales')">ซื้อสินค้าต่อ</button>
    </div>
  `)
}

window.printReceipt=()=>window.print()

/* ===== STOCK HISTORY ===== */
window.renderStockHistory=async()=>{
  layout('<h1>กำลังโหลดประวัติสต็อก...</h1>',true)
  const {data,error}=await supabase.from('stock_movements')
    .select('*').order('created_at',{ascending:false})
  if(error){
    layout(`<h1>ประวัติสต็อก</h1><section class="panel"><p>โหลดประวัติไม่สำเร็จ: ${esc(error.message)}</p></section>`,true)
    return
  }
  const rows=data||[]
  console.log('STOCK DATA:', data);
  console.log('STOCK ERROR:', error);
  layout(`
    <h1>ประวัติการเข้า-ออกสต็อก</h1>
    <section class="panel">
      <div class="table-scroll"><table>
        <thead><tr><th>วันที่</th><th>สินค้า ID</th><th>ประเภท</th><th>จำนวน</th><th>ก่อนเปลี่ยน</th><th>หลังเปลี่ยน</th><th>เหตุผล</th></tr></thead>
        <tbody>${rows.map(m=>`<tr>
          <td>${m.created_at?new Date(m.created_at).toLocaleString('th-TH'):'-'}</td>
          <td>${esc(m.product_id)}</td>
          <td>${m.movement_type==='IN'?'รับเข้า':m.movement_type==='OUT'?'เบิกออก':esc(m.movement_type)}</td>
          <td>${esc(m.quantity)}</td><td>${esc(m.stock_before)}</td><td>${esc(m.stock_after)}</td><td>${esc(m.reason||'-')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>
  `,true)
}

/* ===== ADMIN ORDERS ===== */

function renderOrders() {
  layout(`
    <h1>ประวัติการขาย</h1>
    <section class="panel"><div class="table-scroll"><table>
      <thead><tr><th>เลขที่</th><th>วันที่</th><th>ลูกค้า</th><th>เบอร์</th><th>ที่อยู่</th><th>สินค้า</th><th>ยอดรวม</th></tr></thead>
      <tbody>${orders.map(o=>{
        const customer=getCustomer(o.customer_id)
        const detail=orderDetails.filter(d=>
          String(d.order_id)===String(o.order_id)
        )
        const text=detail.map(d=>{
          const p=products.find(x=>x.product_id===d.product_id)
          return `${esc(p?.product_name||'สินค้า')} x ${d.quantity}`
        }).join('<br>')
        return `<tr><td>${o.order_id}</td><td>${new Date(o.order_date).toLocaleString('th-TH')}</td>
          <td>${esc(customer?.customer_name||'ไม่ระบุ')}</td><td>${esc(customer?.phone||'-')}</td>
          <td>${esc(customer?.address||'-')}</td><td>${text||'-'}</td><td>${money(o.total)} บาท</td></tr>`
      }).join('')}</tbody>
    </table></div></section>
  `,true)
}

/* ===== RECEIPT PRINT ===== */
const printStyle=document.createElement('style')
printStyle.textContent=`
@media print {
  body * { visibility:hidden !important; }
  #receipt, #receipt * { visibility:visible !important; }
  #receipt { position:absolute; left:0; top:0; width:100%; border:0; box-shadow:none; }
  .no-print, .sidebar { display:none !important; }
  table { width:100%; border-collapse:collapse; }
  th,td { border:1px solid #999; padding:8px; }
}
`
document.head.appendChild(printStyle)

/* ===== START ===== */

start()
